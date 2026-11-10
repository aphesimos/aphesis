//! Comparing secrets in equal time, so an admin key cannot be guessed one character at a time: every byte of the
//! longer input is visited and differences are OR-ed together, with no early exit.

pub fn same(a: &[u8], b: &[u8]) -> bool {
    let n = a.len().max(b.len());
    let mut d = (a.len() ^ b.len()) as u64;
    for i in 0..n {
        let x = *a.get(i).unwrap_or(&0);
        let y = *b.get(i).unwrap_or(&0);
        d |= (x ^ y) as u64;
    }
    std::hint::black_box(d) == 0
}

/// `Authorization: Bearer <secret>`, compared in equal time. The header must be exactly `Bearer ` and the
/// secret (the wall's rule). An absent secret refuses everything.
pub fn bearer_exact(header: &str, secret: Option<&str>) -> bool {
    match secret {
        Some(s) if !s.is_empty() => same(header.as_bytes(), format!("Bearer {s}").as_bytes()),
        _ => false,
    }
}

/// The forum's rule: a leading `Bearer` and whitespace (any case) is dropped, then what is left must equal the
/// secret; an empty header or secret refuses.
pub fn bearer_loose(header: &str, secret: Option<&str>) -> bool {
    let secret = match secret {
        Some(s) if !s.is_empty() => s,
        _ => return false,
    };
    let given = strip_bearer(header);
    if given.is_empty() {
        return false;
    }
    same(given.as_bytes(), secret.as_bytes())
}

/// `h.replace(/^Bearer\s+/i, '')`
fn strip_bearer(h: &str) -> &str {
    if h.len() >= 6 && h.is_char_boundary(6) && h[..6].eq_ignore_ascii_case("bearer") {
        let rest = &h[6..];
        let trimmed = rest.trim_start_matches(crate::time::is_js_space);
        if trimmed.len() < rest.len() {
            return trimmed;
        }
    }
    h
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn equal_time_compare() {
        assert!(same(b"abc", b"abc"));
        assert!(!same(b"abc", b"abd"));
        assert!(!same(b"abc", b"abcd"));
        assert!(!same(b"", b"a"));
        assert!(same(b"", b""));
    }

    #[test]
    fn bearer_rules() {
        assert!(bearer_exact("Bearer secret-admin", Some("secret-admin")));
        assert!(!bearer_exact("bearer secret-admin", Some("secret-admin")));
        assert!(!bearer_exact("Bearer wrong", Some("secret-admin")));
        assert!(!bearer_exact("", Some("secret-admin")));
        assert!(!bearer_exact("Bearer ", None));
        assert!(!bearer_exact("Bearer ", Some("")));

        assert!(bearer_loose("Bearer open-sesame", Some("open-sesame")));
        assert!(bearer_loose("bearer   open-sesame", Some("open-sesame")));
        assert!(bearer_loose("open-sesame", Some("open-sesame")));
        assert!(!bearer_loose("Bearer wrong", Some("open-sesame")));
        assert!(!bearer_loose("Bearer", Some("open-sesame")));
        assert!(!bearer_loose("", Some("open-sesame")));
        assert!(!bearer_loose("Bearer x", None));
        assert!(!bearer_loose("Bearerx", Some("x")));
    }
}
