//! Thread: one Durable Object per thread (SQLite-backed). It holds the thread's posts in order and is their only
//! writer, so numbers are given out one at a time and never twice.
//!
//! Tables are made by the first post, so asking for a thread that does not exist leaves no storage behind:
//! `meta (id, created, bumped, count)`, one row, and `posts (n, poster, text, created, image, reports, removed)`.
//! The thread is kept for good: nothing here expires. Only the admin removing the opening post deletes everything
//! (`deleteAll`); removing a later post blanks that post alone. A thread holds at most `MAX_POSTS` posts of at most
//! 2000 characters, so one object stays small (a few MB at worst) however long the board lives.

use aphesis_common::durable::{body, reply};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use worker::{
    durable_object, DurableObject, Env, Request, Response, Result, SqlStorage, SqlStorageValue,
    State,
};

use crate::model::{Image, NewPost, PublicImage};

pub const MAX_POSTS: i64 = 500;

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS meta (k INTEGER PRIMARY KEY CHECK (k = 1), id TEXT NOT NULL, created INTEGER NOT NULL, bumped INTEGER NOT NULL, count INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS posts (n INTEGER PRIMARY KEY, poster TEXT, text TEXT, created INTEGER NOT NULL, image TEXT, reports INTEGER NOT NULL DEFAULT 0, removed INTEGER NOT NULL DEFAULT 0);
";

#[durable_object]
pub struct Thread {
    state: State,
    sql: SqlStorage,
}

#[derive(Deserialize)]
struct Meta {
    id: String,
    created: f64,
    count: f64,
}

#[derive(Deserialize)]
struct Row {
    n: f64,
    poster: Option<String>,
    text: Option<String>,
    created: f64,
    image: Option<String>,
    removed: f64,
}

impl Row {
    fn image(&self) -> Option<Image> {
        self.image
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok())
    }
}

/// What the public sees of a post: no report counts, image keys turned into URLs.
#[derive(Serialize)]
#[serde(untagged)]
pub enum PublicPost {
    Removed {
        n: i64,
        created: i64,
        removed: bool,
    },
    Shown {
        n: i64,
        poster: String,
        text: String,
        created: i64,
        #[serde(skip_serializing_if = "Option::is_none")]
        image: Option<PublicImage>,
    },
}

fn public(p: &Row) -> PublicPost {
    if p.removed != 0.0 {
        return PublicPost::Removed {
            n: p.n as i64,
            created: p.created as i64,
            removed: true,
        };
    }
    PublicPost::Shown {
        n: p.n as i64,
        poster: p.poster.clone().unwrap_or_default(),
        text: p.text.clone().unwrap_or_default(),
        created: p.created as i64,
        image: p.image().as_ref().map(PublicImage::from),
    }
}

fn not_found(msg: &str) -> Result<Response> {
    reply(404, &json!({ "error": msg }))
}

impl Thread {
    /// None while the thread has never been made (no tables) or has been deleted.
    fn meta(&self) -> Option<Meta> {
        let rows: Vec<Meta> = self
            .sql
            .exec("SELECT id, created, count FROM meta WHERE k = 1", None)
            .ok()?
            .to_array()
            .ok()?;
        rows.into_iter().next()
    }

    fn post(&self, n: i64) -> Result<Option<Row>> {
        let rows: Vec<Row> = self
            .sql
            .exec(
                "SELECT n, poster, text, created, image, removed FROM posts WHERE n = ?",
                vec![n.into()],
            )?
            .to_array()?;
        Ok(rows.into_iter().next())
    }

    fn all(&self) -> Result<Vec<Row>> {
        self.sql
            .exec(
                "SELECT n, poster, text, created, image, removed FROM posts ORDER BY n",
                None,
            )?
            .to_array()
    }

    fn image_keys(&self) -> Result<Vec<String>> {
        let mut keys = Vec::new();
        for p in self.all()? {
            if let Some(i) = p.image() {
                keys.push(i.density);
                keys.push(i.original);
            }
        }
        Ok(keys)
    }

    fn insert(&self, n: i64, p: &NewPost) -> Result<()> {
        let image: SqlStorageValue = p
            .image
            .as_ref()
            .map(|i| serde_json::to_string(i).unwrap_or_default())
            .into();
        self.sql.exec(
            "INSERT INTO posts (n, poster, text, created, image) VALUES (?, ?, ?, ?, ?)",
            vec![
                n.into(),
                p.poster.clone().into(),
                p.text.clone().into(),
                p.created.into(),
                image,
            ],
        )?;
        Ok(())
    }
}

impl DurableObject for Thread {
    fn new(state: State, _env: Env) -> Self {
        let sql = state.storage().sql();
        Thread { state, sql }
    }

    async fn fetch(&self, mut req: Request) -> Result<Response> {
        let path = req.path();
        let b = body(&mut req).await;
        let meta = self.meta();
        match path.as_str() {
            "/get" => {
                let Some(m) = meta else {
                    return not_found("this thread is gone");
                };
                let posts: Vec<PublicPost> = self.all()?.iter().map(public).collect();
                reply(
                    200,
                    &json!({ "id": m.id, "created": m.created as i64, "posts": posts }),
                )
            }
            "/create" => {
                if meta.is_some() {
                    return reply(409, &json!({ "error": "exists" }));
                }
                let post: NewPost = serde_json::from_value(b["post"].clone())?;
                let id = b["id"].as_str().unwrap_or_default();
                self.sql.exec(SCHEMA, None)?;
                self.sql.exec(
                    "INSERT INTO meta (k, id, created, bumped, count) VALUES (1, ?, ?, ?, 1)",
                    vec![id.into(), post.created.into(), post.created.into()],
                )?;
                self.insert(1, &post)?;
                reply(200, &json!({ "n": 1 }))
            }
            "/post" => {
                let Some(m) = meta else {
                    return not_found("this thread is gone");
                };
                if m.count as i64 >= MAX_POSTS {
                    return reply(409, &json!({ "error": "this thread is full" }));
                }
                let n = m.count as i64 + 1;
                let post: NewPost = serde_json::from_value(b["post"].clone())?;
                self.sql.exec(
                    "UPDATE meta SET count = ?, bumped = ? WHERE k = 1",
                    vec![n.into(), post.created.into()],
                )?;
                self.insert(n, &post)?;
                let first = self.post(1)?.filter(|p| p.removed == 0.0);
                let summary = json!({
                    "first": first.as_ref().and_then(|p| p.text.clone()).unwrap_or_default(),
                    "firstImage": first.as_ref().and_then(Row::image),
                    "replies": n - 1,
                });
                reply(200, &json!({ "n": n, "summary": summary }))
            }
            "/report" => {
                let n = b["n"].as_i64().unwrap_or(0);
                let p = if meta.is_some() { self.post(n)? } else { None };
                match p {
                    Some(p) if p.removed == 0.0 => {
                        self.sql.exec(
                            "UPDATE posts SET reports = reports + 1 WHERE n = ?",
                            vec![n.into()],
                        )?;
                        let r: Vec<Value> = self
                            .sql
                            .exec("SELECT reports FROM posts WHERE n = ?", vec![n.into()])?
                            .to_array()?;
                        reply(
                            200,
                            &json!({ "reports": r.first().map(|v| v["reports"].clone()).unwrap_or(Value::Null) }),
                        )
                    }
                    _ => not_found("no such post"),
                }
            }
            "/remove" => {
                let n = b["n"].as_i64().unwrap_or(0);
                let p = if meta.is_some() { self.post(n)? } else { None };
                let Some(p) = p else {
                    return not_found("no such post");
                };
                let mut keys: Vec<String> = p
                    .image()
                    .map(|i| vec![i.density, i.original])
                    .unwrap_or_default();
                if n == 1 {
                    // the opening post takes the thread with it
                    keys.extend(self.image_keys()?);
                    let mut seen = std::collections::HashSet::new();
                    keys.retain(|k| seen.insert(k.clone()));
                    self.state.storage().delete_all().await?;
                    return reply(200, &json!({ "gone": true, "keys": keys }));
                }
                self.sql.exec(
                    "UPDATE posts SET poster = NULL, text = NULL, image = NULL, reports = 0, removed = 1 WHERE n = ?",
                    vec![n.into()],
                )?;
                reply(200, &json!({ "gone": false, "keys": keys }))
            }
            _ => not_found("not found"),
        }
    }
}
