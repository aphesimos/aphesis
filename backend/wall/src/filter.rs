//! filter: what the wall keeps out. A line-for-line port of the page's `filter.js` (on the `section/wall`
//! branch, `wall/worker/src/filter.js`), which the page still runs before sending. Both are checked against the
//! same vectors (`tests/filter-vectors.json`): `cargo test` here, node there.
//!
//! - [`clean`]: the line as it will be kept: one line, spaces collapsed, trimmed, control characters gone.
//! - [`check`]: `Ok(text)` or a refusal: `empty`, `long`, `word` or `link`.
//!
//! Words are matched after normalising: lowercase, accents stripped, look-alike digits and signs mapped to letters
//! (0 -> o, 1 -> i, 3 -> e, 4 -> a, 5 -> s, 7 -> t, @ -> a, $ -> s, ...), repeated letters folded, and letters spelled
//! apart with spaces or dots joined again ("s.h.i.t" -> "shit"). Each word is matched as a whole token or at the
//! start of one, so "class" or "scunthorpe" pass.
//!
//! Where JavaScript's semantics are not Rust's, they are reproduced: `\s` is JavaScript's whitespace class, length
//! is counted in code points (`Array.from(t).length`), and the link pattern is ASCII-only in case folding and word
//! boundaries, as a JavaScript regex without the `u` flag is (regex-lite has exactly those semantics).

use std::collections::BTreeSet;
use std::sync::OnceLock;

use aphesis_common::time::is_js_space;
use serde::Serialize;
use unicode_normalization::UnicodeNormalization;

pub const MAX_LENGTH: usize = 140;

/// stems matched at the start of a token; kept short and plain on purpose. Extend with BLOCKLIST, not here
const WORDS: &[&str] = &[
    "fuck",
    "shit",
    "cunt",
    "cock",
    "dick",
    "pussy",
    "bitch",
    "bastard",
    "asshole",
    "arsehole",
    "wank",
    "twat",
    "whore",
    "slut",
    "porn",
    "rape",
    "rapist",
    "nazi",
    "hitler",
    "nigger",
    "nigga",
    "faggot",
    "fag",
    "retard",
    "kike",
    "spic",
    "chink",
    "tranny",
    "paki",
    "killyourself",
    "kys",
];

/// stems that are also the start of harmless words: these must be the whole token
const WHOLE: &[&str] = &[
    "cock", "dick", "fag", "spic", "paki", "kys", "rape", "porn", "twat", "nazi",
];

/// harmless words that start like a stem
const ALLOW: &[&str] = &[
    "shitake",
    "shiitake",
    "cockatoo",
    "cockatiel",
    "cockle",
    "cockles",
    "cockpit",
    "cocktail",
    "cocktails",
    "bitchute",
    "spice",
    "spicy",
    "pakistan",
    "pakistani",
    "rapeseed",
];

const LINK: &str = r"(?i)(https?://|www\.|\b[a-z0-9-]{2,}\.(com|net|org|io|ru|xyz|info|biz|top|link|click|me|co|app|gg|ly)\b|@[a-z0-9_]{3,}\b|\bt\.me\b|discord\.gg)";

fn link() -> &'static regex_lite::Regex {
    static RE: OnceLock<regex_lite::Regex> = OnceLock::new();
    RE.get_or_init(|| regex_lite::Regex::new(LINK).expect("link pattern"))
}

fn look(c: char) -> char {
    match c {
        '0' => 'o',
        '1' | '!' | '|' => 'i',
        '3' => 'e',
        '4' | '@' => 'a',
        '5' | '$' => 's',
        '7' | '+' => 't',
        '8' => 'b',
        _ => c,
    }
}

/// The characters the JavaScript replaces with a space: C0 and C1 controls, zero-width and direction marks,
/// line and paragraph separators, invisible operators and the byte order mark.
fn invisible(c: char) -> bool {
    matches!(c, '\u{0}'..='\u{1F}' | '\u{7F}'..='\u{9F}' | '\u{200B}'..='\u{200F}' | '\u{2028}'..='\u{202E}' | '\u{2060}'..='\u{206F}' | '\u{FEFF}')
}

pub fn clean(text: &str) -> String {
    let nfc: String = text
        .nfc()
        .map(|c| if invisible(c) { ' ' } else { c })
        .collect();
    let mut out = String::with_capacity(nfc.len());
    let mut space = false;
    for c in nfc.chars() {
        if is_js_space(c) {
            space = true;
        } else {
            if space && !out.is_empty() {
                out.push(' ');
            }
            space = false;
            out.push(c);
        }
    }
    out
}

fn fold(s: &str) -> String {
    s.to_lowercase()
        .nfkd()
        .filter(|c| !('\u{300}'..='\u{36F}').contains(c))
        .map(look)
        .collect()
}

/// `s.replace(/(.)\1+/g, '$1')` on letters a-z
fn squeeze(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut last = None;
    for c in s.chars() {
        if Some(c) != last {
            out.push(c);
        }
        last = Some(c);
    }
    out
}

fn separator(c: char) -> bool {
    is_js_space(c) || ".-_*,:;'\"~^`/\\".contains(c)
}

/// The tokens a line is read as: its words, the words with repeated letters folded, runs of single letters joined
/// ("f u c k", "s.h.i.t"), and two neighbouring words written together.
fn tokens(text: &str) -> BTreeSet<String> {
    let f = fold(text);
    let words: Vec<&str> = f
        .split(|c: char| !c.is_ascii_lowercase())
        .filter(|w| !w.is_empty())
        .collect();
    let mut out = BTreeSet::new();
    for w in &words {
        out.insert(w.to_string());
        out.insert(squeeze(w));
    }
    let mut run = String::new();
    for p in f
        .split(separator)
        .filter(|p| !p.is_empty())
        .chain(std::iter::once(""))
    {
        let mut cs = p.chars();
        if let (Some(c), None) = (cs.next(), cs.next()) {
            if c.is_ascii_lowercase() {
                run.push(c);
                continue;
            }
        }
        if run.len() > 2 {
            out.insert(squeeze(&run));
            out.insert(std::mem::take(&mut run));
        }
        run.clear();
    }
    for pair in words.windows(2) {
        out.insert(format!("{}{}", pair[0], pair[1]));
    }
    out
}

fn hits(tok: &str, word: &str) -> bool {
    if WHOLE.contains(&word) {
        tok == word
    } else {
        tok.starts_with(word)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(untagged)]
pub enum Verdict {
    Ok { ok: bool, text: String },
    Refused { ok: bool, reason: &'static str },
}

impl Verdict {
    fn ok(text: String) -> Self {
        Verdict::Ok { ok: true, text }
    }
    fn no(reason: &'static str) -> Self {
        Verdict::Refused { ok: false, reason }
    }
    pub fn is_ok(&self) -> bool {
        matches!(self, Verdict::Ok { .. })
    }
}

/// `extra`: further words, e.g. from the BLOCKLIST variable.
pub fn check(text: &str, extra: &[String]) -> Verdict {
    let t = clean(text);
    if t.is_empty() {
        return Verdict::no("empty");
    }
    if t.chars().count() > MAX_LENGTH {
        return Verdict::no("long");
    }
    if link().is_match(&t) {
        return Verdict::no("link");
    }
    let extra: Vec<String> = extra
        .iter()
        .map(|w| {
            fold(w)
                .chars()
                .filter(char::is_ascii_lowercase)
                .collect::<String>()
        })
        .filter(|w| w.len() > 1)
        .collect();
    let list: Vec<&str> = WORDS
        .iter()
        .copied()
        .chain(extra.iter().map(String::as_str))
        .collect();
    for tok in tokens(&t) {
        if ALLOW.contains(&tok.as_str()) {
            continue;
        }
        if list.iter().any(|w| hits(&tok, w)) {
            return Verdict::no("word");
        }
    }
    Verdict::ok(t)
}

/// The BLOCKLIST variable: comma-separated, blanks ignored.
pub fn blocklist(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn no(r: &'static str) -> Verdict {
        Verdict::no(r)
    }

    #[test]
    fn keeps_quiet_lines() {
        for t in [
            "festina lente",
            "i left a door open in a dream and the fog came in",
            "the class met in scunthorpe",
            "a cocktail, a dickens novel, a pass",
            "shiitake soup, a cockatoo",
            "Ἄφεσις · 色即是空",
        ] {
            assert!(check(t, &[]).is_ok(), "{t}");
        }
    }

    #[test]
    fn cleans_to_one_line() {
        assert_eq!(clean("  two\n lines\t here \u{200b} "), "two lines here");
        assert_eq!(check("a\nb", &[]), Verdict::ok("a b".into()));
    }

    #[test]
    fn refuses_empty_and_long_lines() {
        assert_eq!(check("   ", &[]), no("empty"));
        assert!(check(&"x".repeat(MAX_LENGTH), &[]).is_ok());
        assert_eq!(check(&"x".repeat(MAX_LENGTH + 1), &[]), no("long"));
        assert!(check(&"色".repeat(MAX_LENGTH), &[]).is_ok());
    }

    #[test]
    fn refuses_words_in_disguise_too() {
        for t in [
            "shit",
            "what the FUCK",
            "sh1t happens",
            "s.h.i.t",
            "f u c k this",
            "fuuuuck",
            "shit",
            "you b!tch",
            "a big d1ck",
            "kys",
            "kill yourself",
            "shït",
        ] {
            assert_eq!(check(t, &[]), no("word"), "{t}");
        }
    }

    #[test]
    fn refuses_links_and_handles() {
        for t in [
            "see https://x.example",
            "www.spam",
            "buy at cheap-pills.com",
            "follow @someone_here",
            "join discord.gg/abc",
        ] {
            assert_eq!(check(t, &[]), no("link"), "{t}");
        }
    }

    #[test]
    fn takes_extra_words() {
        assert!(check("the word is marmalade", &[]).is_ok());
        assert_eq!(
            check("the word is marmalade", &["marmalade".into()]),
            no("word")
        );
        assert_eq!(
            blocklist(" a, ,marmalade ,"),
            vec!["a".to_string(), "marmalade".to_string()]
        );
    }
}
