//! Hashes and ids. A raw IP address is used once, here, to make a salted hash, and never stored or logged.
//!
//! - [`ip_hash`]: `SHA-256(IP_SALT + "|ip|" + address)`, 32 hex characters; the key for rate limits.
//! - [`poster_token`]: `SHA-256(POSTER_SALT + "|poster|" + thread + "|" + ipHash)`, cut to 16 hex characters. The
//!   same for one person all through one thread and different in every other thread, so sigils cannot follow
//!   anyone across the board. The page draws the sigil from it, so this format must never change.

use aphesis_common::hash::{random_bytes, sha256_hex};

pub fn ip_hash(ip: Option<&str>, salt: Option<&str>) -> String {
    let ip = ip.filter(|s| !s.is_empty()).unwrap_or("unknown");
    sha256_hex(&format!("{}|ip|{}", salt.unwrap_or(""), ip))[..32].to_string()
}

pub fn poster_token(salt: Option<&str>, thread: &str, ip_hash: &str) -> String {
    sha256_hex(&format!(
        "{}|poster|{}|{}",
        salt.unwrap_or(""),
        thread,
        ip_hash
    ))[..16]
        .to_string()
}

const B32: &[u8; 32] = b"abcdefghijkmnpqrstuvwxyz23456789";

pub fn id_from(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|b| B32[(b & 31) as usize] as char)
        .collect()
}

pub fn random_id(n: usize) -> String {
    id_from(&random_bytes(n))
}

/// `/^[a-z2-9]{10}$/`
pub fn is_thread_id(s: &str) -> bool {
    s.len() == 10
        && s.bytes()
            .all(|b| b.is_ascii_lowercase() || (b'2'..=b'9').contains(&b))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_same_values_as_the_javascript() {
        // node, with crypto.js: ipHash('203.0.113.7', 's1'), posterToken('s2', 'abcdefghjk', that)
        let ip = ip_hash(Some("203.0.113.7"), Some("s1"));
        assert_eq!(ip, "1376c1ae59eb9db377a28b420e393772");
        assert_eq!(
            poster_token(Some("s2"), "abcdefghjk", &ip),
            "61f9bc3476cdb26a"
        );
        assert_eq!(ip_hash(None, None), "55aec5d312ba8dfc7753854bed433930");
        assert_eq!(poster_token(None, "abcdefghjk", &ip), "0613d4e388d249e5");
    }

    #[test]
    fn tokens_differ_per_thread_and_person() {
        let a = ip_hash(Some("1.1.1.1"), Some("s1"));
        let b = ip_hash(Some("2.2.2.2"), Some("s1"));
        let t = poster_token(Some("s2"), "aaaaaaaaaa", &a);
        assert_eq!(t.len(), 16);
        assert!(t
            .bytes()
            .all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()));
        assert_eq!(t, poster_token(Some("s2"), "aaaaaaaaaa", &a));
        assert_ne!(t, poster_token(Some("s2"), "bbbbbbbbbb", &a));
        assert_ne!(t, poster_token(Some("s2"), "aaaaaaaaaa", &b));
        assert_ne!(t, poster_token(Some("other"), "aaaaaaaaaa", &a));
        assert!(!a.contains("1.1.1.1"));
    }

    #[test]
    fn ids() {
        assert_eq!(id_from(&[0, 31, 32, 255, 10]), "a9a9k");
        assert!(is_thread_id("abcdefghjk"));
        assert!(is_thread_id("zz22334455"));
        assert!(!is_thread_id("abcdefghj1"));
        assert!(!is_thread_id("ABCDEFGHJK"));
        assert!(!is_thread_id("abcdefghjkm"));
    }
}
