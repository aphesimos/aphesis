//! Responses. A small ordered header list where a later `set` replaces an earlier one regardless of case (like
//! `Object.assign` over a plain object of headers in the JavaScript Workers), and helpers for JSON and empty bodies.

use serde::Serialize;

#[derive(Debug, Clone, Default)]
pub struct Headers(Vec<(String, String)>);

impl Headers {
    pub fn new() -> Self {
        Headers(Vec::new())
    }

    pub fn set(&mut self, name: &str, value: &str) -> &mut Self {
        if let Some(slot) = self
            .0
            .iter_mut()
            .find(|(k, _)| k.eq_ignore_ascii_case(name))
        {
            slot.1 = value.to_string();
        } else {
            self.0.push((name.to_string(), value.to_string()));
        }
        self
    }

    pub fn with(mut self, name: &str, value: &str) -> Self {
        self.set(name, value);
        self
    }

    /// Later headers win.
    pub fn merge(mut self, other: &Headers) -> Self {
        for (k, v) in &other.0 {
            self.set(k, v);
        }
        self
    }

    pub fn get(&self, name: &str) -> Option<&str> {
        self.0
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(name))
            .map(|(_, v)| v.as_str())
    }

    pub fn iter(&self) -> impl Iterator<Item = (&str, &str)> {
        self.0.iter().map(|(k, v)| (k.as_str(), v.as_str()))
    }

    pub fn to_worker(&self) -> worker::Headers {
        let h = worker::Headers::new();
        for (k, v) in &self.0 {
            let _ = h.set(k, v);
        }
        h
    }
}

/// `{"error": "..."}`, the shape every refusal takes.
#[derive(Serialize)]
pub struct ErrorBody<'a> {
    pub error: &'a str,
}

pub fn error_body(error: &str) -> String {
    serde_json::to_string(&ErrorBody { error }).unwrap_or_else(|_| "{}".into())
}

/// A response with a body and these headers.
pub fn bytes(status: u16, body: Vec<u8>, headers: &Headers) -> worker::Result<worker::Response> {
    Ok(worker::Response::builder()
        .with_status(status)
        .with_headers(headers.to_worker())
        .fixed(body))
}

/// A response without a body (204, preflights).
pub fn empty(status: u16, headers: &Headers) -> worker::Result<worker::Response> {
    Ok(worker::Response::builder()
        .with_status(status)
        .with_headers(headers.to_worker())
        .empty())
}

/// JSON with the given headers; the caller decides content type and caching (each service keeps its own).
pub fn json<T: Serialize + ?Sized>(
    status: u16,
    body: &T,
    headers: &Headers,
) -> worker::Result<worker::Response> {
    let text = serde_json::to_vec(body).map_err(|e| worker::Error::RustError(e.to_string()))?;
    bytes(status, text, headers)
}
