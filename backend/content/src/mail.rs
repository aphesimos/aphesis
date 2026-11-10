//! The gate's email: the second key, sent to the owner's verified address through the `send_email` binding.
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
    /// RFC 5322 date
    pub date: &'a str,
    /// unique, without the angle brackets
    pub message_id: &'a str,
    pub boundary: &'a str,
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

/// base64 in lines of 76, as MIME wants
fn b64_lines(s: &str) -> String {
    let b = crate::pbkdf2::b64_encode(s.as_bytes());
    b.as_bytes()
        .chunks(76)
        .map(|c| std::str::from_utf8(c).unwrap_or(""))
        .collect::<Vec<_>>()
        .join("\r\n")
}

/// The whole message, headers and both parts.
pub fn raw(m: &Mail) -> String {
    let b = m.boundary;
    format!(
        "From: {from}\r\nTo: {to}\r\nSubject: {SUBJECT}\r\nDate: {date}\r\nMessage-ID: <{id}>\r\n\
MIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary=\"{b}\"\r\n\r\n\
--{b}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n{text}\r\n\
--{b}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n{html}\r\n\
--{b}--\r\n",
        from = m.from,
        to = m.to,
        date = m.date,
        id = m.message_id,
        text = b64_lines(&text(m)),
        html = b64_lines(&html(m)),
    )
}

/// RFC 5322 date from ms since the epoch, in UTC: `Tue, 10 Nov 2026 12:00:00 +0000`
pub fn rfc5322(ms: i64) -> String {
    const D: [&str; 7] = ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"];
    const M: [&str; 12] = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    let day = aphesis_common::time::iso_day(ms);
    let (y, mo, d) = (
        &day[0..4],
        day[5..7].parse::<usize>().unwrap_or(1),
        &day[8..10],
    );
    let days = ms.div_euclid(86_400_000);
    let s = ms.div_euclid(1000).rem_euclid(86_400);
    format!(
        "{}, {} {} {} {:02}:{:02}:{:02} +0000",
        D[days.rem_euclid(7) as usize],
        d,
        M[mo - 1],
        y,
        s / 3600,
        s / 60 % 60,
        s % 60
    )
}

/// The envelope's domain, for the Message-ID: what follows the @ of the sender.
pub fn domain(from: &str) -> &str {
    from.rsplit_once('@')
        .map(|(_, d)| d.trim_end_matches('>'))
        .unwrap_or("aphes.ist")
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
            date: "Tue, 10 Nov 2026 12:00:00 +0000",
            message_id: "abc@aphes.ist",
            boundary: "phi-boundary",
        }
    }

    fn decode_part(raw: &str, ctype: &str) -> String {
        let at = raw.find(&format!("Content-Type: {ctype}")).unwrap();
        let body = &raw[at..];
        let start = body.find("\r\n\r\n").unwrap() + 4;
        let end = body[start..].find("\r\n--").unwrap() + start;
        let b64: String = body[start..end].split("\r\n").collect();
        String::from_utf8(crate::pbkdf2::b64_decode(&b64).unwrap()).unwrap()
    }

    #[test]
    fn follows_the_backlog() {
        let m = mail();
        let raw = raw(&m);
        assert!(raw.contains("Subject: clavis\r\n"));
        assert!(raw.contains("Message-ID: <abc@aphes.ist>\r\n"));
        assert!(raw.contains("From: clavis@aphes.ist\r\nTo: owner@example.com\r\n"));
        assert!(raw.contains("multipart/alternative"));
        assert!(raw.lines().all(|l| l.len() <= 998));
        let html = decode_part(&raw, "text/html");
        let text = decode_part(&raw, "text/plain");
        assert!(html.contains(&format!("background:{BG}")));
        assert!(html.contains("src=\"https://content-api.aphes.ist/media/mail/phi.png\""));
        assert!(html.contains("ignis") && html.contains("lapis") && html.contains("aurum"));
        assert!(html.contains("'Special Elite', 'Courier New'") && html.contains("monospace"));
        assert!(text.contains("ignis · lapis · aurum"));
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
    fn dates_and_domains() {
        // Date.UTC(2026, 10, 10, 12) is a Tuesday
        assert_eq!(
            rfc5322(1_794_312_000_000),
            "Tue, 10 Nov 2026 12:00:00 +0000"
        );
        assert_eq!(rfc5322(0), "Thu, 01 Jan 1970 00:00:00 +0000");
        assert_eq!(
            rfc5322(951_782_400_000 + 3_723_000),
            "Tue, 29 Feb 2000 01:02:03 +0000"
        );
        assert_eq!(domain("clavis@aphes.ist"), "aphes.ist");
        assert_eq!(domain("aφesis <clavis@aphes.ist>"), "aphes.ist");
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
