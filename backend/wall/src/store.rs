//! The Durable Object that keeps the wall in order: one instance ("wall"), SQLite-backed.
//!
//! - `lines (id, text, at, exp)`, indexed on `(at, id)`, so a listing is already chronological (the JavaScript
//!   object used ordered keys `m:<time>:<id>` for the same thing) and on `exp` for the sweep;
//! - `rates (visitor, hits, exp)`: the sliding-window record per visitor hash, and when it can be forgotten.
//!
//! An alarm wakes at the earliest moment something can be forgotten, deletes what has expired, and sets itself for
//! the next one.

use aphesis_common::durable::{alarm_no_later_than, body, reply, set_alarm_at};
use aphesis_common::hash::{hex, random_bytes};
use aphesis_common::ratelimit::window::{self, Record};
use aphesis_common::time::now_ms;
use serde::Deserialize;
use serde_json::{json, Value};
use worker::{durable_object, DurableObject, Env, Request, Response, Result, SqlStorage, State};

use crate::rules::RULE;

/// the most lines a listing returns
const KEEP: i64 = 300;

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS lines (id TEXT PRIMARY KEY, text TEXT NOT NULL, at INTEGER NOT NULL, exp INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS lines_order ON lines (at, id);
CREATE INDEX IF NOT EXISTS lines_exp ON lines (exp);
CREATE TABLE IF NOT EXISTS rates (visitor TEXT PRIMARY KEY, hits TEXT NOT NULL, exp INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS rates_exp ON rates (exp);
";

#[durable_object]
pub struct Wall {
    state: State,
    sql: SqlStorage,
}

#[derive(Deserialize)]
struct Line {
    id: String,
    text: String,
    at: f64,
    exp: f64,
}

#[derive(Deserialize)]
struct Hits {
    hits: String,
}

#[derive(Deserialize)]
struct Min {
    t: Option<f64>,
}

impl Wall {
    fn list(&self, now: i64) -> Result<Vec<Value>> {
        let rows: Vec<Line> = self
            .sql
            .exec(
                "SELECT id, text, at, exp FROM lines ORDER BY at DESC, id DESC LIMIT ?",
                vec![KEEP.into()],
            )?
            .to_array()?;
        Ok(rows
            .into_iter()
            .filter(|m| m.exp > now as f64)
            .map(|m| json!({ "id": m.id, "text": m.text, "at": m.at as i64 }))
            .collect())
    }

    /// the earliest expiry left in either table
    fn next_expiry(&self) -> Result<i64> {
        let rows: Vec<Min> = self
            .sql
            .exec("SELECT MIN(t) AS t FROM (SELECT MIN(exp) AS t FROM lines UNION ALL SELECT MIN(exp) AS t FROM rates WHERE exp > 0)", None)?
            .to_array()?;
        Ok(rows
            .first()
            .and_then(|r| r.t)
            .map(|t| t as i64)
            .unwrap_or(0))
    }
}

impl DurableObject for Wall {
    fn new(state: State, _env: Env) -> Self {
        let sql = state.storage().sql();
        if let Err(e) = sql.exec(SCHEMA, None) {
            worker::console_error!("wall schema: {e}");
        }
        Wall { state, sql }
    }

    async fn fetch(&self, mut req: Request) -> Result<Response> {
        let now = now_ms();
        let path = req.path();
        if path == "/list" {
            return reply(200, &json!({ "messages": self.list(now)? }));
        }
        let b = body(&mut req).await;
        let storage = self.state.storage();

        match path.as_str() {
            "/rate" => {
                let visitor = b["visitor"].as_str().unwrap_or_default();
                let stored: Vec<Hits> = self
                    .sql
                    .exec(
                        "SELECT hits FROM rates WHERE visitor = ?",
                        vec![visitor.into()],
                    )?
                    .to_array()?;
                let record: Option<Record> = stored
                    .first()
                    .and_then(|r| serde_json::from_str(&r.hits).ok());
                let out = window::take(record.as_ref(), now, RULE);
                let exp = window::expires_at(Some(&out.record), RULE);
                let hits =
                    serde_json::to_string(&out.record).unwrap_or_else(|_| "{\"hits\":[]}".into());
                self.sql.exec(
                    "INSERT INTO rates (visitor, hits, exp) VALUES (?, ?, ?) ON CONFLICT (visitor) DO UPDATE SET hits = excluded.hits, exp = excluded.exp",
                    vec![visitor.into(), hits.into(), exp.into()],
                )?;
                alarm_no_later_than(&storage, exp).await?;
                if out.ok {
                    reply(200, &json!({ "ok": true }))
                } else {
                    reply(429, &json!({ "retryAfter": out.retry_after }))
                }
            }
            "/add" => {
                let id = hex(&random_bytes(8));
                let text = b["text"].as_str().unwrap_or_default().to_string();
                let exp = now + b["ttl"].as_f64().unwrap_or(0.0) as i64;
                self.sql.exec(
                    "INSERT INTO lines (id, text, at, exp) VALUES (?, ?, ?, ?)",
                    vec![
                        id.clone().into(),
                        text.clone().into(),
                        now.into(),
                        exp.into(),
                    ],
                )?;
                alarm_no_later_than(&storage, exp).await?;
                reply(
                    200,
                    &json!({ "message": { "id": id, "text": text, "at": now } }),
                )
            }
            "/remove" => {
                let id = b["id"].as_str().unwrap_or_default();
                let found: Vec<Hits> = self
                    .sql
                    .exec("SELECT id AS hits FROM lines WHERE id = ?", vec![id.into()])?
                    .to_array()?;
                if found.is_empty() {
                    return Ok(Response::empty()?.with_status(404));
                }
                self.sql
                    .exec("DELETE FROM lines WHERE id = ?", vec![id.into()])?;
                Ok(Response::empty()?.with_status(204))
            }
            _ => Ok(Response::empty()?.with_status(404)),
        }
    }

    async fn alarm(&self) -> Result<Response> {
        let now = now_ms();
        self.sql
            .exec("DELETE FROM lines WHERE exp <= ?", vec![now.into()])?;
        self.sql
            .exec("DELETE FROM rates WHERE exp <= ?", vec![now.into()])?;
        let next = self.next_expiry()?;
        if next > 0 {
            set_alarm_at(&self.state.storage(), next).await?;
        }
        Response::empty()
    }
}
