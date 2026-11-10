//! Turnstile: Cloudflare's check that a person, not a script, is posting, verified with `siteverify`. Each
//! service decides what happens without a secret; this only asks Cloudflare.

use worker::{wasm_bindgen::JsValue, Fetch, FormData, Method, Request, RequestInit};

pub const VERIFY: &str = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/// `true` only when Cloudflare answers `success: true`. Network or parse failures refuse.
pub async fn siteverify(secret: &str, token: &str, remote_ip: Option<&str>) -> bool {
    async fn go(secret: &str, token: &str, remote_ip: Option<&str>) -> worker::Result<bool> {
        let form = FormData::new();
        form.append("secret", secret)?;
        form.append("response", token)?;
        if let Some(ip) = remote_ip.filter(|ip| !ip.is_empty()) {
            form.append("remoteip", ip)?;
        }
        let mut init = RequestInit::new();
        init.with_method(Method::Post)
            .with_body(Some(JsValue::from(form)));
        let req = Request::new_with_init(VERIFY, &init)?;
        let mut res = Fetch::Request(req).send().await?;
        let out: serde_json::Value = res.json().await?;
        Ok(out.get("success").and_then(|v| v.as_bool()) == Some(true))
    }
    go(secret, token, remote_ip).await.unwrap_or(false)
}

/// The first `n` UTF-16 code units of a string, like `String.prototype.slice(0, n)` (on a char boundary).
pub fn js_slice(s: &str, n: usize) -> &str {
    let mut units = 0;
    for (i, c) in s.char_indices() {
        units += c.len_utf16();
        if units > n {
            return &s[..i];
        }
    }
    s
}

/// The length JavaScript reports for a string: UTF-16 code units.
pub fn js_len(s: &str) -> usize {
    s.chars().map(char::len_utf16).sum()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn utf16_lengths() {
        assert_eq!(js_len("abc"), 3);
        assert_eq!(js_len("𝔞"), 2);
        assert_eq!(js_slice("abcdef", 3), "abc");
        assert_eq!(js_slice("ab", 3), "ab");
        assert_eq!(js_slice("a𝔞b", 2), "a");
    }
}
