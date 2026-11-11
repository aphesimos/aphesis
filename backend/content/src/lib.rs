//! content: the Worker behind the archive, the book and works, and the owner's dashboard.
//!
//! ```text
//! public, read-only, published entries only (CORS for the site's origins)
//!   GET  /v1/posts            /v1/posts/:slug       archive · codex
//!   GET  /v1/books            /v1/books/:slug       book · liber
//!   GET  /v1/works            /v1/works/:id         works · opera
//!   GET  /media/:key                                a picture from R2, cached for a year
//!
//! the gate (both steps answer a wrong attempt with the same 401 {"error": "no"})
//!   POST /v1/auth/password    {password}    -> the email with three words, and the pending cookie
//!   POST /v1/auth/code        {code}        -> the session cookie and {csrf, expires}
//!   GET  /v1/auth/session                   -> {open: true, csrf, expires} while the session lasts, else {open: false}
//!   POST /v1/auth/logout
//!
//! the dashboard (session cookie; writes also need the site's Origin and X-CSRF-Token)
//!   GET  /v1/admin/{posts|books|works}                 every entry, drafts too
//!   GET  /v1/admin/{posts|books|works}/:id             one entry, as the public API will answer it (the preview)
//!   PUT  /v1/admin/{posts|books|works}/:id             create or update (a different id in the body renames)
//!   DELETE /v1/admin/{posts|books|works}/:id
//!   POST /v1/admin/{posts|books|works}/:id/publish     and /unpublish
//!   POST /v1/admin/media                               a density map made in the browser (multipart: file)
//!   GET  /v1/admin/wall                  DELETE /v1/admin/wall/:id                     the wall's admin API
//!   GET  /v1/admin/forum/board[?cursor]  GET /v1/admin/forum/threads/:id               the forum's admin API
//!   GET  /v1/admin/forum/reports         DELETE /v1/admin/forum/threads/:id/posts/:n
//!   POST /v1/admin/export                the nightly export, now
//! ```
//!
//! Every night (the cron in wrangler.toml) every entry is exported as markdown and committed to the repository's
//! `content` branch as the owner (`export.rs`), when `EXPORT_GITHUB_TOKEN` is set.
//!
//! Bindings: `DB` (D1), `MEDIA` (R2, bucket aphesis-content), `MAIL` (send_email). Secrets: `OWNER_PASSWORD_HASH`,
//! `OWNER_EMAIL`, `AUTH_SALT`, `WALL_ADMIN_TOKEN`, `FORUM_ADMIN_SECRET`. Vars: `ALLOWED_ORIGINS`, `EMAIL_FROM`,
//! `SESSION_SECONDS`, `WALL_API`, `FORUM_API`.

pub mod code;
pub mod cookie;
pub mod export;
pub mod mail;
pub mod model;
pub mod pbkdf2;
pub mod throttle;

use aphesis_common::{
    cors::Cors,
    env,
    hash::{hex, random_bytes, sha256, sha256_hex},
    http,
    image::{image_size, sniff, Kind},
    secret::same,
    time::now_ms,
};
use serde_json::{json, Value};
use wasm_bindgen::JsValue;
use worker::{
    event, Context, Env, Fetch, FormEntry, HttpMetadata, Method, Request, RequestInit, Response,
    Result, ScheduleContext, ScheduledEvent,
};

const NO: &str = "no";
const CHALLENGE_MS: i64 = 10 * 60 * 1000;
const CHALLENGE_TRIES: i64 = 5;
const DENSITY_MAX: usize = 400 * 1024;

struct Ctx {
    env: Env,
    cors: Cors,
    origin: Option<String>,
    base: String,
    cookies: String,
    ip: String,
}

/// the kinds of entries: table, key column, and how a row is answered
#[derive(Clone, Copy, PartialEq)]
enum Kind3 {
    Posts,
    Books,
    Works,
}

impl Kind3 {
    fn from(s: &str) -> Option<Self> {
        match s {
            "posts" => Some(Kind3::Posts),
            "books" => Some(Kind3::Books),
            "works" => Some(Kind3::Works),
            _ => None,
        }
    }
    fn table(self) -> &'static str {
        match self {
            Kind3::Posts => "posts",
            Kind3::Books => "books",
            Kind3::Works => "works",
        }
    }
    fn key(self) -> &'static str {
        if self == Kind3::Works {
            "id"
        } else {
            "slug"
        }
    }
    fn one(self) -> &'static str {
        match self {
            Kind3::Posts => "post",
            Kind3::Books => "book",
            Kind3::Works => "work",
        }
    }
    fn order(self) -> &'static str {
        match self {
            Kind3::Posts => "date DESC, slug DESC",
            Kind3::Books => "position, slug",
            Kind3::Works => "position, id",
        }
    }
    fn out(self, row: &Value, base: &str, admin: bool) -> Value {
        match self {
            Kind3::Posts => model::post_out(row, base, admin),
            Kind3::Books => model::book_out(row, base, admin),
            Kind3::Works => model::work_out(row, base, admin),
        }
    }
}

fn s(v: &str) -> JsValue {
    JsValue::from_str(v)
}
fn n(v: i64) -> JsValue {
    JsValue::from_f64(v as f64)
}
fn j(v: &Value) -> JsValue {
    JsValue::from_str(&v.to_string())
}

impl Ctx {
    fn var(&self, name: &str) -> Option<String> {
        env::string(&self.env, name)
    }

    fn headers(&self) -> http::Headers {
        http::Headers::new()
            .with("content-type", "application/json; charset=utf-8")
            .with("x-content-type-options", "nosniff")
            .merge(&self.cors.headers_for(self.origin.as_deref()))
    }

    fn json_with(
        &self,
        status: u16,
        v: &Value,
        cache: &str,
        extra: &[(&str, String)],
    ) -> Result<Response> {
        let h = self.headers().with("cache-control", cache).to_worker();
        // Set-Cookie may come more than once: appended, never set
        for (k, v) in extra {
            h.append(k, v)?;
        }
        let body = serde_json::to_vec(v).map_err(|e| worker::Error::RustError(e.to_string()))?;
        Ok(Response::builder()
            .with_status(status)
            .with_headers(h)
            .fixed(body))
    }
    fn json(&self, status: u16, v: &Value) -> Result<Response> {
        self.json_with(status, v, "no-store", &[])
    }
    fn public(&self, v: &Value) -> Result<Response> {
        self.json_with(200, v, "public, max-age=30", &[])
    }
    fn fail(&self, status: u16, error: &str) -> Result<Response> {
        self.json(status, &json!({ "error": error }))
    }

    // ---------- D1 ----------
    async fn rows(&self, sql: &str, args: &[JsValue]) -> Result<Vec<Value>> {
        let st = self.env.d1("DB")?.prepare(sql).bind(args)?;
        st.all().await?.results::<Value>()
    }
    async fn row(&self, sql: &str, args: &[JsValue]) -> Result<Option<Value>> {
        Ok(self.rows(sql, args).await?.into_iter().next())
    }
    async fn run(&self, sql: &str, args: &[JsValue]) -> Result<()> {
        self.env.d1("DB")?.prepare(sql).bind(args)?.run().await?;
        Ok(())
    }

    // ---------- the gate ----------
    fn salt(&self) -> Option<String> {
        self.var("AUTH_SALT")
    }
    fn visitor(&self, salt: &str) -> String {
        sha256_hex(&format!("{salt}|visitor|{}", self.ip))[..32].to_string()
    }
    async fn record(&self, key: &str) -> Result<Option<throttle::Record>> {
        Ok(self
            .row(
                "SELECT fails, last, until FROM throttle WHERE key = ?1",
                &[s(key)],
            )
            .await?
            .and_then(|r| serde_json::from_value(r).ok()))
    }
    async fn locked(&self, visitor: &str) -> Result<bool> {
        let now = now_ms();
        Ok(throttle::locked(self.record(visitor).await?.as_ref(), now)
            || throttle::locked(self.record("*").await?.as_ref(), now))
    }
    async fn failed(&self, visitor: &str) -> Result<()> {
        let now = now_ms();
        for (key, p) in [(visitor, throttle::VISITOR), ("*", throttle::EVERYONE)] {
            let r = throttle::fail(self.record(key).await?.as_ref(), now, p);
            self.run(
                "INSERT INTO throttle (key, fails, last, until) VALUES (?1, ?2, ?3, ?4) \
                 ON CONFLICT(key) DO UPDATE SET fails = excluded.fails, last = excluded.last, until = excluded.until",
                &[s(key), n(r.fails as i64), n(r.last), n(r.until)],
            )
            .await?;
        }
        Ok(())
    }
    fn origin_ok(&self) -> bool {
        cookie::origin_ok(self.origin.as_deref(), &self.cors)
    }

    /// the session behind the cookie: (stored id, csrf token, expiry)
    async fn session(&self) -> Result<Option<(String, String, i64)>> {
        let Some(token) = cookie::get(&self.cookies, cookie::SESSION) else {
            return Ok(None);
        };
        let id = sha256_hex(&format!("session|{token}"));
        let row = self
            .row(
                "SELECT csrf, expires FROM sessions WHERE id = ?1",
                &[s(&id)],
            )
            .await?;
        Ok(row.and_then(|r| {
            let exp = r["expires"].as_f64()? as i64;
            (exp > now_ms()).then(|| (id, r["csrf"].as_str().unwrap_or("").to_string(), exp))
        }))
    }

    /// None when the request may go on; the refusal otherwise
    async fn guard(&self, req: &Request, write: bool) -> Result<Option<Response>> {
        let Some((_, csrf, _)) = self.session().await? else {
            return Ok(Some(self.fail(401, NO)?));
        };
        if write {
            let header = req.headers().get("X-CSRF-Token")?;
            if !self.origin_ok() || !cookie::csrf_ok(header.as_deref(), &csrf) {
                return Ok(Some(self.fail(403, NO)?));
            }
        }
        Ok(None)
    }
}

#[event(fetch)]
async fn fetch(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    let mut cors =
        Cors::new(&env::string(&env, "ALLOWED_ORIGINS").unwrap_or_default()).with_credentials(true);
    cors.methods = "GET, POST, PUT, DELETE, OPTIONS";
    cors.headers = "Content-Type, X-CSRF-Token";
    let url = req.url()?;
    let c = Ctx {
        base: format!("{}://{}", url.scheme(), url.host_str().unwrap_or(""))
            + &url.port().map(|p| format!(":{p}")).unwrap_or_default(),
        origin: req.headers().get("Origin")?,
        cookies: req.headers().get("Cookie")?.unwrap_or_default(),
        ip: req.headers().get("CF-Connecting-IP")?.unwrap_or_default(),
        cors,
        env,
    };
    match route(&c, req).await {
        Ok(r) => Ok(r),
        Err(e) => {
            worker::console_error!("content: {e}");
            c.fail(500, "the service stumbled")
        }
    }
}

async fn route(c: &Ctx, mut req: Request) -> Result<Response> {
    let url = req.url()?;
    let path: Vec<String> = url
        .path()
        .trim_matches('/')
        .split('/')
        .map(String::from)
        .collect();
    let p: Vec<&str> = path.iter().map(String::as_str).collect();
    let m = req.method();
    if m == Method::Options {
        return http::empty(204, &c.cors.headers_for(c.origin.as_deref()));
    }
    match (m.clone(), p.as_slice()) {
        (Method::Get, [""]) => c.public(&json!({ "service": "content" })),
        (Method::Get, ["media", rest @ ..]) => media(c, &rest.join("/")).await,
        (Method::Get, ["v1", kind]) if Kind3::from(kind).is_some() => {
            list(c, Kind3::from(kind).unwrap(), false).await
        }
        (Method::Get, ["v1", kind, id]) if Kind3::from(kind).is_some() => {
            one(c, Kind3::from(kind).unwrap(), id, false).await
        }
        (Method::Post, ["v1", "auth", "password"]) => password(c, &mut req).await,
        (Method::Post, ["v1", "auth", "code"]) => code_step(c, &mut req).await,
        // whether a session is open; asked by the gate as it opens, so no answer here is a failure
        (Method::Get, ["v1", "auth", "session"]) => match c.session().await? {
            Some((_, csrf, exp)) => {
                c.json(200, &json!({ "open": true, "csrf": csrf, "expires": exp }))
            }
            None => c.json(200, &json!({ "open": false })),
        },
        (Method::Post, ["v1", "auth", "logout"]) => logout(c, &req).await,
        (_, ["v1", "admin", rest @ ..]) => {
            if let Some(refusal) = c.guard(&req, m != Method::Get).await? {
                return Ok(refusal);
            }
            admin(c, &mut req, m, rest).await
        }
        _ => c.fail(404, "not found"),
    }
}

// ---------------- public ----------------

async fn list(c: &Ctx, k: Kind3, admin: bool) -> Result<Response> {
    let filter = if admin { "" } else { "WHERE published = 1 " };
    let rows = c
        .rows(
            &format!("SELECT * FROM {} {filter}ORDER BY {}", k.table(), k.order()),
            &[],
        )
        .await?;
    let items: Vec<Value> = rows.iter().map(|r| k.out(r, &c.base, admin)).collect();
    let mut body = json!({ k.table(): items });
    if k == Kind3::Works {
        body["section"] = model::works_section();
    }
    if admin {
        c.json(200, &body)
    } else {
        c.public(&body)
    }
}

async fn one(c: &Ctx, k: Kind3, id: &str, admin: bool) -> Result<Response> {
    let filter = if admin { "" } else { " AND published = 1" };
    match c
        .row(
            &format!("SELECT * FROM {} WHERE {} = ?1{filter}", k.table(), k.key()),
            &[s(id)],
        )
        .await?
    {
        Some(r) => {
            let body = json!({ k.one(): k.out(&r, &c.base, admin) });
            if admin {
                c.json(200, &body)
            } else {
                c.public(&body)
            }
        }
        None => c.fail(404, "not found"),
    }
}

async fn media(c: &Ctx, key: &str) -> Result<Response> {
    let long = model::key_ok(key);
    if !long && key != "mail/phi.png" {
        return c.fail(404, "not found");
    }
    let Some(obj) = c.env.bucket("MEDIA")?.get(key).execute().await? else {
        return c.fail(404, "not found");
    };
    let ctype = obj
        .http_metadata()
        .content_type
        .unwrap_or_else(|| "application/octet-stream".into());
    let bytes = obj.body().map(|b| b.bytes());
    let bytes = match bytes {
        Some(f) => f.await?,
        None => Vec::new(),
    };
    let h = http::Headers::new()
        .with("content-type", &ctype)
        .with(
            "cache-control",
            if long {
                "public, max-age=31536000, immutable"
            } else {
                "public, max-age=86400"
            },
        )
        .with("access-control-allow-origin", "*")
        .with("cross-origin-resource-policy", "cross-origin")
        .with("x-content-type-options", "nosniff")
        .with("content-security-policy", "default-src 'none'; sandbox");
    http::bytes(200, bytes, &h)
}

// ---------------- the gate ----------------

async fn body_json(req: &mut Request) -> Value {
    let text = req.text().await.unwrap_or_default();
    if text.len() > 64 * 1024 {
        return Value::Null;
    }
    serde_json::from_str(&text).unwrap_or(Value::Null)
}

async fn password(c: &Ctx, req: &mut Request) -> Result<Response> {
    if !c.origin_ok() {
        return c.fail(403, NO);
    }
    let Some(salt) = c.salt() else {
        return c.fail(401, NO);
    };
    let body = body_json(req).await;
    let pw = body["password"].as_str().unwrap_or("");
    let visitor = c.visitor(&salt);
    let locked = c.locked(&visitor).await?;
    let stored = c.var("OWNER_PASSWORD_HASH").and_then(|l| pbkdf2::parse(&l));
    // the same work whether the hash is set, the gate is locked or the password is empty
    let (salt_bytes, iterations) = match &stored {
        Some(st) => (st.salt.clone(), st.iterations),
        None => (vec![0u8; 16], pbkdf2::DEFAULT_ITERATIONS),
    };
    let derived = pbkdf2::derive_webcrypto(pw.as_bytes(), &salt_bytes, iterations, 32)
        .await
        .map_err(worker::Error::RustError)?;
    let right = stored
        .as_ref()
        .is_some_and(|st| same(&derived, &st.hash[..32.min(st.hash.len())]) && st.hash.len() == 32)
        && !pw.is_empty()
        && pw.len() <= 1024;
    if !right || locked {
        if !locked {
            c.failed(&visitor).await?;
        }
        return c.fail(401, NO);
    }
    let Some(to) = c.var("OWNER_EMAIL") else {
        return c.fail(401, NO);
    };
    let from = c
        .var("EMAIL_FROM")
        .unwrap_or_else(|| "clavis@post.aphes.ist".into());
    // one challenge at a time: a new password step replaces any earlier code
    let now = now_ms();
    c.run("DELETE FROM challenges", &[]).await?;
    c.run("DELETE FROM sessions WHERE expires <= ?1", &[n(now)])
        .await?;
    let token = hex(&random_bytes(32));
    let r: [u8; 6] = random_bytes(6).try_into().unwrap_or([0; 6]);
    let words = code::generate(&r);
    c.run(
        "INSERT INTO challenges (id, code, expires, tries) VALUES (?1, ?2, ?3, 0)",
        &[
            s(&sha256_hex(&format!("pending|{token}"))),
            s(&code::digest(&salt, &token, &words.join(" "))),
            n(now + CHALLENGE_MS),
        ],
    )
    .await?;
    let image = format!("{}/media/mail/phi.png", c.base);
    let id = format!("{}@{}", hex(&random_bytes(12)), mail::domain(&from));
    let boundary = format!("phi-{}", hex(&random_bytes(8)));
    let date = mail::rfc5322(now);
    let raw = mail::raw(&mail::Mail {
        from: &from,
        to: &to,
        words,
        image: &image,
        date: &date,
        message_id: &id,
        boundary: &boundary,
    });
    let msg = worker::email::EmailMessage::new(&from, &to, &raw)
        .map_err(|e| worker::Error::RustError(format!("{e:?}")))?;
    if let Err(e) = c.env.send_email("MAIL")?.send(&msg).await {
        worker::console_error!("content: the mail did not go: {e:?}");
        c.run("DELETE FROM challenges", &[]).await?;
        return c.fail(503, "unavailable");
    }
    c.json_with(
        200,
        &json!({ "ok": true }),
        "no-store",
        &[(
            "set-cookie",
            cookie::set(
                cookie::PENDING,
                &token,
                CHALLENGE_MS / 1000,
                cookie::PENDING_PATH,
            ),
        )],
    )
}

async fn code_step(c: &Ctx, req: &mut Request) -> Result<Response> {
    if !c.origin_ok() {
        return c.fail(403, NO);
    }
    let Some(salt) = c.salt() else {
        return c.fail(401, NO);
    };
    let body = body_json(req).await;
    let typed = code::normalize(body["code"].as_str().unwrap_or("")).unwrap_or_default();
    let visitor = c.visitor(&salt);
    let locked = c.locked(&visitor).await?;
    let token = cookie::get(&c.cookies, cookie::PENDING).unwrap_or_default();
    let id = sha256_hex(&format!("pending|{token}"));
    let ch = if token.is_empty() {
        None
    } else {
        c.row(
            "SELECT code, expires, tries FROM challenges WHERE id = ?1",
            &[s(&id)],
        )
        .await?
    };
    let now = now_ms();
    let right = ch.as_ref().is_some_and(|ch| {
        ch["expires"].as_f64().unwrap_or(0.0) as i64 > now
            && (ch["tries"].as_f64().unwrap_or(99.0) as i64) < CHALLENGE_TRIES
            && !typed.is_empty()
            && same(
                code::digest(&salt, &token, &typed).as_bytes(),
                ch["code"].as_str().unwrap_or("").as_bytes(),
            )
    });
    if !right || locked {
        if let Some(ch) = &ch {
            if ch["tries"].as_f64().unwrap_or(0.0) as i64 + 1 >= CHALLENGE_TRIES {
                c.run("DELETE FROM challenges WHERE id = ?1", &[s(&id)])
                    .await?;
            } else {
                c.run(
                    "UPDATE challenges SET tries = tries + 1 WHERE id = ?1",
                    &[s(&id)],
                )
                .await?;
            }
        }
        if !locked {
            c.failed(&visitor).await?;
        }
        return c.fail(401, NO);
    }
    // single use
    c.run("DELETE FROM challenges WHERE id = ?1", &[s(&id)])
        .await?;
    c.run("DELETE FROM throttle WHERE key = ?1", &[s(&visitor)])
        .await?;
    let secs = env::number(&c.env, "SESSION_SECONDS", 7200.0).clamp(300.0, 86400.0) as i64;
    let token = hex(&random_bytes(32));
    let csrf = hex(&random_bytes(24));
    let exp = now + secs * 1000;
    c.run(
        "INSERT INTO sessions (id, csrf, created, expires) VALUES (?1, ?2, ?3, ?4)",
        &[
            s(&sha256_hex(&format!("session|{token}"))),
            s(&csrf),
            n(now),
            n(exp),
        ],
    )
    .await?;
    c.json_with(
        200,
        &json!({ "csrf": csrf, "expires": exp }),
        "no-store",
        &[
            (
                "set-cookie",
                cookie::set(cookie::SESSION, &token, secs, "/"),
            ),
            (
                "set-cookie",
                cookie::clear(cookie::PENDING, cookie::PENDING_PATH),
            ),
        ],
    )
}

async fn logout(c: &Ctx, req: &Request) -> Result<Response> {
    if let Some(refusal) = c.guard(req, true).await? {
        return Ok(refusal);
    }
    if let Some((id, _, _)) = c.session().await? {
        c.run("DELETE FROM sessions WHERE id = ?1", &[s(&id)])
            .await?;
    }
    c.json_with(
        200,
        &json!({ "ok": true }),
        "no-store",
        &[("set-cookie", cookie::clear(cookie::SESSION, "/"))],
    )
}

// ---------------- the dashboard ----------------

async fn admin(c: &Ctx, req: &mut Request, m: Method, p: &[&str]) -> Result<Response> {
    match (m, p) {
        (Method::Get, [kind]) if Kind3::from(kind).is_some() => {
            list(c, Kind3::from(kind).unwrap(), true).await
        }
        (Method::Get, [kind, id]) if Kind3::from(kind).is_some() => {
            one(c, Kind3::from(kind).unwrap(), id, true).await
        }
        (Method::Put, [kind, id]) if Kind3::from(kind).is_some() => {
            save(c, req, Kind3::from(kind).unwrap(), id).await
        }
        (Method::Delete, [kind, id]) if Kind3::from(kind).is_some() => {
            let k = Kind3::from(kind).unwrap();
            if !exists(c, k, id).await? {
                return c.fail(404, "not found");
            }
            c.run(
                &format!("DELETE FROM {} WHERE {} = ?1", k.table(), k.key()),
                &[s(id)],
            )
            .await?;
            c.json(200, &json!({ "ok": true }))
        }
        (Method::Post, [kind, id, act @ ("publish" | "unpublish")])
            if Kind3::from(kind).is_some() =>
        {
            let k = Kind3::from(kind).unwrap();
            if !exists(c, k, id).await? {
                return c.fail(404, "not found");
            }
            let on = if *act == "publish" { 1 } else { 0 };
            c.run(
                &format!(
                    "UPDATE {} SET published = ?1, updated = ?2 WHERE {} = ?3",
                    k.table(),
                    k.key()
                ),
                &[n(on), n(now_ms()), s(id)],
            )
            .await?;
            one(c, k, id, true).await
        }
        (Method::Post, ["media"]) => upload(c, req).await,
        (Method::Post, ["export"]) => match run_export(&c.env).await {
            Ok(v) => c.json(200, &v),
            Err(e) => {
                worker::console_error!("content: export: {e}");
                c.fail(502, "the export did not go")
            }
        },
        (Method::Get, ["wall"]) => {
            upstream(c, "WALL_API", "WALL_ADMIN_TOKEN", Method::Get, "/messages").await
        }
        (Method::Delete, ["wall", id]) if plain(id) => {
            upstream(
                c,
                "WALL_API",
                "WALL_ADMIN_TOKEN",
                Method::Delete,
                &format!("/messages/{id}"),
            )
            .await
        }
        (Method::Get, ["forum", "board"]) => {
            // the board is read a page at a time: the forum's cursor ("<bumped>-<seq>") passes through, checked
            let url = req.url()?;
            let cursor = url
                .query_pairs()
                .find(|(k, _)| k == "cursor")
                .map(|(_, v)| v.to_string());
            let path = match cursor {
                Some(cu)
                    if cu.split_once('-').is_some_and(|(a, b)| {
                        !a.is_empty()
                            && !b.is_empty()
                            && a.bytes().chain(b.bytes()).all(|x| x.is_ascii_digit())
                    }) =>
                {
                    format!("/api/board?cursor={cu}")
                }
                Some(_) => return c.fail(400, "a cursor is <bumped>-<seq>"),
                None => "/api/board".into(),
            };
            upstream(c, "FORUM_API", "FORUM_ADMIN_SECRET", Method::Get, &path).await
        }
        (Method::Get, ["forum", "reports"]) => {
            upstream(
                c,
                "FORUM_API",
                "FORUM_ADMIN_SECRET",
                Method::Get,
                "/api/admin/reports",
            )
            .await
        }
        (Method::Get, ["forum", "threads", id]) if plain(id) => {
            upstream(
                c,
                "FORUM_API",
                "FORUM_ADMIN_SECRET",
                Method::Get,
                &format!("/api/threads/{id}"),
            )
            .await
        }
        (Method::Delete, ["forum", "threads", id, "posts", pn])
            if plain(id) && pn.bytes().all(|b| b.is_ascii_digit()) && !pn.is_empty() =>
        {
            upstream(
                c,
                "FORUM_API",
                "FORUM_ADMIN_SECRET",
                Method::Delete,
                &format!("/api/threads/{id}/posts/{pn}"),
            )
            .await
        }
        _ => c.fail(404, "not found"),
    }
}

fn plain(id: &str) -> bool {
    !id.is_empty() && id.len() <= 40 && id.bytes().all(|b| b.is_ascii_alphanumeric())
}

async fn exists(c: &Ctx, k: Kind3, id: &str) -> Result<bool> {
    Ok(c.row(
        &format!("SELECT 1 AS x FROM {} WHERE {} = ?1", k.table(), k.key()),
        &[s(id)],
    )
    .await?
    .is_some())
}

async fn save(c: &Ctx, req: &mut Request, k: Kind3, id: &str) -> Result<Response> {
    let body = body_json(req).await;
    if !body.is_object() {
        return c.fail(400, "not json");
    }
    let now = now_ms();
    // the columns and their values, in the order of the INSERT
    let (new_id, cols, vals): (String, Vec<&str>, Vec<JsValue>) = match k {
        Kind3::Posts => match model::post_in(&body) {
            Ok(p) => (
                p.slug.clone(),
                vec![
                    "slug", "title", "summary", "stage", "date", "body", "notes", "figures",
                    "example",
                ],
                vec![
                    s(&p.slug),
                    s(&p.title),
                    s(&p.summary),
                    s(&p.stage),
                    s(&p.date),
                    s(&p.body),
                    j(&p.notes),
                    j(&p.figures),
                    n(p.example as i64),
                ],
            ),
            Err(e) => return c.fail(400, &e),
        },
        Kind3::Books => match model::book_in(&body) {
            Ok(b) => (
                b.slug.clone(),
                vec![
                    "slug",
                    "title",
                    "author",
                    "year",
                    "note",
                    "quote",
                    "quote_lang",
                    "quote_en",
                    "caption",
                    "picture",
                    "picture_w",
                    "picture_h",
                    "adjust",
                    "position",
                    "example",
                ],
                vec![
                    s(&b.slug),
                    s(&b.title),
                    s(&b.author),
                    s(&b.year),
                    s(&b.note),
                    s(&b.quote),
                    s(&b.quote_lang),
                    s(&b.quote_en),
                    s(&b.caption),
                    s(b.picture["key"].as_str().unwrap_or("")),
                    n(b.picture["w"].as_i64().unwrap_or(0)),
                    n(b.picture["h"].as_i64().unwrap_or(0)),
                    j(&b.adjust),
                    n(b.position),
                    n(b.example as i64),
                ],
            ),
            Err(e) => return c.fail(400, &e),
        },
        Kind3::Works => match model::work_in(&body) {
            Ok(w) => (
                w.id.clone(),
                vec![
                    "id",
                    "name",
                    "gloss",
                    "gloss_tip",
                    "year",
                    "role",
                    "description",
                    "links",
                    "map",
                    "sources",
                    "flags",
                    "position",
                ],
                vec![
                    s(&w.id),
                    s(&w.name),
                    s(&w.gloss),
                    s(&w.gloss_tip),
                    s(&w.year),
                    s(&w.role),
                    s(&w.description),
                    j(&w.links),
                    j(&w.map),
                    j(&w.sources),
                    j(&w.flags),
                    n(w.position),
                ],
            ),
            Err(e) => return c.fail(400, &e),
        },
    };
    let had = exists(c, k, id).await?;
    if new_id != id {
        if !had {
            return c.fail(400, "the address in the body and in the path differ");
        }
        if exists(c, k, &new_id).await? {
            return c.fail(409, "that address is taken");
        }
    }
    let mut args = vals;
    if had {
        let set: Vec<String> = cols
            .iter()
            .enumerate()
            .map(|(i, col)| format!("{col} = ?{}", i + 1))
            .collect();
        let at = cols.len();
        args.push(n(now));
        args.push(s(id));
        c.run(
            &format!(
                "UPDATE {} SET {}, updated = ?{} WHERE {} = ?{}",
                k.table(),
                set.join(", "),
                at + 1,
                k.key(),
                at + 2
            ),
            &args,
        )
        .await?;
    } else {
        let marks: Vec<String> = (1..=cols.len()).map(|i| format!("?{i}")).collect();
        let at = cols.len();
        args.push(n(now));
        c.run(
            &format!(
                "INSERT INTO {} ({}, published, created, updated) VALUES ({}, 0, ?{}, ?{})",
                k.table(),
                cols.join(", "),
                marks.join(", "),
                at + 1,
                at + 1
            ),
            &args,
        )
        .await?;
    }
    let row = c
        .row(
            &format!("SELECT * FROM {} WHERE {} = ?1", k.table(), k.key()),
            &[s(&new_id)],
        )
        .await?
        .unwrap_or(Value::Null);
    c.json(
        if had { 200 } else { 201 },
        &json!({ k.one(): k.out(&row, &c.base, true) }),
    )
}

/// A density map made in the browser (jpeg or png, at most 400 KB, 32 to 640 px on its sides), stored under a
/// key made from its own bytes, so the same map is stored once and a key never changes what it holds.
async fn upload(c: &Ctx, req: &mut Request) -> Result<Response> {
    let form = match req.form_data().await {
        Ok(f) => f,
        Err(_) => return c.fail(400, "a picture is needed"),
    };
    let bytes = match form.get("file") {
        Some(FormEntry::File(f)) => f.bytes().await?,
        _ => return c.fail(400, "a picture is needed"),
    };
    if bytes.is_empty() || bytes.len() > DENSITY_MAX {
        return c.fail(400, "the density map is too heavy");
    }
    let kind = match sniff(&bytes) {
        Some(k @ (Kind::Jpeg | Kind::Png)) => k,
        _ => return c.fail(400, "the density map must be jpeg or png"),
    };
    let Some(size) = image_size(&bytes, Some(kind)) else {
        return c.fail(400, "the density map could not be read");
    };
    let (long, short) = (size.width.max(size.height), size.width.min(size.height));
    if long > 640 || short < 32 {
        return c.fail(400, "the density map has the wrong size");
    }
    let key = format!("m/{}.{}", &hex(&sha256(&bytes))[..24], kind.ext());
    c.env
        .bucket("MEDIA")?
        .put(&key, bytes)
        .http_metadata(HttpMetadata {
            content_type: Some(kind.mime().into()),
            cache_control: Some("public, max-age=31536000, immutable".into()),
            ..Default::default()
        })
        .execute()
        .await?;
    c.json(201, &json!({ "key": key, "url": format!("{}/media/{key}", c.base), "w": size.width, "h": size.height }))
}

/// The wall's and the forum's admin APIs, server to server, with their admin secrets.
async fn upstream(
    c: &Ctx,
    base_var: &str,
    secret_var: &str,
    method: Method,
    path: &str,
) -> Result<Response> {
    let (Some(base), Some(secret)) = (c.var(base_var), c.var(secret_var)) else {
        return c.fail(503, "not set up");
    };
    let h = worker::Headers::new();
    h.set("Authorization", &format!("Bearer {secret}"))?;
    h.set("Accept", "application/json")?;
    let mut init = RequestInit::new();
    init.with_method(method).with_headers(h);
    let mut r = Fetch::Request(Request::new_with_init(
        &format!("{}{path}", base.trim_end_matches('/')),
        &init,
    )?)
    .send()
    .await?;
    let status = r.status_code();
    let text = r.text().await.unwrap_or_default();
    let v: Value = if text.is_empty() {
        json!({ "ok": status < 300 })
    } else {
        serde_json::from_str(&text).unwrap_or(json!({ "error": "the answer was not json" }))
    };
    c.json(if status == 204 { 200 } else { status }, &v)
}

// ---------------- the nightly export ----------------

#[event(scheduled)]
async fn scheduled(_e: ScheduledEvent, env: Env, _ctx: ScheduleContext) {
    match run_export(&env).await {
        Ok(v) => worker::console_log!("content: export {v}"),
        Err(e) => worker::console_error!("content: export: {e}"),
    }
}

async fn github(
    api: &str,
    token: &str,
    method: Method,
    path: &str,
    body: Option<&Value>,
) -> Result<(u16, Value)> {
    let h = worker::Headers::new();
    h.set("Authorization", &format!("Bearer {token}"))?;
    h.set("Accept", "application/vnd.github+json")?;
    h.set("User-Agent", "aphes.ist-content")?;
    h.set("X-GitHub-Api-Version", "2022-11-28")?;
    let mut init = RequestInit::new();
    init.with_method(method).with_headers(h.clone());
    if let Some(b) = body {
        h.set("Content-Type", "application/json")?;
        init.with_headers(h)
            .with_body(Some(JsValue::from_str(&b.to_string())));
    }
    let mut r = Fetch::Request(Request::new_with_init(&format!("{api}{path}"), &init)?)
        .send()
        .await?;
    let status = r.status_code();
    let text = r.text().await.unwrap_or_default();
    Ok((status, serde_json::from_str(&text).unwrap_or(Value::Null)))
}

/// every entry as files, committed to the content branch when the tree changed: {committed, files, commit?}
async fn run_export(env: &Env) -> Result<Value> {
    let var = |k: &str| env::string(env, k);
    let Some(token) = var("EXPORT_GITHUB_TOKEN") else {
        return Ok(json!({ "committed": false, "why": "no token" }));
    };
    let repo = var("EXPORT_REPO").unwrap_or_else(|| "aphesimos/aphesis".into());
    let branch = var("EXPORT_BRANCH").unwrap_or_else(|| "content".into());
    let api = var("GITHUB_API").unwrap_or_else(|| "https://api.github.com".into());
    let base = var("PUBLIC_URL").unwrap_or_else(|| "https://content-api.aphes.ist".into());
    let db = env.d1("DB")?;
    let mut all = Vec::new();
    for k in [Kind3::Posts, Kind3::Books, Kind3::Works] {
        let rows = db
            .prepare(format!(
                "SELECT * FROM {} ORDER BY {}",
                k.table(),
                k.order()
            ))
            .all()
            .await?
            .results::<Value>()?;
        all.push(
            rows.iter()
                .map(|r| k.out(r, &base, true))
                .collect::<Vec<_>>(),
        );
    }
    let files = export::files(&all[0], &all[1], &all[2]);
    let fail = |what: &str, st: u16| worker::Error::RustError(format!("github {what}: {st}"));
    let (st, r) = github(
        &api,
        &token,
        Method::Get,
        &format!("/repos/{repo}/git/ref/heads/{branch}"),
        None,
    )
    .await?;
    let parent = if st == 200 {
        r["object"]["sha"].as_str().map(String::from)
    } else if st == 404 {
        None
    } else {
        return Err(fail("ref", st));
    };
    let parent_tree = match &parent {
        Some(sha) => {
            let (st, c) = github(
                &api,
                &token,
                Method::Get,
                &format!("/repos/{repo}/git/commits/{sha}"),
                None,
            )
            .await?;
            if st != 200 {
                return Err(fail("commit", st));
            }
            c["tree"]["sha"].as_str().map(String::from)
        }
        None => None,
    };
    let tree: Vec<Value> = files
        .iter()
        .map(|(p, t)| json!({ "path": p, "mode": "100644", "type": "blob", "content": t }))
        .collect();
    let (st, t) = github(
        &api,
        &token,
        Method::Post,
        &format!("/repos/{repo}/git/trees"),
        Some(&json!({ "tree": tree })),
    )
    .await?;
    let Some(tree_sha) = t["sha"].as_str().filter(|_| st == 201) else {
        return Err(fail("tree", st));
    };
    if parent_tree.as_deref() == Some(tree_sha) {
        return Ok(json!({ "committed": false, "files": files.len(), "why": "unchanged" }));
    }
    let date = {
        let ms = now_ms();
        let day = aphesis_common::time::iso_day(ms);
        let secs = ms.div_euclid(1000).rem_euclid(86400);
        format!(
            "{day}T{:02}:{:02}:{:02}Z",
            secs / 3600,
            secs / 60 % 60,
            secs % 60
        )
    };
    let who = json!({ "name": export::OWNER_NAME, "email": export::OWNER_EMAIL, "date": date });
    let message = format!(
        "Export the content: {} posts, {} book entries, {} works\n\nWritten nightly from the content service, drafts included.",
        all[0].len(), all[1].len(), all[2].len()
    );
    let parents: Vec<Value> = parent.iter().map(|p| json!(p)).collect();
    let (st, c) = github(&api, &token, Method::Post, &format!("/repos/{repo}/git/commits"),
        Some(&json!({ "message": message, "tree": tree_sha, "parents": parents, "author": who, "committer": who }))).await?;
    let Some(commit) = c["sha"].as_str().filter(|_| st == 201) else {
        return Err(fail("commit", st));
    };
    let (st, _) = if parent.is_some() {
        github(
            &api,
            &token,
            Method::Patch,
            &format!("/repos/{repo}/git/refs/heads/{branch}"),
            Some(&json!({ "sha": commit })),
        )
        .await?
    } else {
        github(
            &api,
            &token,
            Method::Post,
            &format!("/repos/{repo}/git/refs"),
            Some(&json!({ "ref": format!("refs/heads/{branch}"), "sha": commit })),
        )
        .await?
    };
    if st != 200 && st != 201 {
        return Err(fail("ref update", st));
    }
    Ok(json!({ "committed": true, "files": files.len(), "commit": commit }))
}
