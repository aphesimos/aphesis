//! Board: one Durable Object for the whole board (SQLite-backed). It keeps the index of every thread (newest
//! activity first, read a page at a time), the rate-limit buckets (keyed by action and IP hash), and the reports for
//! the admin. Buckets that have refilled are forgotten by an hourly alarm, so nothing about a visitor outlives their
//! activity.
//!
//! The board is permanent: nothing here deletes a thread on its own. A thread leaves the index only when the admin
//! removes its opening post (`/drop`); the alarm touches buckets only, and reports only count.
//!
//! - `threads (id, first, replies, created, bumped, image, seq, owner)`: `owner` is 1 when the opening post is the
//!   owner's; `bumped` is the time of the last post and `seq`
//!   grows with every touch, never given twice. The board's order is `bumped DESC, seq DESC` (newest activity first;
//!   `seq` settles two posts in the same millisecond, or two touches that arrived out of order), and a page ends at
//!   a `(bumped, seq)` the next page starts strictly below: the cursor, `"<bumped>-<seq>"`;
//! - `buckets (key, tokens, at)`;
//! - `reports (thread, n, count, at, seq)`: `seq` is when a post was first reported (newest first);
//! - `schema_version (k, version)`: which of `MIGRATIONS` have run.

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
/// report records kept for the admin (the oldest records go; the posts they point at stay)
const REPORTS_KEPT: i64 = 500;

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS threads (id TEXT PRIMARY KEY, first TEXT NOT NULL, replies INTEGER NOT NULL, created INTEGER, bumped INTEGER NOT NULL, image TEXT, seq INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS threads_seq ON threads (seq);
CREATE TABLE IF NOT EXISTS buckets (key TEXT PRIMARY KEY, tokens REAL NOT NULL, at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS reports (thread TEXT NOT NULL, n INTEGER NOT NULL, count INTEGER NOT NULL, at INTEGER NOT NULL, seq INTEGER NOT NULL, PRIMARY KEY (thread, n));
CREATE TABLE IF NOT EXISTS schema_version (k INTEGER PRIMARY KEY CHECK (k = 1), version INTEGER NOT NULL);
";

/// Schema changes after `v1` (the tables above), each run once, in order, when the object starts. A version is
/// recorded only after its statements ran; every statement is safe to repeat.
///
/// - `v2`: the board keeps every thread and is read a page at a time (`WHERE (bumped, seq) < (?, ?) ORDER BY bumped
///   DESC, seq DESC LIMIT ?`), so the scan walks an index on `(bumped, seq)` and stops after one page, however many
///   threads there are. (`v1`'s index on `seq` stays: it answers `MAX(seq)` for the next touch.)
/// - `v3`: `owner` on each thread, 1 when its opening post is the owner's (every earlier thread at 0). SQLite has no
///   `ADD COLUMN IF NOT EXISTS`, so a repeat of it is told apart by its error (`duplicate column`) and passes.
pub const MIGRATIONS: &[(i64, &str)] = &[
    (
        2,
        "CREATE INDEX IF NOT EXISTS threads_bumped_seq ON threads (bumped, seq);",
    ),
    (
        3,
        "ALTER TABLE threads ADD COLUMN owner INTEGER NOT NULL DEFAULT 0;",
    ),
];

/// the newest schema version
pub const VERSION: i64 = 3;

/// threads on a page of the board: 40 unless asked, never more than 100
pub const PAGE_DEFAULT: i64 = 40;
pub const PAGE_MAX: i64 = 100;

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
    seq: f64,
    #[serde(default)]
    owner: Option<f64>,
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
    owner: bool,
}

#[derive(Deserialize, Serialize)]
struct Report {
    thread: String,
    n: i64,
    count: i64,
    at: i64,
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

/// a place in the board's order: `(bumped, seq)`
pub type Cursor = (i64, i64);

/// the cursor after a thread: `"<bumped>-<seq>"`
pub fn cursor_of(bumped: i64, seq: i64) -> String {
    format!("{bumped}-{seq}")
}

/// a cursor back into `(bumped, seq)`: two runs of 1 to 15 digits joined by `-`, nothing else
pub fn parse_cursor(s: &str) -> Option<Cursor> {
    let (a, b) = s.split_once('-')?;
    let num = |x: &str| {
        ((1..=15).contains(&x.len()) && x.bytes().all(|c| c.is_ascii_digit()))
            .then(|| x.parse().ok())
            .flatten()
    };
    Some((num(a)?, num(b)?))
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

    /// One page of the board, newest activity first: the threads below `cursor` (`(bumped, seq)`; the top without
    /// one), at most `limit`, and the cursor of the next page, `None` at the end.
    fn page(
        &self,
        cursor: Option<Cursor>,
        limit: i64,
    ) -> Result<(Vec<ListedThread>, Option<String>)> {
        let limit = limit.clamp(1, PAGE_MAX);
        // one more than the page, to know whether another follows
        let rows: Vec<ThreadRow> = match cursor {
            Some((bumped, seq)) => self.sql.exec(
                "SELECT id, first, replies, created, bumped, image, seq, owner FROM threads WHERE (bumped, seq) < (?, ?) ORDER BY bumped DESC, seq DESC LIMIT ?",
                vec![bumped.into(), seq.into(), (limit + 1).into()],
            )?,
            None => self.sql.exec(
                "SELECT id, first, replies, created, bumped, image, seq, owner FROM threads ORDER BY bumped DESC, seq DESC LIMIT ?",
                vec![(limit + 1).into()],
            )?,
        }
        .to_array()?;
        let more = rows.len() as i64 > limit;
        let rows: Vec<ThreadRow> = rows.into_iter().take(limit as usize).collect();
        let next = if more {
            rows.last()
                .map(|t| cursor_of(t.bumped as i64, t.seq as i64))
        } else {
            None
        };
        let threads = rows
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
                    owner: t.owner.unwrap_or(0.0) != 0.0,
                }
            })
            .collect();
        Ok((threads, next))
    }

    /// run the migrations this storage has not seen yet
    fn migrate(&self) -> Result<()> {
        #[derive(Deserialize)]
        struct V {
            version: f64,
        }
        let rows: Vec<V> = self
            .sql
            .exec("SELECT version FROM schema_version WHERE k = 1", None)?
            .to_array()?;
        let mut at = rows.first().map(|v| v.version as i64).unwrap_or(1);
        if at > VERSION {
            // storage written by a newer deploy than this one (a rollback): leave it as it is
            worker::console_warn!("board schema v{at} is newer than this code's v{VERSION}");
        }
        for (version, statements) in MIGRATIONS {
            if *version <= at {
                continue;
            }
            if let Err(e) = self.sql.exec(statements, None) {
                // a column added by a run that stopped before recording its version
                if !e.to_string().contains("duplicate column") {
                    return Err(e);
                }
            }
            self.sql.exec(
                "INSERT INTO schema_version (k, version) VALUES (1, ?) ON CONFLICT (k) DO UPDATE SET version = excluded.version",
                vec![(*version).into()],
            )?;
            at = *version;
        }
        Ok(())
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
        let board = Board { state, env, sql };
        if let Err(e) = board.migrate() {
            worker::console_error!("board migration: {e}");
        }
        board
    }

    async fn fetch(&self, mut req: Request) -> Result<Response> {
        let path = req.path();
        let b = body(&mut req).await;
        let now = now_ms();
        match path.as_str() {
            "/list" => {
                let cursor = b["cursor"]
                    .as_array()
                    .and_then(|c| Some((c.first()?.as_i64()?, c.get(1)?.as_i64()?)));
                let limit = b["limit"].as_i64().unwrap_or(PAGE_DEFAULT);
                let (threads, next) = self.page(cursor, limit)?;
                reply(200, &json!({ "threads": threads, "next": next }))
            }
            "/touch" => {
                // a thread was made or answered: move it to the top. Every thread stays; none falls off the end
                let id = b["id"].as_str().unwrap_or_default();
                let e: Entry = serde_json::from_value(b["entry"].clone())?;
                let image: SqlStorageValue = e
                    .image
                    .as_ref()
                    .map(|i| serde_json::to_string(i).unwrap_or_default())
                    .into();
                let seq = self.next_seq("threads")?;
                self.sql.exec(
                    "INSERT INTO threads (id, first, replies, created, bumped, image, seq, owner) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT (id) DO UPDATE SET first = excluded.first, replies = excluded.replies,
                       created = COALESCE(excluded.created, threads.created), bumped = excluded.bumped,
                       image = excluded.image, seq = excluded.seq, owner = excluded.owner",
                    vec![id.into(), e.first.into(), e.replies.into(), e.created.into(), e.bumped.into(), image, seq.into(), (e.owner as i64).into()],
                )?;
                reply(200, &json!({ "ok": true }))
            }
            "/drop" => {
                // the admin removed the thread's opening post: the only way a thread leaves the index
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
            _ => reply(404, &json!({ "error": "not found", "code": "not_found" })),
        }
    }

    /// forget buckets that have refilled; come back in an hour while any remain. Buckets only: no thread, post,
    /// report or picture is ever touched here
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
    use super::{limit_for, MIGRATIONS, VERSION};

    #[test]
    fn migrations_in_order_up_to_the_version() {
        let versions: Vec<i64> = MIGRATIONS.iter().map(|(v, _)| *v).collect();
        assert!(versions.windows(2).all(|w| w[0] < w[1]));
        assert_eq!(versions.first(), Some(&2), "v1 is the schema itself");
        assert_eq!(versions.last(), Some(&VERSION));
        // repeatable, and never a statement that deletes rows
        for (_, s) in MIGRATIONS {
            let up = s.to_uppercase();
            assert!(!up.contains("DELETE") && !up.contains("DROP TABLE"), "{s}");
        }
        assert!(MIGRATIONS[0]
            .1
            .contains("CREATE INDEX IF NOT EXISTS threads_bumped_seq ON threads (bumped, seq)"));
        assert!(MIGRATIONS[1]
            .1
            .contains("ALTER TABLE threads ADD COLUMN owner INTEGER NOT NULL DEFAULT 0"));
    }

    #[test]
    fn cursors_round_trip() {
        use super::{cursor_of, parse_cursor};
        assert_eq!(cursor_of(1762780000000, 412), "1762780000000-412");
        assert_eq!(
            parse_cursor("1762780000000-412"),
            Some((1762780000000, 412))
        );
        assert_eq!(parse_cursor("0-1"), Some((0, 1)));
        for bad in [
            "",
            "-",
            "12",
            "12-",
            "-12",
            "1-2-3",
            "a-1",
            "1-b",
            "+1-2",
            "1 -2",
            "1234567890123456-1",
        ] {
            assert_eq!(parse_cursor(bad), None, "{bad}");
        }
    }

    #[test]
    fn limits_by_key() {
        assert_eq!(limit_for("thread:abc", 2.0, 3.0), 2.0);
        assert_eq!(limit_for("report:abc", 2.0, 3.0), 10.0);
        assert_eq!(limit_for("post:abc", 2.0, 3.0), 3.0);
    }
}
