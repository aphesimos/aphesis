//! Lockout with backoff, as plain data, for both steps of the gate (the password and the code).
//!
//! Every failure is counted against the visitor (a salted hash of the address) and against everyone (`*`). A key
//! has a few free failures; after that each failure locks it for twice as long as the last, up to a ceiling. While
//! a key is locked every answer is the same refusal, right or wrong, so a locked gate tells nothing. A key that has
//! been quiet long enough is forgotten. A success clears the visitor's record, never everyone's.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Policy {
    /// failures before the first lock
    pub free: u32,
    /// the first lock, in ms; each failure after it doubles
    pub base_ms: i64,
    pub ceiling_ms: i64,
    /// a record with no failure for this long starts over
    pub forget_ms: i64,
}

const MINUTE: i64 = 60_000;
pub const VISITOR: Policy = Policy {
    free: 4,
    base_ms: MINUTE,
    ceiling_ms: 6 * 60 * MINUTE,
    forget_ms: 24 * 60 * MINUTE,
};
pub const EVERYONE: Policy = Policy {
    free: 30,
    base_ms: 5 * MINUTE,
    ceiling_ms: 60 * MINUTE,
    forget_ms: 60 * MINUTE,
};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Record {
    pub fails: u32,
    pub last: i64,
    pub until: i64,
}

pub fn locked(r: Option<&Record>, now: i64) -> bool {
    r.is_some_and(|r| r.until > now)
}

/// The record after one more failure.
pub fn fail(r: Option<&Record>, now: i64, p: Policy) -> Record {
    let fails = match r {
        Some(r) if now - r.last < p.forget_ms => r.fails + 1,
        _ => 1,
    };
    let until = if fails > p.free {
        let k = (fails - p.free - 1).min(30);
        now + (p.base_ms.saturating_mul(1i64 << k)).min(p.ceiling_ms)
    } else {
        0
    };
    Record {
        fails,
        last: now,
        until: until.max(r.map_or(0, |r| r.until)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn free_failures_then_doubling_locks_up_to_the_ceiling() {
        let mut r: Option<Record> = None;
        let mut now = 1_000_000;
        for _ in 0..4 {
            r = Some(fail(r.as_ref(), now, VISITOR));
            assert!(!locked(r.as_ref(), now));
            now += 1000;
        }
        let mut expect = MINUTE;
        for _ in 0..12 {
            r = Some(fail(r.as_ref(), now, VISITOR));
            assert!(locked(r.as_ref(), now));
            assert_eq!(r.unwrap().until - now, expect.min(VISITOR.ceiling_ms));
            assert!(!locked(r.as_ref(), r.unwrap().until));
            now = r.unwrap().until;
            expect *= 2;
        }
        assert_eq!(r.unwrap().until - (now - 0), 0);
    }

    #[test]
    fn a_quiet_key_is_forgotten() {
        let mut r = None;
        for i in 0..6 {
            r = Some(fail(r.as_ref(), i, VISITOR));
        }
        assert_eq!(r.unwrap().fails, 6);
        let later = fail(r.as_ref(), 5 + VISITOR.forget_ms, VISITOR);
        assert_eq!(later.fails, 1);
        assert!(!locked(Some(&later), 5 + VISITOR.forget_ms));
    }

    #[test]
    fn a_failure_never_shortens_a_lock() {
        let r = Record {
            fails: 1,
            last: 0,
            until: 10 * MINUTE,
        };
        let n = fail(Some(&r), 1, VISITOR);
        assert_eq!(n.until, 10 * MINUTE);
    }

    #[test]
    fn everyone_has_a_wider_allowance() {
        let mut r = None;
        for i in 0..30 {
            r = Some(fail(r.as_ref(), i, EVERYONE));
            assert!(!locked(r.as_ref(), i));
        }
        r = Some(fail(r.as_ref(), 31, EVERYONE));
        assert!(locked(r.as_ref(), 31));
        assert_eq!(r.unwrap().until, 31 + 5 * MINUTE);
    }
}
