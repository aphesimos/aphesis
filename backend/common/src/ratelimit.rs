//! Rate limits as plain data, so a Durable Object can keep the records in its storage and the rules can be tested
//! without one. Keys are always hashes (an action and a salted IP hash), never addresses.
//!
//! - [`window`]: a sliding window with a minimum gap (the wall). Also usable as a lockout: count failures, refuse
//!   while the window is full.
//! - [`bucket`]: a token bucket (the forum): a short burst, then one more each `window / limit`.

pub mod window {
    use serde::{Deserialize, Deserializer, Serialize};

    /// At most `limit` attempts in `window_ms`, and at least `gap_ms` between two (0 for none).
    #[derive(Debug, Clone, Copy)]
    pub struct Rule {
        pub limit: usize,
        pub window_ms: i64,
        pub gap_ms: i64,
    }

    /// The times (ms) of recent accepted attempts, oldest first. Anything in a stored record that is not a
    /// number is dropped when it is read, as the JavaScript Worker did.
    #[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
    pub struct Record {
        #[serde(default, deserialize_with = "numbers_only")]
        pub hits: Vec<f64>,
    }

    fn numbers_only<'de, D: Deserializer<'de>>(d: D) -> Result<Vec<f64>, D::Error> {
        let v: Vec<serde_json::Value> = Vec::deserialize(d)?;
        Ok(v.into_iter().filter_map(|x| x.as_f64()).collect())
    }

    #[derive(Debug, Clone, PartialEq)]
    pub struct Outcome {
        pub ok: bool,
        pub record: Record,
        /// whole seconds until an attempt can pass; 0 when this one did
        pub retry_after: i64,
    }

    fn ceil_secs(ms: f64) -> i64 {
        (ms / 1000.0).ceil() as i64
    }

    /// Counts one attempt if it fits. A refused attempt is not counted.
    pub fn take(record: Option<&Record>, now: i64, rule: Rule) -> Outcome {
        let n = now as f64;
        let mut hits: Vec<f64> = record
            .map(|r| {
                r.hits
                    .iter()
                    .copied()
                    .filter(|t| t.is_finite() && n - t < rule.window_ms as f64 && *t <= n)
                    .collect()
            })
            .unwrap_or_default();
        if rule.gap_ms > 0 {
            if let Some(&last) = hits.last() {
                if n - last < rule.gap_ms as f64 {
                    let retry_after = ceil_secs(last + rule.gap_ms as f64 - n);
                    return Outcome {
                        ok: false,
                        record: Record { hits },
                        retry_after,
                    };
                }
            }
        }
        if hits.len() >= rule.limit {
            let retry_after = ceil_secs(hits[0] + rule.window_ms as f64 - n);
            return Outcome {
                ok: false,
                record: Record { hits },
                retry_after,
            };
        }
        hits.push(n);
        Outcome {
            ok: true,
            record: Record { hits },
            retry_after: 0,
        }
    }

    /// When a record can be forgotten: one window after its last hit (0 for an empty record).
    pub fn expires_at(record: Option<&Record>, rule: Rule) -> i64 {
        match record.and_then(|r| r.hits.last()) {
            Some(&t) => t as i64 + rule.window_ms,
            None => 0,
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        const RULE: Rule = Rule {
            limit: 3,
            window_ms: 60_000,
            gap_ms: 5_000,
        };

        fn rec(h: &[f64]) -> Record {
            Record { hits: h.to_vec() }
        }

        #[test]
        fn allows_up_to_the_limit_spaced_by_the_gap() {
            let mut r: Option<Record> = None;
            let mut t = 1_000_000;
            for _ in 0..3 {
                let o = take(r.as_ref(), t, RULE);
                assert!(o.ok);
                r = Some(o.record);
                t += 6_000;
            }
            let o = take(r.as_ref(), t, RULE);
            assert!(!o.ok);
            assert_eq!(
                o.retry_after,
                ((1_000_000 + 60_000 - t) as f64 / 1000.0).ceil() as i64
            );
        }

        #[test]
        fn enforces_the_gap() {
            let a = take(None, 0, RULE);
            let b = take(Some(&a.record), 2_000, RULE);
            assert!(!b.ok);
            assert_eq!(b.retry_after, 3);
            assert!(take(Some(&a.record), 5_000, RULE).ok);
        }

        #[test]
        fn a_refused_attempt_is_not_counted() {
            let a = take(None, 0, RULE);
            let b = take(Some(&a.record), 1_000, RULE);
            assert_eq!(b.record.hits, vec![0.0]);
        }

        #[test]
        fn the_window_slides() {
            let r = rec(&[0.0, 10_000.0, 20_000.0]);
            assert!(!take(Some(&r), 30_000, RULE).ok);
            let o = take(Some(&r), 60_001, RULE);
            assert!(o.ok);
            assert_eq!(o.record.hits, vec![10_000.0, 20_000.0, 60_001.0]);
        }

        #[test]
        fn ignores_junk_and_future_times() {
            let r: Record = serde_json::from_str(r#"{"hits":["x",null,9e15]}"#).unwrap();
            let o = take(Some(&r), 1000, RULE);
            assert!(o.ok);
            assert_eq!(o.record.hits, vec![1000.0]);
            let empty: Record = serde_json::from_str("{}").unwrap();
            assert!(empty.hits.is_empty());
        }

        #[test]
        fn records_expire_one_window_after_the_last_hit() {
            assert_eq!(expires_at(Some(&rec(&[5.0, 10.0])), RULE), 60_010);
            assert_eq!(expires_at(None, RULE), 0);
        }
    }
}

pub mod bucket {
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Clone, Copy)]
    pub struct Rule {
        pub limit: f64,
        pub window_ms: f64,
    }

    /// `None` is a full bucket.
    #[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
    pub struct Bucket {
        pub tokens: f64,
        pub at: f64,
    }

    #[derive(Debug, Clone, Copy, PartialEq)]
    pub struct Outcome {
        pub allowed: bool,
        pub bucket: Bucket,
        /// whole seconds until a token is back; 0 when allowed
        pub retry_after: i64,
    }

    pub fn take(bucket: Option<&Bucket>, now: f64, rule: Rule) -> Outcome {
        let rate = rule.limit / rule.window_ms;
        let mut tokens = match bucket {
            Some(b) => rule.limit.min(b.tokens + (now - b.at) * rate),
            None => rule.limit,
        };
        if tokens >= 1.0 - 1e-9 {
            tokens = tokens.max(0.0) - 1.0;
            return Outcome {
                allowed: true,
                bucket: Bucket { tokens, at: now },
                retry_after: 0,
            };
        }
        let retry_after = ((1.0 - tokens) / rate / 1000.0).ceil() as i64;
        Outcome {
            allowed: false,
            bucket: Bucket { tokens, at: now },
            retry_after,
        }
    }

    /// A bucket that has refilled completely is the same as no bucket: it can be forgotten.
    pub fn is_full(bucket: Option<&Bucket>, now: f64, rule: Rule) -> bool {
        match bucket {
            None => true,
            Some(b) => b.tokens + (now - b.at) * (rule.limit / rule.window_ms) >= rule.limit,
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        const R: Rule = Rule {
            limit: 4.0,
            window_ms: 120_000.0,
        };

        fn drain(now: f64) -> Option<Bucket> {
            let mut b = None;
            for _ in 0..4 {
                b = Some(take(b.as_ref(), now, R).bucket);
            }
            b
        }

        #[test]
        fn a_burst_up_to_the_limit_then_it_waits() {
            let now = 1e12;
            let mut b: Option<Bucket> = None;
            for _ in 0..4 {
                let o = take(b.as_ref(), now, R);
                assert!(o.allowed);
                b = Some(o.bucket);
            }
            let o = take(b.as_ref(), now, R);
            assert!(!o.allowed);
            assert_eq!(o.retry_after, 30);
        }

        #[test]
        fn tokens_come_back_never_above_the_limit() {
            let now = 1e12;
            let b = drain(now);
            assert!(!take(b.as_ref(), now + 29_000.0, R).allowed);
            assert!(take(b.as_ref(), now + 30_000.0, R).allowed);
            let later = take(b.as_ref(), now + 10.0 * 120_000.0, R);
            assert!(later.bucket.tokens <= R.limit - 1.0 + 1e-9);
        }

        #[test]
        fn retrying_earns_nothing() {
            let now = 1e12;
            let mut b = drain(now);
            for s in 1..30 {
                let o = take(b.as_ref(), now + s as f64 * 1000.0, R);
                assert!(!o.allowed);
                b = Some(o.bucket);
            }
            assert!(take(b.as_ref(), now + 30_000.0, R).allowed);
        }

        #[test]
        fn one_thread_per_window() {
            let o = Rule {
                limit: 1.0,
                window_ms: 120_000.0,
            };
            let a = take(None, 0.0, o);
            assert!(a.allowed);
            let b = take(Some(&a.bucket), 60_000.0, o);
            assert!(!b.allowed);
            assert_eq!(b.retry_after, 60);
        }

        #[test]
        fn a_refilled_bucket_can_be_forgotten() {
            let r = take(None, 0.0, R);
            assert!(!is_full(Some(&r.bucket), 1000.0, R));
            assert!(is_full(Some(&r.bucket), 30_000.0, R));
            assert!(is_full(None, 0.0, R));
        }
    }
}
