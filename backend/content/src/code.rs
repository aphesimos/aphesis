//! The email code: three Latin words from a curated list of 2048 (11 bits each, 33 bits together), lowercase
//! ASCII of 3 to 8 letters, so they are easy to read in a mail and to type on a phone.
//!
//! What the owner types is read loosely: any case, any separator between the words (spaces, `·`, dots, commas,
//! hyphens). Only the three words in their order count. The code is kept only as a salted hash.

use aphesis_common::hash::{hex, sha256};

const LIST: &str = include_str!("words.txt");

pub fn words() -> Vec<&'static str> {
    LIST.lines()
        .map(str::trim)
        .filter(|w| !w.is_empty())
        .collect()
}

/// Three words from 33 random bits (the first five bytes and one bit of the sixth).
pub fn generate(random: &[u8; 6]) -> [&'static str; 3] {
    let list = words();
    let n = random.iter().fold(0u64, |a, &b| a << 8 | b as u64);
    let pick = |i: u32| list[((n >> (i * 11)) & 0x7ff) as usize];
    [pick(0), pick(1), pick(2)]
}

/// What was typed, as the three words joined by single spaces, or `None` when it is not three listed words.
pub fn normalize(typed: &str) -> Option<String> {
    let list = words();
    let parts: Vec<String> = typed
        .split(|c: char| !c.is_ascii_alphabetic())
        .filter(|w| !w.is_empty())
        .map(|w| w.to_ascii_lowercase())
        .collect();
    if parts.len() != 3 || parts.iter().any(|w| !list.contains(&w.as_str())) {
        return None;
    }
    Some(parts.join(" "))
}

/// The stored form: SHA-256 of the salt, the pending token and the words.
pub fn digest(salt: &str, token: &str, words: &str) -> String {
    hex(&sha256(format!("{salt}|code|{token}|{words}").as_bytes()))
}

/// As the mail shows it: ignis · lapis · aurum
pub fn display(w: &[&str; 3]) -> String {
    w.join(" · ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_list_is_2048_easy_words() {
        let w = words();
        assert_eq!(w.len(), 2048);
        let mut s = w.clone();
        s.sort();
        s.dedup();
        assert_eq!(s.len(), 2048, "no word twice");
        for x in &w {
            assert!(
                (3..=8).contains(&x.len()) && x.bytes().all(|b| b.is_ascii_lowercase()),
                "{x}"
            );
        }
    }

    #[test]
    fn three_words_from_33_bits() {
        let w = words();
        assert_eq!(generate(&[0; 6]), [w[0], w[0], w[0]]);
        assert_eq!(generate(&[0, 0, 0, 0, 0, 0xff]), [w[255], w[0], w[0]]);
        assert_eq!(generate(&[0, 0, 0, 0, 0x07, 0xff]), [w[2047], w[0], w[0]]);
        assert_eq!(generate(&[0, 0, 0, 0, 0x08, 0x00]), [w[0], w[1], w[0]]);
        assert_eq!(generate(&[0, 0, 0, 0x40, 0, 0]), [w[0], w[0], w[1]]);
        assert_eq!(generate(&[0xff; 6]), [w[2047], w[2047], w[2047]]);
        // 33 bits: the top 15 bits of the six bytes are unused
        assert_eq!(generate(&[0xff, 0xfe, 0, 0, 0, 0]), [w[0], w[0], w[0]]);
    }

    #[test]
    fn typed_codes_are_read_loosely() {
        let w = words();
        let code = format!("{} {} {}", w[10], w[20], w[30]);
        assert_eq!(normalize(&code).as_deref(), Some(code.as_str()));
        let loose = format!("  {} · {}.{}-  ", w[10].to_uppercase(), w[20], w[30]);
        assert_eq!(normalize(&loose).as_deref(), Some(code.as_str()));
        assert_eq!(normalize(&format!("{} {}", w[10], w[20])), None);
        assert_eq!(normalize(&format!("{code} {}", w[1])), None);
        assert_eq!(normalize("qqq www eee"), None);
        assert_eq!(normalize(""), None);
        assert_eq!(
            display(&["ignis", "lapis", "aurum"]),
            "ignis · lapis · aurum"
        );
    }

    #[test]
    fn the_digest_depends_on_salt_token_and_words() {
        let a = digest("s", "t", "a b c");
        assert_eq!(a.len(), 64);
        assert_ne!(a, digest("s2", "t", "a b c"));
        assert_ne!(a, digest("s", "t2", "a b c"));
        assert_ne!(a, digest("s", "t", "a b d"));
    }
}
