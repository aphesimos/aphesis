//! CORS: answer only the origins the site lives on. A request from any other origin gets no
//! `Access-Control-Allow-*` header at all, so the browser keeps the response from the page.
//!
//! `Vary: Origin` is always sent, because the answer depends on the origin and caches must know.
//! `credentials` is for a service that uses cookies (it adds `Access-Control-Allow-Credentials: true`,
//! which browsers only accept next to an exact origin, never `*`; this module never sends `*`).

use crate::http::Headers;

#[derive(Debug, Clone)]
pub struct Cors {
    origins: Vec<String>,
    read_origins: Vec<String>,
    pub methods: &'static str,
    pub headers: &'static str,
    pub max_age: u32,
    pub credentials: bool,
}

impl Cors {
    /// From a comma-separated list such as `ALLOWED_ORIGINS`; blanks are ignored.
    pub fn new(list: &str) -> Self {
        Cors {
            origins: parse_origins(list),
            read_origins: Vec::new(),
            methods: "GET, POST, DELETE, OPTIONS",
            headers: "Content-Type, Authorization",
            max_age: 86400,
            credentials: false,
        }
    }

    pub fn with_credentials(mut self, on: bool) -> Self {
        self.credentials = on;
        self
    }

    /// Origins that may only read: the public GETs of a service, with no credentials, never its gate or dashboard.
    /// `headers_for_read` is the only place they count; `allows` (the CSRF check) never sees them.
    pub fn with_read_origins(mut self, list: &str) -> Self {
        self.read_origins = parse_origins(list);
        self
    }

    pub fn allows(&self, origin: &str) -> bool {
        !origin.is_empty() && self.origins.iter().any(|o| o == origin)
    }

    /// The headers for a request that came with this `Origin` (or none).
    pub fn headers_for(&self, origin: Option<&str>) -> Headers {
        let mut h = Headers::new();
        h.set("Vary", "Origin");
        if let Some(o) = origin.filter(|o| self.allows(o)) {
            h.set("Access-Control-Allow-Origin", o);
            h.set("Access-Control-Allow-Methods", self.methods);
            h.set("Access-Control-Allow-Headers", self.headers);
            h.set("Access-Control-Max-Age", &self.max_age.to_string());
            if self.credentials {
                h.set("Access-Control-Allow-Credentials", "true");
            }
        }
        h
    }
}

impl Cors {
    /// Like `headers_for`, for an answer that may be read from a read-only origin: `read` says the request is a public
    /// GET, HEAD or the preflight of one. Such an origin gets the headers for reading only (no credentials).
    pub fn headers_for_read(&self, origin: Option<&str>, read: bool) -> Headers {
        match origin {
            Some(o) if read && !self.allows(o) && self.read_origins.iter().any(|r| r == o) => {
                let mut h = Headers::new();
                h.set("Vary", "Origin");
                h.set("Access-Control-Allow-Origin", o);
                h.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
                h.set("Access-Control-Allow-Headers", "Content-Type");
                h.set("Access-Control-Max-Age", &self.max_age.to_string());
                h
            }
            _ => self.headers_for(origin),
        }
    }
}

pub fn parse_origins(list: &str) -> Vec<String> {
    list.split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn answers_listed_origins_only() {
        let c = Cors::new(" https://aphes.ist, ,https://www.aphes.ist ");
        let h = c.headers_for(Some("https://aphes.ist"));
        assert_eq!(
            h.get("access-control-allow-origin"),
            Some("https://aphes.ist")
        );
        assert_eq!(h.get("Vary"), Some("Origin"));
        assert_eq!(h.get("Access-Control-Allow-Credentials"), None);
        let h = c.headers_for(Some("https://evil.example"));
        assert_eq!(h.get("Access-Control-Allow-Origin"), None);
        assert_eq!(h.get("Vary"), Some("Origin"));
        assert_eq!(c.headers_for(None).get("Access-Control-Allow-Origin"), None);
        assert!(!c.allows(""));
    }

    #[test]
    fn read_origins_read_and_nothing_else() {
        let c = Cors::new("https://aphes.ist")
            .with_credentials(true)
            .with_read_origins(" https://me.aphes.ist, ");
        let me = Some("https://me.aphes.ist");
        let h = c.headers_for_read(me, true);
        assert_eq!(h.get("Access-Control-Allow-Origin"), me);
        assert_eq!(
            h.get("Access-Control-Allow-Methods"),
            Some("GET, HEAD, OPTIONS")
        );
        assert_eq!(h.get("Access-Control-Allow-Credentials"), None);
        // not for anything but a public read, and never as an origin that may write
        assert_eq!(
            c.headers_for_read(me, false)
                .get("Access-Control-Allow-Origin"),
            None
        );
        assert_eq!(c.headers_for(me).get("Access-Control-Allow-Origin"), None);
        assert!(!c.allows("https://me.aphes.ist"));
        // the site's own origin keeps all it had, and others get nothing
        let h = c.headers_for_read(Some("https://aphes.ist"), true);
        assert_eq!(h.get("Access-Control-Allow-Credentials"), Some("true"));
        let h = c.headers_for_read(Some("https://evil.example"), true);
        assert_eq!(h.get("Access-Control-Allow-Origin"), None);
        assert_eq!(h.get("Vary"), Some("Origin"));
    }

    #[test]
    fn credentials_when_asked() {
        let c = Cors::new("https://aphes.ist").with_credentials(true);
        let h = c.headers_for(Some("https://aphes.ist"));
        assert_eq!(h.get("Access-Control-Allow-Credentials"), Some("true"));
    }
}
