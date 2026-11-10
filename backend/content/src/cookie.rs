//! Cookies and the CSRF rules.
//!
//! The session lives in an `HttpOnly; Secure; SameSite=Strict` cookie on the content API's own host
//! (content-api.aphes.ist). aphes.ist is the same site, so the page's credentialed requests carry it, and no page
//! script can read it. The step between the password and the code has its own cookie, scoped to `/v1/auth`.
//!
//! A state-changing request must also pass two checks:
//! - its `Origin` is one of the site's origins (a browser always sends it on such a request);
//! - it carries `X-CSRF-Token`, equal to the token the session was given at login (the page keeps it in memory;
//!   a custom header also forces a CORS preflight, which only the site's origins pass).

use aphesis_common::cors::Cors;
use aphesis_common::secret::same;

pub const SESSION: &str = "aph_session";
pub const PENDING: &str = "aph_pending";
pub const PENDING_PATH: &str = "/v1/auth";

/// The value of one cookie from a `Cookie` header.
pub fn get(header: &str, name: &str) -> Option<String> {
    header.split(';').find_map(|part| {
        let (k, v) = part.trim().split_once('=')?;
        (k.trim() == name && !v.is_empty()).then(|| v.trim().to_string())
    })
}

pub fn set(name: &str, value: &str, max_age: i64, path: &str) -> String {
    format!("{name}={value}; Max-Age={max_age}; Path={path}; HttpOnly; Secure; SameSite=Strict")
}

pub fn clear(name: &str, path: &str) -> String {
    set(name, "", 0, path)
}

/// A state-changing request from one of the site's origins.
pub fn origin_ok(origin: Option<&str>, cors: &Cors) -> bool {
    origin.is_some_and(|o| cors.allows(o))
}

/// The CSRF header against the session's token, in equal time.
pub fn csrf_ok(header: Option<&str>, token: &str) -> bool {
    match header {
        Some(h) if !h.is_empty() && !token.is_empty() => same(h.as_bytes(), token.as_bytes()),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_one_cookie() {
        let h = "a=1; aph_session=abc123 ; aph_pending=; other=x=y";
        assert_eq!(get(h, "aph_session").as_deref(), Some("abc123"));
        assert_eq!(get(h, "aph_pending"), None);
        assert_eq!(get(h, "other").as_deref(), Some("x=y"));
        assert_eq!(get(h, "missing"), None);
        assert_eq!(get("", "a"), None);
    }

    #[test]
    fn cookies_are_http_only_secure_strict() {
        let c = set(SESSION, "v", 7200, "/");
        for part in [
            "aph_session=v",
            "Max-Age=7200",
            "Path=/",
            "HttpOnly",
            "Secure",
            "SameSite=Strict",
        ] {
            assert!(c.contains(part), "{c}");
        }
        assert!(clear(PENDING, PENDING_PATH).starts_with("aph_pending=; Max-Age=0; Path=/v1/auth"));
    }

    #[test]
    fn csrf_needs_the_origin_and_the_token() {
        let cors = Cors::new("https://aphes.ist,https://www.aphes.ist");
        assert!(origin_ok(Some("https://aphes.ist"), &cors));
        assert!(!origin_ok(Some("https://evil.example"), &cors));
        assert!(!origin_ok(Some("null"), &cors));
        assert!(!origin_ok(None, &cors));
        assert!(csrf_ok(Some("tok"), "tok"));
        assert!(!csrf_ok(Some("tok2"), "tok"));
        assert!(!csrf_ok(Some(""), ""));
        assert!(!csrf_ok(None, "tok"));
    }
}
