//! The gate's email: the second key, sent to the owner's address (`OWNER_EMAIL`) through Resend's HTTP API
//! (`POST {MAIL_API}/emails`, with `RESEND_API_KEY`), from `EMAIL_FROM` on the domain `aphes.ist`.
//!
//! It follows the backlog: the subject is a gloss, *clavis*; the HTML is the dark ground with the φ in red as
//! stipple (a PNG hosted in the content bucket, `mail/phi.png`, made by `tools/make-mail-phi.mjs` from the design
//! system's φ) and the three words in a typewriter face, falling back where fonts do not load; a plain-text part
//! carries the same words. Nothing explains it: no "verification code", no "if you did not ask for this".
//!
//! The colours are the dark theme's tokens, converted from oklch to sRGB (mail clients do not read oklch):
//! `bg` n-975, `ink` n-100, `ink-soft` n-500, `accent` rubedo. The test `colours_follow_the_tokens` checks them
//! against the design system's tokens.json when the branch is at hand.

pub const SUBJECT: &str = "clavis";
pub const BG: &str = "#050404";
pub const INK: &str = "#f1eded";
pub const INK_SOFT: &str = "#857e7e";
pub const ACCENT: &str = "#d43031";
/// the `text` family of the design system, with the mail's own fallbacks after it
pub const TYPEWRITER: &str = "'Special Elite', 'Courier New', Courier, 'Lucida Console', monospace";

pub struct Mail<'a> {
    pub from: &'a str,
    pub to: &'a str,
    pub words: [&'a str; 3],
    /// absolute URL of the φ
    pub image: &'a str,
}

/// Resend's API, when `MAIL_API` is not set
pub const DEFAULT_API: &str = "https://api.resend.com";
/// how long the gate waits for Resend before it gives up, in ms
pub const TIMEOUT_MS: u32 = 8000;

/// One request to Resend, built apart from the fetch so the tests can read it.
pub struct Outgoing {
    pub url: String,
    pub headers: Vec<(&'static str, String)>,
    pub body: String,
}

/// The JSON `POST /emails` takes: `{from, to, subject, html, text}`.
pub fn body(m: &Mail) -> serde_json::Value {
    serde_json::json!({
        "from": m.from,
        "to": m.to,
        "subject": SUBJECT,
        "html": html(m),
        "text": text(m),
    })
}

/// `POST {api}/emails` with the key as a bearer token; an empty `api` means Resend's own.
pub fn request(api: &str, key: &str, m: &Mail) -> Outgoing {
    let api = api.trim().trim_end_matches('/');
    let api = if api.is_empty() { DEFAULT_API } else { api };
    Outgoing {
        url: format!("{api}/emails"),
        headers: vec![
            ("Authorization", format!("Bearer {key}")),
            ("Content-Type", "application/json".into()),
            ("Accept", "application/json".into()),
            ("User-Agent", "aphes.ist-content".into()),
        ],
        body: body(m).to_string(),
    }
}

fn esc(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

pub fn html(m: &Mail) -> String {
    let words = m.words.map(esc).join(&format!(
        "<span style=\"color:{INK_SOFT}\"> &middot; </span>"
    ));
    format!(
        "<!doctype html><html lang=\"la\"><head><meta charset=\"utf-8\">\
<meta name=\"color-scheme\" content=\"dark\"><meta name=\"supported-color-schemes\" content=\"dark\">\
<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>{SUBJECT}</title></head>\
<body style=\"margin:0;padding:0;background:{BG};\" bgcolor=\"{BG}\">\
<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" bgcolor=\"{BG}\" style=\"background:{BG};\">\
<tr><td align=\"center\" style=\"padding:84px 20px 32px 20px;\">\
<img src=\"{img}\" width=\"112\" height=\"112\" alt=\"&phi;\" style=\"display:block;border:0;width:112px;height:112px;color:{ACCENT};font-size:64px;\">\
</td></tr>\
<tr><td align=\"center\" style=\"padding:20px 20px 136px 20px;font-family:{TYPEWRITER};font-size:22px;line-height:1.75;letter-spacing:0.08em;color:{INK};\">\
{words}\
</td></tr></table></body></html>",
        img = esc(m.image),
    )
}

pub fn text(m: &Mail) -> String {
    format!("φ\r\n\r\n{}\r\n", crate::code::display(&m.words))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mail() -> Mail<'static> {
        Mail {
            from: "clavis@aphes.ist",
            to: "owner@example.com",
            words: ["ignis", "lapis", "aurum"],
            image: "https://content-api.aphes.ist/media/mail/phi.png",
        }
    }

    #[test]
    fn follows_the_backlog() {
        let out = request("https://api.resend.com", "re_test", &mail());
        let v: serde_json::Value = serde_json::from_str(&out.body).unwrap();
        assert_eq!(
            v.as_object().unwrap().keys().collect::<Vec<_>>(),
            ["from", "to", "subject", "html", "text"]
        );
        assert_eq!(v["subject"], "clavis");
        assert_eq!(v["from"], "clavis@aphes.ist");
        assert_eq!(v["to"], "owner@example.com");
        let html = v["html"].as_str().unwrap();
        let text = v["text"].as_str().unwrap();
        assert!(html.contains(&format!("background:{BG}")));
        assert!(html.contains("src=\"https://content-api.aphes.ist/media/mail/phi.png\""));
        assert!(html.contains("ignis") && html.contains("lapis") && html.contains("aurum"));
        assert!(html.contains("'Special Elite', 'Courier New'") && html.contains("monospace"));
        assert_eq!(text, "φ\r\n\r\nignis · lapis · aurum\r\n");
        for said in [
            "verification",
            "code",
            "didn't",
            "did not",
            "request",
            "ignore",
        ] {
            assert!(!html.to_lowercase().contains(said), "{said}");
            assert!(!text.to_lowercase().contains(said), "{said}");
        }
    }

    #[test]
    fn the_request_to_resend() {
        let out = request("https://api.resend.com", "re_test", &mail());
        assert_eq!(out.url, "https://api.resend.com/emails");
        let h: std::collections::HashMap<_, _> = out.headers.iter().cloned().collect();
        assert_eq!(h["Authorization"], "Bearer re_test");
        assert_eq!(h["Content-Type"], "application/json");
        assert!(!h["User-Agent"].is_empty());
        // a local stub, with or without the trailing slash; nothing set means Resend's own
        assert_eq!(
            request("http://127.0.0.1:9/", "k", &mail()).url,
            "http://127.0.0.1:9/emails"
        );
        assert_eq!(
            request(" ", "k", &mail()).url,
            "https://api.resend.com/emails"
        );
        // a display name outside ASCII goes through as it is, in UTF-8 JSON
        let named = Mail {
            from: "aφesis <clavis@aphes.ist>",
            ..mail()
        };
        let v: serde_json::Value = serde_json::from_str(&request("", "k", &named).body).unwrap();
        assert_eq!(v["from"], "aφesis <clavis@aphes.ist>");
    }

    #[test]
    fn words_are_escaped_in_the_html() {
        let odd = Mail {
            words: ["<b>", "a&b", "\"q\""],
            ..mail()
        };
        let html = html(&odd);
        assert!(
            html.contains("&lt;b&gt;")
                && html.contains("a&amp;b")
                && html.contains("&quot;q&quot;")
        );
        assert!(!html.contains("<b>"));
    }

    #[test]
    fn colours_follow_the_tokens() {
        // where the design-system branch is at hand (a full clone), its dark tokens must convert to these
        let Ok(out) = std::process::Command::new("git")
            .args(["show", "design-system:system/tokens.json"])
            .output()
        else {
            return;
        };
        if !out.status.success() {
            return;
        }
        let tok: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
        let table: std::collections::HashMap<String, String> = tok["color"]["tokens"]
            .as_array()
            .unwrap()
            .iter()
            .map(|t| {
                (
                    t["name"].as_str().unwrap().to_string(),
                    t["value"]["dark"].as_str().unwrap().to_string(),
                )
            })
            .collect();
        let resolve = |n: &str| {
            let mut v = table[n].clone();
            while v.starts_with('{') {
                v = table[&v[1..v.len() - 1]].clone();
            }
            oklch_hex(&v)
        };
        assert_eq!(resolve("bg"), BG);
        assert_eq!(resolve("ink"), INK);
        assert_eq!(resolve("ink-soft"), INK_SOFT);
        assert_eq!(resolve("accent"), ACCENT);
    }

    /// the same conversion as site/tools/tokens.py
    fn oklch_hex(s: &str) -> String {
        let v: Vec<f64> = s
            .trim_start_matches("oklch(")
            .trim_end_matches(')')
            .split_whitespace()
            .map(|x| x.parse().unwrap())
            .collect();
        let (l, c, h) = (v[0], v[1], v[2].to_radians());
        let (a, b) = (c * h.cos(), c * h.sin());
        let l_ = l + 0.3963377774 * a + 0.2158037573 * b;
        let m_ = l - 0.1055613458 * a - 0.0638541728 * b;
        let s_ = l - 0.0894841775 * a - 1.2914855480 * b;
        let (l3, m3, s3) = (l_.powi(3), m_.powi(3), s_.powi(3));
        let lin = [
            4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
            -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
            -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3,
        ];
        let gam = |x: f64| {
            if x <= 0.0031308 {
                12.92 * x
            } else {
                1.055 * x.powf(1.0 / 2.4) - 0.055
            }
        };
        let c = lin.map(|x| ((gam(x.max(0.0)) * 255.0).round().clamp(0.0, 255.0)) as u8);
        format!("#{:02x}{:02x}{:02x}", c[0], c[1], c[2])
    }
}
