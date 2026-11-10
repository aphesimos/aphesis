//! Durable Object plumbing: small JSON requests from a Worker to its objects on internal paths, and alarms at an
//! absolute time.

use serde::Serialize;
use serde_json::Value;
use worker::{wasm_bindgen::JsValue, Method, Request, RequestInit, ScheduledTime, Storage, Stub};

/// `stub.fetch('https://do' + path, body ? POST JSON : GET)` -> (status, parsed body or null).
pub async fn call<B: Serialize + ?Sized>(
    stub: &Stub,
    path: &str,
    body: Option<&B>,
) -> worker::Result<(u16, Value)> {
    let mut init = RequestInit::new();
    if let Some(b) = body {
        let text = serde_json::to_string(b).map_err(|e| worker::Error::RustError(e.to_string()))?;
        init.with_method(Method::Post)
            .with_body(Some(JsValue::from_str(&text)));
        init.headers.set("content-type", "application/json")?;
    }
    let req = Request::new_with_init(&format!("https://do{path}"), &init)?;
    let mut res = stub.fetch_with_request(req).await?;
    let status = res.status_code();
    let text = res.text().await.unwrap_or_default();
    Ok((status, serde_json::from_str(&text).unwrap_or(Value::Null)))
}

/// Reads a JSON request body inside an object (null when there is none or it does not parse).
pub async fn body(req: &mut Request) -> Value {
    if req.method() != Method::Post {
        return Value::Null;
    }
    req.json::<Value>().await.unwrap_or(Value::Null)
}

/// An alarm at `ms` since the epoch. workers-rs reads a bare integer as an offset from now, so the absolute
/// time goes through a JavaScript Date.
pub async fn set_alarm_at(storage: &Storage, ms: i64) -> worker::Result<()> {
    storage
        .set_alarm(ScheduledTime::new(js_sys::Date::new(&JsValue::from_f64(
            ms as f64,
        ))))
        .await
}

/// Moves the alarm earlier if `ms` comes before it (or sets it when there is none). 0 means nothing to do.
pub async fn alarm_no_later_than(storage: &Storage, ms: i64) -> worker::Result<()> {
    if ms <= 0 {
        return Ok(());
    }
    match storage.get_alarm().await? {
        Some(cur) if cur <= ms => Ok(()),
        _ => set_alarm_at(storage, ms).await,
    }
}

/// A JSON response from inside an object.
pub fn reply<T: Serialize + ?Sized>(status: u16, body: &T) -> worker::Result<worker::Response> {
    let h = crate::http::Headers::new().with("content-type", "application/json");
    crate::http::json(status, body, &h)
}
