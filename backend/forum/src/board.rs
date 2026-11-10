//! Board: one Durable Object for the whole board (SQLite-backed). It keeps the index of threads (newest activity
//! first, at most `BOARD_LIMIT`), the rate-limit buckets (keyed by action and IP hash), and the reports for the
//! admin. Buckets that have refilled are forgotten by an hourly alarm, so nothing about a visitor outlives their
//! activity.
//!
//! - `threads (id, first, replies, created, bumped, image, seq)`: `seq` grows with every touch, so `ORDER BY seq
//!   DESC` is the order the JavaScript object kept by moving a thread to the front of its array;
//! - `buckets (key, tokens, at)`;
//! - `reports (thread, n, count, at, seq)`: `seq` is when a post was first reported (newest first).

use aphesis_common::durable::{alarm_no_later_than, body, reply, set_alarm_at};
use aphesis_common::env;
use aphesis_common::ratelimit::bucket::{self, Bucket};
use aphesis_common::time::now_ms;
use serde::{Deserialize, Serialize};
use serde_json::json;
use worker::{
    durable_object, DurableObject, Env, Request, Response, Result, SqlStorage, SqlStorageValue,
    State,
};

use crate::model::{Entry, Image, PublicImage};

const HOUR: i64 = 3_600_000;
const REPORTS_KEPT: i64 = 500;

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS threads (id TEXT PRIMARY KEY, first TEXT NOT NULL, replies INTEGER NOT NULL, created INTEGER, bumped INTEGER NOT NULL, image TEXT, seq INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS threads_seq ON threads (seq);
CREATE TABLE IF NOT EXISTS buckets (key TEXT PRIMARY KEY, tokens REAL NOT NULL, at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS reports (thread TEXT NOT NULL, n INTEGER NOT NULL, count INTEGER NOT NULL, at INTEGER NOT NULL, seq INTEGER NOT NULL, PRIMARY KEY (thread, n));
";

#[durable_object]
pub struct Board {
    state: State,
    env: Env,
    sql: SqlStorage,
}

#[derive(Deserialize)]
struct ThreadRow {
    id: String,
    first: String,
    replies: f64,
    created: Option<f64>,
    bumped: f64,
    image: Option<String>,
}

#[derive(Serialize)]
struct ListedThread {
    id: String,
    first: String,
    replies: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    created: Option<i64>,
    bumped: i64,
    image: Option<PublicImage>,
}

#[derive(Deserialize, Serialize)]
struct Report {
    thread: String,
    n: i64,
    count: i64,
    at: i64,
}

#[derive(Deserialize)]
struct Id {
    id: String,
}

#[derive(Deserialize)]
struct KeyedBucket {
    key: String,
    tokens: f64,
    at: f64,
}

/// The limit a bucket key was made under: `thread:` keys use RATE_THREADS, `report:` 10, the rest RATE_POSTS.
pub fn limit_for(key: &str, rate_threads: f64, rate_posts: f64) -> f64 {
    if key.starts_with("thread:") {
        rate_threads
    } else if key.starts_with("report:") {
        10.0
    } else {
        rate_posts
    }
}

impl Board {
    fn next_seq(&self, table: &str) -> Result<i64> {
        #[derive(Deserialize)]
        struct S {
            s: f64,
        }
        let rows: Vec<S> = self
            .sql
            .exec(
                &format!("SELECT COALESCE(MAX(seq), 0) + 1 AS s FROM {table}"),
                None,
            )?
            .to_array()?;
        Ok(rows.first().map(|r| r.s as i64).unwrap_or(1))
    }

    fn list(&self) -> Result<Vec<ListedThread>> {
        let rows: Vec<ThreadRow> = self
            .sql
            .exec(
                "SELECT id, first, replies, created, bumped, image FROM threads ORDER BY seq DESC",
                None,
            )?
            .to_array()?;
        Ok(rows
            .into_iter()
            .map(|t| {
                let image: Option<Image> = t
                    .image
                    .as_deref()
                    .and_then(|s| serde_json::from_str(s).ok());
                ListedThread {
                    id: t.id,
                    first: t.first,
                    replies: t.replies as i64,
                    created: t.created.map(|c| c as i64),
                    bumped: t.bumped as i64,
                    image: image.as_ref().map(PublicImage::from),
                }
            })
            .collect())
    }

    fn rates(&self) -> (f64, f64, f64) {
        (
            env::number(&self.env, "RATE_WINDOW_SECONDS", 120.0) * 1000.0,
            env::number(&self.env, "RATE_THREADS", 1.0),
            env::number(&self.env, "RATE_POSTS", 4.0),
        )
    }
}

impl DurableObject for Board {
    fn new(state: State, env: Env) -> Self {
        let sql = state.storage().sql();
        if let Err(e) = sql.exec(SCHEMA, None) {
            worker::console_error!("board schema: {e}");
        }
        Board { state, env, sql }
    }

    async fn fetch(&self, mut req: Request) -> Result<Response> {
        let path = req.path();
        let b = body(&mut req).await;
        let now = now_ms();
        match path.as_str() {
            "/list" => reply(200, &json!({ "threads": self.list()? })),
            "/touch" => {
                // a thread was made or answered: move it to the top; return the ids that fell off the end
                let id = b["id"].as_str().unwrap_or_default();
                let e: Entry = serde_json::from_value(b["entry"].clone())?;
                let image: SqlStorageValue = e
                    .image
                    .as_ref()
                    .map(|i| serde_json::to_string(i).unwrap_or_default())
                    .into();
                let seq = self.next_seq("threads")?;
                self.sql.exec(
                    "INSERT INTO threads (id, first, replies, created, bumped, image, seq) VALUES (?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT (id) DO UPDATE SET first = excluded.first, replies = excluded.replies,
                       created = COALESCE(excluded.created, threads.created), bumped = excluded.bumped,
                       image = excluded.image, seq = excluded.seq",
                    vec![id.into(), e.first.into(), e.replies.into(), e.created.into(), e.bumped.into(), image, seq.into()],
                )?;
                let limit = env::number(&self.env, "BOARD_LIMIT", 120.0).max(0.0) as i64;
                let dropped: Vec<Id> = self
                    .sql
                    .exec(
                        "SELECT id FROM threads ORDER BY seq DESC LIMIT -1 OFFSET ?",
                        vec![limit.into()],
                    )?
                    .to_array()?;
                for d in &dropped {
                    self.sql.exec(
                        "DELETE FROM threads WHERE id = ?",
                        vec![d.id.clone().into()],
                    )?;
                }
                let dropped: Vec<String> = dropped.into_iter().map(|d| d.id).collect();
                reply(200, &json!({ "dropped": dropped }))
            }
            "/drop" => {
                self.sql.exec(
                    "DELETE FROM threads WHERE id = ?",
                    vec![b["id"].as_str().unwrap_or_default().into()],
                )?;
                reply(200, &json!({ "ok": true }))
            }
            "/limit" => {
                let key = format!("rl:{}", b["key"].as_str().unwrap_or_default());
                let rule = bucket::Rule {
                    limit: b["limit"].as_f64().unwrap_or(1.0),
                    window_ms: b["windowMs"].as_f64().unwrap_or(120_000.0),
                };
                let stored: Vec<Bucket> = self
                    .sql
                    .exec(
                        "SELECT tokens, at FROM buckets WHERE key = ?",
                        vec![key.clone().into()],
                    )?
                    .to_array()?;
                let out = bucket::take(stored.first(), now as f64, rule);
                self.sql.exec(
                    "INSERT INTO buckets (key, tokens, at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET tokens = excluded.tokens, at = excluded.at",
                    vec![key.into(), out.bucket.tokens.into(), out.bucket.at.into()],
                )?;
                if self.state.storage().get_alarm().await?.is_none() {
                    alarm_no_later_than(&self.state.storage(), now + HOUR).await?;
                }
                reply(
                    200,
                    &json!({ "allowed": out.allowed, "retryAfter": out.retry_after }),
                )
            }
            "/report" => {
                let thread = b["thread"].as_str().unwrap_or_default().to_string();
                let n = b["n"].as_i64().unwrap_or(0);
                let seq = self.next_seq("reports")?;
                self.sql.exec(
                    "INSERT INTO reports (thread, n, count, at, seq) VALUES (?, ?, 1, ?, ?)
                     ON CONFLICT (thread, n) DO UPDATE SET count = reports.count + 1, at = excluded.at",
                    vec![thread.into(), n.into(), now.into(), seq.into()],
                )?;
                self.sql.exec(
                    "DELETE FROM reports WHERE seq NOT IN (SELECT seq FROM reports ORDER BY seq DESC LIMIT ?)",
                    vec![REPORTS_KEPT.into()],
                )?;
                reply(200, &json!({ "ok": true }))
            }
            "/reports" => {
                let reports: Vec<Report> = self
                    .sql
                    .exec(
                        "SELECT thread, n, count, at FROM reports ORDER BY seq DESC",
                        None,
                    )?
                    .to_array()?;
                reply(200, &json!({ "reports": reports }))
            }
            "/resolve" => {
                let thread = b["thread"].as_str().unwrap_or_default();
                let n = b["n"].as_i64().unwrap_or(0);
                self.sql.exec(
                    "DELETE FROM reports WHERE thread = ? AND (? = 1 OR n = ?)",
                    vec![thread.into(), n.into(), n.into()],
                )?;
                reply(200, &json!({ "ok": true }))
            }
            _ => reply(404, &json!({ "error": "not found" })),
        }
    }

    /// forget buckets that have refilled; come back in an hour while any remain
    async fn alarm(&self) -> Result<Response> {
        let now = now_ms() as f64;
        let (window_ms, threads, posts) = self.rates();
        let all: Vec<KeyedBucket> = self
            .sql
            .exec("SELECT key, tokens, at FROM buckets", None)?
            .to_array()?;
        let mut kept = 0;
        for k in &all {
            let limit = limit_for(k.key.trim_start_matches("rl:"), threads, posts);
            let b = Bucket {
                tokens: k.tokens,
                at: k.at,
            };
            if bucket::is_full(Some(&b), now, bucket::Rule { limit, window_ms }) {
                self.sql.exec(
                    "DELETE FROM buckets WHERE key = ?",
                    vec![k.key.clone().into()],
                )?;
            } else {
                kept += 1;
            }
        }
        if kept > 0 {
            set_alarm_at(&self.state.storage(), now as i64 + HOUR).await?;
        }
        Response::empty()
    }
}

#[cfg(test)]
mod tests {
    use super::limit_for;

    #[test]
    fn limits_by_key() {
        assert_eq!(limit_for("thread:abc", 2.0, 3.0), 2.0);
        assert_eq!(limit_for("report:abc", 2.0, 3.0), 10.0);
        assert_eq!(limit_for("post:abc", 2.0, 3.0), 3.0);
    }
}
