//! The wall's rate rule and visitor key, as in the JavaScript Worker's `ratelimit.js`.

use aphesis_common::hash::{hex, sha256};
use aphesis_common::ratelimit::window::Rule;
use aphesis_common::time::iso_day;

/// per visitor: at most 4 posts in 10 minutes, and 20 seconds between two
pub const RULE: Rule = Rule {
    limit: 4,
    window_ms: 10 * 60 * 1000,
    gap_ms: 20 * 1000,
};

/// SHA-256 of `salt|day|address`, first 16 bytes in hex: it cannot be reversed, and it changes every day. The
/// address itself is never stored.
pub fn visitor_key(ip: &str, salt: &str, now_ms: i64) -> String {
    let digest = sha256(format!("{salt}|{}|{ip}", iso_day(now_ms)).as_bytes());
    hex(&digest[..16])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn visitor_keys_are_hashed_salted_and_daily() {
        let day = 1_794_312_000_000; // Date.UTC(2026, 10, 10, 12)
        let a = visitor_key("203.0.113.7", "salt", day);
        assert_eq!(a.len(), 32);
        assert!(a
            .bytes()
            .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()));
        assert!(!a.contains("203"));
        assert_eq!(a, visitor_key("203.0.113.7", "salt", day + 3_600_000));
        assert_ne!(a, visitor_key("203.0.113.7", "salt", day + 86_400_000));
        assert_ne!(a, visitor_key("203.0.113.7", "other", day));
        assert_ne!(a, visitor_key("203.0.113.8", "salt", day));
        // the value the JavaScript Worker gives for the same input (node: visitorKey('203.0.113.7', 'salt', day))
        assert_eq!(a, JS_VALUE);
    }

    const JS_VALUE: &str = "41f345de95066ebebbfdddcc00f6c64c";
}
