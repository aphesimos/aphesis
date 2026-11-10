//! forum · ἀγορά: the Worker. Routes, CORS for the site's origins, Turnstile, rate limits per IP hash, upload
//! checks, R2 for pictures (the original and its density map), reports, and removal behind the admin secret.
//!
//! ```text
//! GET    /api/board                          the threads, newest activity first
//! GET    /api/threads/:id                    one thread, its posts in order
//! POST   /api/threads                        a new thread   (multipart: text, image?, density?, w?, h?, turnstile?)
//! POST   /api/threads/:id/posts              a reply        (the same fields)
//! POST   /api/threads/:id/posts/:n/report    report a post
//! GET    /api/images/t/:id/:file             a picture from R2
//! GET    /api/admin/reports                  reports        (Authorization: Bearer ADMIN_SECRET)
//! DELETE /api/threads/:id/posts/:n           remove a post; post 1 removes the thread (admin)
//! ```
//!
//! Bindings: `THREADS`, `BOARD` (Durable Objects), `IMAGES` (R2). Secrets: `IP_SALT`, `POSTER_SALT`,
//! `TURNSTILE_SECRET`, `ADMIN_SECRET`. Vars: `ALLOWED_ORIGINS`, `RATE_POSTS`, `RATE_THREADS`,
//! `RATE_WINDOW_SECONDS`, `BOARD_LIMIT`, `ALLOW_NO_TURNSTILE` (local only).
//!
//! The same HTTP contract as the JavaScript Worker it replaces (`section/forum`: `forum/worker/src/index.js`), so
//! the page works unchanged. One deliberate difference: without `TURNSTILE_SECRET` the JavaScript skipped the check;
//! here it is skipped only when `ALLOW_NO_TURNSTILE` is also "1", so a deploy that has no secret yet refuses posts
//! instead of taking them unchecked. And without `IP_SALT` or `POSTER_SALT`, posts and reports get `503` (the
//! JavaScript hashed with an empty salt), so no reversible hash of an address is ever stored.

mod board;
pub mod model;
mod thread;
pub mod tokens;
pub mod validate;

pub use board::Board;
pub use thread::Thread;

use aphesis_common::{cors::Cors, durable::call, env, http, secret, time::now_ms, turnstile};
use serde_json::{json, Value};
use worker::{
    event, Context, Env, FormEntry, HttpMetadata, Method, Request, Response, Result, Stub,
};

use model::{Entry, Image, NewPost};

/// the refusal while IP_SALT or POSTER_SALT is missing
const NOT_SET_UP: &str = "the board is not open yet";
const MAX_BODY: f64 = 5.0 * 1024.0 * 1024.0;

struct Ctx {
    env: Env,
    cors: Cors,
    h: http::Headers,
}

impl Ctx {
    fn json(&self, status: u16, v: &Value, extra: &http::Headers) -> Result<Response> {
        let h = http::Headers::new()
            .with("content-type", "application/json; charset=utf-8")
            .with("cache-control", "no-store")
            .with("x-content-type-options", "nosniff")
            .merge(&self.h)
            .merge(extra);
        http::json(status, v, &h)
    }
    fn ok(&self, v: &Value) -> Result<Response> {
        self.json(200, v, &http::Headers::new())
    }
    fn fail(&self, status: u16, error: &str) -> Result<Response> {
        self.json(status, &json!({ "error": error }), &http::Headers::new())
    }
    fn board(&self) -> Result<Stub> {
        self.env.durable_object("BOARD")?.get_by_name("board")
    }
    fn thread(&self, id: &str) -> Result<Stub> {
        self.env.durable_object("THREADS")?.get_by_name(id)
    }
    fn var(&self, name: &str) -> Option<String> {
        env::string(&self.env, name)
    }
    fn is_admin(&self, req: &Request) -> bool {
        let h = req
            .headers()
            .get("Authorization")
            .ok()
            .flatten()
            .unwrap_or_default();
        secret::bearer_loose(&h, self.var("ADMIN_SECRET").as_deref())
    }
    /// Both salts are set. Without them a hash of an address could be reversed by trying every address, so the
    /// Worker takes nothing that would store one (a deploy before its secrets, for a moment).
    fn salted(&self) -> bool {
        self.var("IP_SALT").is_some() && self.var("POSTER_SALT").is_some()
    }
    fn ip_hash(&self, req: &Request) -> String {
        let ip = req.headers().get("CF-Connecting-IP").ok().flatten();
        tokens::ip_hash(ip.as_deref(), self.var("IP_SALT").as_deref())
    }

    /// seconds to wait, or 0 when this attempt may pass
    async fn limited(&self, kind: &str, ip_hash: &str) -> Result<i64> {
        let window_ms = env::number(&self.env, "RATE_WINDOW_SECONDS", 120.0) * 1000.0;
        let limit = match kind {
            "thread" => env::number(&self.env, "RATE_THREADS", 1.0),
            "report" => 10.0,
            _ => env::number(&self.env, "RATE_POSTS", 4.0),
        };
        let (_, r) = call(&self.board()?, "/limit", Some(&json!({ "key": format!("{kind}:{ip_hash}"), "limit": limit, "windowMs": window_ms }))).await?;
        if r["allowed"].as_bool() == Some(true) {
            Ok(0)
        } else {
            Ok(r["retryAfter"].as_i64().unwrap_or(1).max(1))
        }
    }

    async fn turnstile(&self, token: Option<String>) -> bool {
        let Some(secret) = self.var("TURNSTILE_SECRET") else {
            return self.var("ALLOW_NO_TURNSTILE").as_deref() == Some("1");
        };
        match token.filter(|t| !t.is_empty()) {
            Some(t) => turnstile::siteverify(&secret, turnstile::js_slice(&t, 2048), None).await,
            None => false,
        }
    }
}

/// `String(form.get(name))` for a text field: a file reads as "[object File]", as in JavaScript
fn field(e: Option<FormEntry>) -> Option<String> {
    match e? {
        FormEntry::Field(s) => Some(s),
        FormEntry::File(_) => Some("[object File]".into()),
    }
}

/// the bytes of a file field; a plain text field is no file
async fn file(e: Option<FormEntry>) -> Result<Option<Vec<u8>>> {
    match e {
        Some(FormEntry::File(f)) => Ok(Some(f.bytes().await?)),
        _ => Ok(None),
    }
}

async fn handle_post(c: &Ctx, mut req: Request, thread_id: Option<&str>) -> Result<Response> {
    let len = req
        .headers()
        .get("content-length")?
        .and_then(|s| s.trim().parse::<f64>().ok())
        .unwrap_or(0.0);
    if len > MAX_BODY {
        return c.fail(413, "too large");
    }
    if let Some(o) = req.headers().get("Origin")? {
        if !c.cors.allows(&o) {
            return c.fail(403, "not from this site");
        }
    }
    if !c.salted() {
        return c.fail(503, NOT_SET_UP);
    }
    let ip_h = c.ip_hash(&req);
    let wait = c
        .limited(
            if thread_id.is_some() {
                "post"
            } else {
                "thread"
            },
            &ip_h,
        )
        .await?;
    if wait > 0 {
        let extra = http::Headers::new().with("Retry-After", &wait.to_string());
        return c.json(
            429,
            &json!({ "error": format!("slowly: try again in {wait} s") }),
            &extra,
        );
    }

    let Ok(form) = req.form_data().await else {
        return c.fail(400, "unreadable form");
    };
    if !c.turnstile(field(form.get("turnstile"))).await {
        return c.fail(403, "the check did not pass");
    }

    let orig = file(form.get("image")).await?;
    let dens = file(form.get("density")).await?;
    let required = thread_id.is_none() || orig.is_none();
    let text = match validate::check_text(&field(form.get("text")).unwrap_or_default(), required) {
        Ok(t) => t,
        Err(e) => return c.fail(400, &e),
    };

    let mut pictures = None;
    if let Some(o) = orig.as_deref() {
        let a = match validate::check_original(o) {
            Ok(a) => a,
            Err(e) => return c.fail(400, e),
        };
        let d = match validate::check_density(dens.as_deref()) {
            Ok(d) => d,
            Err(e) => return c.fail(400, e),
        };
        pictures = Some((a, d));
    } else if dens.is_some() {
        return c.fail(400, "a density map needs its original");
    }

    let id = thread_id
        .map(String::from)
        .unwrap_or_else(|| tokens::random_id(10));
    let thread = c.thread(&id)?;
    if thread_id.is_some() {
        let (status, _) = call::<Value>(&thread, "/get", None).await?;
        if status != 200 {
            return c.fail(404, "this thread is gone");
        }
    }

    let mut post = NewPost {
        poster: tokens::poster_token(c.var("POSTER_SALT").as_deref(), &id, &ip_h),
        text,
        created: now_ms(),
        image: None,
    };
    let mut keys = Vec::new();
    let images = c.env.bucket("IMAGES")?;
    if let (Some((a, d)), Some(o), Some(dn)) = (pictures, orig, dens) {
        let base = format!("t/{id}/{}", tokens::random_id(12));
        let ko = format!("{base}.{}", a.kind.ext());
        let kd = format!("{base}.density.{}", d.kind.ext());
        let meta = |m: &str| HttpMetadata {
            content_type: Some(m.to_string()),
            ..Default::default()
        };
        images
            .put(&ko, o)
            .http_metadata(meta(a.kind.mime()))
            .execute()
            .await?;
        images
            .put(&kd, dn)
            .http_metadata(meta(d.kind.mime()))
            .execute()
            .await?;
        keys.push(ko.clone());
        keys.push(kd.clone());
        post.image = Some(Image {
            original: ko,
            density: kd,
            w: d.width,
            h: d.height,
        });
    }

    let (status, r) = match thread_id {
        Some(_) => call(&thread, "/post", Some(&json!({ "post": post }))).await?,
        None => call(&thread, "/create", Some(&json!({ "id": id, "post": post }))).await?,
    };
    if status != 200 {
        if !keys.is_empty() {
            images.delete_multiple(keys).await?;
        }
        return c.fail(status, r["error"].as_str().unwrap_or("not posted"));
    }
    let entry = match thread_id {
        Some(_) => Entry {
            created: None,
            bumped: post.created,
            replies: r["summary"]["replies"].as_i64().unwrap_or(0),
            first: r["summary"]["first"]
                .as_str()
                .unwrap_or_default()
                .to_string(),
            image: serde_json::from_value(r["summary"]["firstImage"].clone()).unwrap_or(None),
        },
        None => Entry {
            created: Some(post.created),
            bumped: post.created,
            replies: 0,
            first: post.text.clone(),
            image: post.image.clone(),
        },
    };
    let (_, t) = call(
        &c.board()?,
        "/touch",
        Some(&json!({ "id": id, "entry": entry })),
    )
    .await?;
    for old in t["dropped"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
    {
        let (_, p) = call(&c.thread(old)?, "/purge", Some(&json!({}))).await?;
        let gone: Vec<String> = p["keys"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|k| k.as_str().map(String::from))
            .collect();
        if !gone.is_empty() {
            images.delete_multiple(gone).await?;
        }
    }
    c.json(
        201,
        &json!({ "thread": id, "n": r["n"] }),
        &http::Headers::new(),
    )
}

/// `/^\d{1,6}$/`
fn post_number(s: Option<&str>) -> Option<i64> {
    let s = s?;
    ((1..=6).contains(&s.len()) && s.bytes().all(|b| b.is_ascii_digit())).then(|| s.parse().ok())?
}

/// `/^[a-z2-9]{12}(\.density)?\.(jpg|png|gif|webp)$/`
fn image_file(s: &str) -> bool {
    let (stem, ext) = match s.rsplit_once('.') {
        Some(p) => p,
        None => return false,
    };
    if !matches!(ext, "jpg" | "png" | "gif" | "webp") {
        return false;
    }
    let name = stem.strip_suffix(".density").unwrap_or(stem);
    name.len() == 12
        && name
            .bytes()
            .all(|b| b.is_ascii_lowercase() || (b'2'..=b'9').contains(&b))
}

/// the path's segments after the leading slash, trailing slashes dropped; empty segments read as absent
fn segments(path: &str) -> Vec<Option<&str>> {
    let p = path.trim_end_matches('/');
    p.split('/')
        .skip(1)
        .map(|s| (!s.is_empty()).then_some(s))
        .collect()
}

async fn route(c: &Ctx, req: Request) -> Result<Response> {
    let path = req.path();
    let parts = segments(&path);
    let seg = |i: usize| parts.get(i).copied().flatten();
    if seg(0) != Some("api") {
        return c.fail(404, "not found");
    }
    let (a, b, cc, d, e) = (seg(1), seg(2), seg(3), seg(4), seg(5));
    let method = req.method();

    if method == Method::Get && a == Some("board") && b.is_none() {
        let (_, body) = call::<Value>(&c.board()?, "/list", None).await?;
        return c.json(
            200,
            &body,
            &http::Headers::new().with("cache-control", "public, max-age=5"),
        );
    }
    if a == Some("threads") && b.is_some_and(|b| !tokens::is_thread_id(b)) {
        return c.fail(404, "this thread is gone");
    }
    if let (Method::Get, Some("threads"), Some(id), None) = (method.clone(), a, b, cc) {
        let (status, body) = call::<Value>(&c.thread(id)?, "/get", None).await?;
        return c.json(status, &body, &http::Headers::new());
    }
    if method == Method::Post && a == Some("threads") && b.is_none() {
        return handle_post(c, req, None).await;
    }
    if method == Method::Post && a == Some("threads") && cc == Some("posts") && d.is_none() {
        return handle_post(c, req, b).await;
    }
    if let (Method::Post, Some("threads"), Some("posts"), Some(n), Some("report")) =
        (method.clone(), a, cc, post_number(d), e)
    {
        let b = b.unwrap_or_default();
        if !c.salted() {
            return c.fail(503, NOT_SET_UP);
        }
        let wait = c.limited("report", &c.ip_hash(&req)).await?;
        if wait > 0 {
            return c.json(
                429,
                &json!({ "error": "slowly" }),
                &http::Headers::new().with("Retry-After", &wait.to_string()),
            );
        }
        let (status, r) = call(&c.thread(b)?, "/report", Some(&json!({ "n": n }))).await?;
        if status != 200 {
            return c.fail(status, r["error"].as_str().unwrap_or_default());
        }
        call(
            &c.board()?,
            "/report",
            Some(&json!({ "thread": b, "n": n })),
        )
        .await?;
        return c.ok(&json!({ "ok": true }));
    }
    if let (Method::Delete, Some("threads"), Some("posts"), Some(n)) =
        (method.clone(), a, cc, post_number(d))
    {
        if !c.is_admin(&req) {
            return c.fail(403, "not allowed");
        }
        let b = b.unwrap_or_default();
        let (status, r) = call(&c.thread(b)?, "/remove", Some(&json!({ "n": n }))).await?;
        if status != 200 {
            return c.fail(status, r["error"].as_str().unwrap_or_default());
        }
        let keys: Vec<String> = r["keys"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|k| k.as_str().map(String::from))
            .collect();
        if !keys.is_empty() {
            c.env.bucket("IMAGES")?.delete_multiple(keys).await?;
        }
        let gone = r["gone"].as_bool() == Some(true);
        if gone {
            call(&c.board()?, "/drop", Some(&json!({ "id": b }))).await?;
        }
        call(
            &c.board()?,
            "/resolve",
            Some(&json!({ "thread": b, "n": n })),
        )
        .await?;
        return c.ok(&json!({ "ok": true, "thread": if gone { "removed" } else { "kept" } }));
    }
    if method == Method::Get && a == Some("admin") && b == Some("reports") {
        if !c.is_admin(&req) {
            return c.fail(403, "not allowed");
        }
        let (_, body) = call::<Value>(&c.board()?, "/reports", None).await?;
        return c.ok(&body);
    }
    if method == Method::Get
        && a == Some("images")
        && b == Some("t")
        && cc.is_some_and(tokens::is_thread_id)
        && d.is_some_and(image_file)
        && e.is_none()
    {
        let key = format!("t/{}/{}", cc.unwrap(), d.unwrap());
        let Some(obj) = c.env.bucket("IMAGES")?.get(key).execute().await? else {
            return c.fail(404, "no such picture");
        };
        let ctype = obj
            .http_metadata()
            .content_type
            .unwrap_or_else(|| "application/octet-stream".into());
        let h = http::Headers::new()
            .with("content-type", &ctype)
            .with("cache-control", "public, max-age=31536000, immutable")
            .with("x-content-type-options", "nosniff")
            .with("content-security-policy", "default-src 'none'; sandbox")
            .with("content-disposition", "inline")
            .with("cross-origin-resource-policy", "cross-origin")
            .merge(&c.h);
        let body = match obj.body() {
            Some(b) => b.response_body()?,
            None => return c.fail(404, "no such picture"),
        };
        return Ok(Response::from_body(body)?.with_headers(h.to_worker()));
    }
    c.fail(404, "not found")
}

#[event(fetch)]
async fn fetch(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    let cors = Cors::new(&env::string(&env, "ALLOWED_ORIGINS").unwrap_or_default());
    let h = cors.headers_for(req.headers().get("Origin")?.as_deref());
    if req.method() == Method::Options {
        return http::empty(204, &h);
    }
    let c = Ctx { env, cors, h };
    match route(&c, req).await {
        Ok(r) => Ok(r),
        Err(e) => {
            worker::console_error!("forum: {e}");
            c.fail(500, "the board stumbled")
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paths() {
        assert_eq!(segments("/api/board/"), vec![Some("api"), Some("board")]);
        assert_eq!(segments("/"), Vec::<Option<&str>>::new());
        assert_eq!(segments("/api//x"), vec![Some("api"), None, Some("x")]);
        assert_eq!(post_number(Some("12")), Some(12));
        assert_eq!(post_number(Some("1234567")), None);
        assert_eq!(post_number(Some("1a")), None);
        assert_eq!(post_number(None), None);
        assert!(image_file("abcdefghjkmn.jpg"));
        assert!(image_file("abcdefghjkmn.density.png"));
        assert!(!image_file("abcdefghjkmn.svg"));
        assert!(!image_file("abcdefghjkm.jpg"));
        assert!(!image_file("abcdefghjkmn.thumb.jpg"));
        assert!(!image_file("ABCDEFGHJKMN.jpg"));
    }
}
