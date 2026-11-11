//! wall · paries: the Worker in front of the wall, and the Durable Object that holds it.
//!
//! ```text
//! GET    /messages        the live lines, newest first: { messages: [{ id, text, at, owner }] }
//! POST   /messages        { text, token } -> 201 { message } | 400 { error: 'empty'|'long'|'word'|'link'|'bad' }
//!                         | 403 { error: 'turnstile' } | 429 { error: 'rate', retryAfter } | 503 { error: 'unavailable' }
//!                         With `Authorization: Bearer <ADMIN_TOKEN>` the line is the owner's (`owner: true`): the
//!                         filter still applies, the rate limit and Turnstile do not; any other key is 401. Nothing
//!                         else in a request (an `owner` in the JSON, say) can mark a line as the owner's.
//! DELETE /messages/:id    removal, with `Authorization: Bearer <ADMIN_TOKEN>` -> 204 | 401 | 404
//! ```
//!
//! Bindings: `WALL` (the Durable Object, class `Wall`). Vars: `ALLOWED_ORIGINS`, `TTL_DAYS` (30), `BLOCKLIST`,
//! `ALLOW_NO_TURNSTILE` (local only), `TTL_SECONDS` (tests only: overrides `TTL_DAYS`). Secrets: `TURNSTILE_SECRET`
//! (without it every post is refused unless `ALLOW_NO_TURNSTILE` is "1"), `HASH_SALT`, `ADMIN_TOKEN`.
//!
//! The same HTTP contract as the JavaScript Worker it replaces (`section/wall`: `wall/worker/src/index.js`), so the
//! page works unchanged.

pub mod filter;
pub mod rules;
mod store;

pub use store::Wall;

use aphesis_common::{cors::Cors, durable::call, env, http, secret, turnstile};
use serde_json::{json, Value};
use worker::{event, Context, Env, Method, Request, Response, Result};

const DAY: i64 = 24 * 60 * 60 * 1000;

fn base(cors: &http::Headers) -> http::Headers {
    http::Headers::new()
        .with("Content-Type", "application/json; charset=utf-8")
        .with("Cache-Control", "no-store")
        .merge(cors)
}

fn reply(status: u16, body: &Value, h: &http::Headers) -> Result<Response> {
    http::json(status, body, &base(h))
}

fn refuse(status: u16, error: &str, h: &http::Headers) -> Result<Response> {
    reply(status, &json!({ "error": error }), h)
}

async fn turnstile_ok(env: &Env, token: &Value, ip: &str) -> bool {
    let Some(secret) = env::string(env, "TURNSTILE_SECRET") else {
        return env::string(env, "ALLOW_NO_TURNSTILE").as_deref() == Some("1");
    };
    match token.as_str() {
        Some(t) if !t.is_empty() && turnstile::js_len(t) <= 2048 => {
            turnstile::siteverify(&secret, t, Some(ip)).await
        }
        _ => false,
    }
}

/// How long a line stays, in ms: `TTL_SECONDS` when set (for tests), else `TTL_DAYS` (at least 1, default 30).
pub fn ttl_ms(ttl_days: Option<&str>, ttl_seconds: Option<&str>) -> i64 {
    if let Some(s) = ttl_seconds
        .and_then(|s| s.trim().parse::<f64>().ok())
        .filter(|s| *s > 0.0)
    {
        return (s * 1000.0) as i64;
    }
    (env::js_number(ttl_days, 30.0).max(1.0) * DAY as f64) as i64
}

/// `/messages/<id>` with an id of 8 to 40 characters a-z0-9
fn message_id(path: &str) -> Option<&str> {
    let id = path.strip_prefix("/messages/")?;
    let ok = (8..=40).contains(&id.len())
        && id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit());
    ok.then_some(id)
}

#[event(fetch)]
async fn fetch(mut req: Request, env: Env, _ctx: Context) -> Result<Response> {
    let origin = req.headers().get("Origin")?;
    let h = Cors::new(&env::string(&env, "ALLOWED_ORIGINS").unwrap_or_default())
        .headers_for(origin.as_deref());
    if req.method() == Method::Options {
        return http::empty(204, &h);
    }
    let path = req.path();
    let wall = env.durable_object("WALL")?.get_by_name("wall")?;

    if path == "/messages" && req.method() == Method::Get {
        let (_, body) = call::<Value>(&wall, "/list", None).await?;
        return http::json(
            200,
            &body,
            &base(&h).with("Cache-Control", "public, max-age=15"),
        );
    }

    if path == "/messages" && req.method() == Method::Post {
        let body: Value = match req
            .text()
            .await
            .ok()
            .and_then(|t| serde_json::from_str(&t).ok())
        {
            Some(v) => v,
            None => return refuse(400, "bad", &h),
        };
        let Some(text) = body.get("text").and_then(Value::as_str) else {
            return refuse(400, "bad", &h);
        };
        // the owner's line comes from the content service with the admin token; any other key is refused
        let owner = match req.headers().get("Authorization")? {
            None => false,
            Some(a) if secret::bearer_exact(&a, env::string(&env, "ADMIN_TOKEN").as_deref()) => {
                true
            }
            Some(_) => return refuse(401, "unauthorized", &h),
        };
        let extra = filter::blocklist(&env::string(&env, "BLOCKLIST").unwrap_or_default());
        let text = match filter::check(text, &extra) {
            filter::Verdict::Ok { text, .. } => text,
            filter::Verdict::Refused { reason, .. } => return refuse(400, reason, &h),
        };

        if !owner {
            let ip = req.headers().get("CF-Connecting-IP")?.unwrap_or_default();
            let Some(salt) = env::string(&env, "HASH_SALT") else {
                return refuse(503, "unavailable", &h);
            };
            let visitor = rules::visitor_key(&ip, &salt, aphesis_common::time::now_ms());
            // count the attempt first, so failed challenges are limited too
            let (status, rate) = call(&wall, "/rate", Some(&json!({ "visitor": visitor }))).await?;
            if status == 429 {
                let retry = rate.get("retryAfter").and_then(Value::as_i64).unwrap_or(1);
                return reply(
                    429,
                    &json!({ "error": "rate", "retryAfter": retry }),
                    &h.clone().with("Retry-After", &retry.to_string()),
                );
            }
            if !turnstile_ok(&env, body.get("token").unwrap_or(&Value::Null), &ip).await {
                return refuse(403, "turnstile", &h);
            }
        }

        let ttl = ttl_ms(
            env::string(&env, "TTL_DAYS").as_deref(),
            env::string(&env, "TTL_SECONDS").as_deref(),
        );
        let (_, added) = call(
            &wall,
            "/add",
            Some(&json!({ "text": text, "ttl": ttl, "owner": owner })),
        )
        .await?;
        return reply(201, &added, &h);
    }

    if let (Some(id), Method::Delete) = (message_id(&path), req.method()) {
        let auth = req.headers().get("Authorization")?.unwrap_or_default();
        if !secret::bearer_exact(&auth, env::string(&env, "ADMIN_TOKEN").as_deref()) {
            return refuse(401, "unauthorized", &h);
        }
        let (status, _) = call(&wall, "/remove", Some(&json!({ "id": id }))).await?;
        return if status == 204 {
            http::empty(204, &h)
        } else {
            refuse(404, "not found", &h)
        };
    }

    refuse(404, "not found", &h)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ttl_rules() {
        assert_eq!(ttl_ms(None, None), 30 * DAY);
        assert_eq!(ttl_ms(Some("1"), None), DAY);
        assert_eq!(ttl_ms(Some("0.5"), None), DAY);
        assert_eq!(ttl_ms(Some("x"), None), 30 * DAY);
        assert_eq!(ttl_ms(Some("7"), Some("2")), 2000);
        assert_eq!(ttl_ms(Some("7"), Some("-1")), 7 * DAY);
    }

    #[test]
    fn removal_paths() {
        assert_eq!(message_id("/messages/0123abcd"), Some("0123abcd"));
        assert_eq!(message_id("/messages/0123abc"), None);
        assert_eq!(message_id("/messages/0123ABCD"), None);
        assert_eq!(message_id(&format!("/messages/{}", "a".repeat(41))), None);
        assert_eq!(message_id("/messages/"), None);
    }
}
