//! The site's texts: the short lines the owner can change from the dashboard (the ledes, the helper lines, the
//! empty states) without a rebuild.
//!
//! Every key the site reads is listed here once, with the screen it belongs to and its built-in default: the same
//! string the page carries. The page always has its own copy and shows it whenever the API does not answer or has
//! nothing set for a key, so a missing key never breaks a screen.
//!
//! D1 keeps only what the owner changed: `texts (key, value, version, updated)`. `value` is NULL after a reset, and
//! `version` only grows (a save and a reset each add one), so the sum of the versions is a version for the whole set.
//! The public API answers the keys that are set; the dashboard sees every key with its default.

use serde_json::{json, Value};

/// one editable text: its key, the screen it belongs to, what it is, and the page's built-in string
pub struct Text {
    pub key: &'static str,
    pub screen: &'static str,
    pub label: &'static str,
    pub default: &'static str,
}

const fn t(
    key: &'static str,
    screen: &'static str,
    label: &'static str,
    default: &'static str,
) -> Text {
    Text {
        key,
        screen,
        label,
        default,
    }
}

/// the screens, in the order the dashboard shows them; `meta` is no screen of its own but the whole page as a link
/// preview shows it (the site's Pages middleware writes these into the served page's meta tags)
pub const SCREENS: [&str; 6] = ["meta", "archive", "laboratory", "wall", "forum", "music"];

/// at most this many characters in a text
pub const MAX_CHARS: usize = 400;

pub const TEXTS: &[Text] = &[
    t("meta.title", "meta", "link preview: the title (discord, imessage, whatsapp, slack, x)", "aphes.ist"),
    t("meta.description", "meta", "link preview: the description under the title", "aphes.ist: one continuous page. the φ in the fog, the sections around it as an inscription."),
    t("archive.lede", "archive", "lede", "writing about anything, from draft to finished."),
    t("archive.empty", "archive", "the list with no posts", "the scraped tablet: nothing on it, everything possible."),
    t("archive.stage.nigredo", "archive", "stage tooltip: nigredo", "nigredo · the black: barely begun"),
    t("archive.stage.albedo", "archive", "stage tooltip: albedo", "albedo · the white: taking shape"),
    t("archive.stage.citrinitas", "archive", "stage tooltip: citrinitas", "citrinitas · the yellow: nearly there"),
    t("archive.stage.rubedo", "archive", "stage tooltip: rubedo", "rubedo · the red: finished"),
    t("laboratory.lede", "laboratory", "lede", "measured experiments. each one states what i expect, says how i measure it, runs here in your browser, and reports what it found, whatever it finds."),
    t("laboratory.live", "laboratory", "an experiment's meta line, after its number", "measured live in this browser"),
    t("wall.placeholder", "wall", "the empty line", "leave a line in the fog"),
    t("wall.helper", "wall", "the line's tooltip", "one line · no names · it fades after thirty days"),
    t("wall.sent", "wall", "after a line is posted", "it is in the fog now."),
    t("wall.empty", "wall", "the wall with no lines", "the wall is quiet. the first line is yours."),
    t("forum.lede", "forum", "lede", "talk without names. each voice gets a sigil, the same one all through a thread; every picture arrives as fog."),
    t("forum.empty", "forum", "the board with no threads", "the agora is quiet. start a thread, and the first word is yours."),
    t("forum.placeholder.thread", "forum", "a new thread, empty", "begin with a first line worth reading"),
    t("forum.placeholder.reply", "forum", "a reply, empty", "say it plainly. >>n quotes a post"),
    t("forum.pictures", "forum", "the pictures switch's tooltip", "pictures as fog, or words only"),
    t("music.lede", "music", "lede", "my music folder. mostly lossless."),
    t("music.idle", "music", "the player, with nothing playing", "choose a track, or play a folder"),
    t("music.empty", "music", "a search with no results", "nothing matches"),
];

pub fn find(key: &str) -> Option<&'static Text> {
    TEXTS.iter().find(|x| x.key == key)
}

/// A value the owner may set: one line of 1 to MAX_CHARS characters, its ends trimmed, no control characters.
pub fn value_in(body: &Value) -> Result<String, String> {
    let Some(v) = body.get("value").and_then(Value::as_str) else {
        return Err("value is a string".into());
    };
    let v = v.trim();
    if v.is_empty() {
        return Err("a text needs words: reset it to go back to the default".into());
    }
    if v.chars().count() > MAX_CHARS {
        return Err(format!("at most {MAX_CHARS} characters"));
    }
    if v.chars().any(|c| c.is_control()) {
        return Err("one line, no control characters".into());
    }
    Ok(v.to_string())
}

/// The version the save expects (`version` in the body), if it names one.
pub fn version_in(body: &Value) -> Result<Option<i64>, String> {
    match body.get("version") {
        None | Some(Value::Null) => Ok(None),
        Some(v) => v
            .as_i64()
            .filter(|n| *n >= 0)
            .map(Some)
            .ok_or_else(|| "version is a whole number".into()),
    }
}

/// One key for the dashboard: its place, its default and what is set now. `row` is its D1 row, if any.
pub fn admin_out(t: &Text, row: Option<&Value>) -> Value {
    let set = row.and_then(|r| r["value"].as_str());
    let version = row.and_then(|r| r["version"].as_i64()).unwrap_or(0);
    let updated = row.and_then(|r| r["updated"].as_i64());
    json!({
        "key": t.key,
        "screen": t.screen,
        "label": t.label,
        "default": t.default,
        "value": set.unwrap_or(t.default),
        "overridden": set.is_some(),
        "version": version,
        "updated": updated,
    })
}

/// The public answer: the keys the owner set (only keys the site knows), and the version of the whole set.
pub fn public_out(rows: &[Value]) -> Value {
    let mut texts = serde_json::Map::new();
    let mut version = 0i64;
    for r in rows {
        version += r["version"].as_i64().unwrap_or(0);
        if let (Some(k), Some(v)) = (r["key"].as_str(), r["value"].as_str()) {
            if find(k).is_some() {
                texts.insert(k.to_string(), Value::String(v.to_string()));
            }
        }
    }
    json!({ "texts": texts, "version": version })
}

/// The ETag of a public answer: its version, which changes with every save and every reset.
pub fn etag(version: i64) -> String {
    format!("\"t{version}\"")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn every_key_once_on_a_known_screen() {
        let mut seen = HashSet::new();
        for t in TEXTS {
            assert!(seen.insert(t.key), "{} twice", t.key);
            assert!(
                SCREENS.contains(&t.screen),
                "{}: screen {}",
                t.key,
                t.screen
            );
            assert!(
                t.key.starts_with(&format!("{}.", t.screen)),
                "{} is named after its screen",
                t.key
            );
            assert!(
                t.key.bytes().all(|b| b.is_ascii_lowercase() || b == b'.'),
                "{}",
                t.key
            );
        }
    }

    #[test]
    fn every_default_is_a_value_the_owner_could_set() {
        for t in TEXTS {
            assert_eq!(
                value_in(&json!({ "value": t.default })).as_deref(),
                Ok(t.default),
                "{}",
                t.key
            );
            assert_eq!(
                t.default,
                t.default.to_lowercase(),
                "{} is lowercase",
                t.key
            );
        }
    }

    #[test]
    fn the_link_preview_keeps_the_page_defaults() {
        // the same strings as the og and twitter tags in site/src/shell.html on the site branch
        assert_eq!(find("meta.title").unwrap().default, "aphes.ist");
        assert_eq!(
            find("meta.description").unwrap().default,
            "aphes.ist: one continuous page. the φ in the fog, the sections around it as an inscription."
        );
        assert_eq!(SCREENS[0], "meta");
    }

    #[test]
    fn values() {
        assert_eq!(
            value_in(&json!({ "value": "  my music folder.  " })).unwrap(),
            "my music folder."
        );
        assert!(value_in(&json!({ "value": "   " })).is_err());
        assert!(value_in(&json!({ "value": 3 })).is_err());
        assert!(value_in(&json!({})).is_err());
        assert!(value_in(&json!({ "value": "two\nlines" })).is_err());
        assert!(value_in(&json!({ "value": "a\u{7}bell" })).is_err());
        assert!(value_in(&json!({ "value": "φ".repeat(MAX_CHARS) })).is_ok());
        assert!(value_in(&json!({ "value": "φ".repeat(MAX_CHARS + 1) })).is_err());
    }

    #[test]
    fn versions() {
        assert_eq!(version_in(&json!({})), Ok(None));
        assert_eq!(version_in(&json!({ "version": null })), Ok(None));
        assert_eq!(version_in(&json!({ "version": 4 })), Ok(Some(4)));
        assert!(version_in(&json!({ "version": -1 })).is_err());
        assert!(version_in(&json!({ "version": "4" })).is_err());
    }

    #[test]
    fn admin_and_public_answers() {
        let t = find("music.lede").unwrap();
        let none = admin_out(t, None);
        assert_eq!(none["value"], t.default);
        assert_eq!(none["overridden"], false);
        assert_eq!(none["version"], 0);
        let row = json!({ "key": "music.lede", "value": "my folder.", "version": 2, "updated": 5 });
        let set = admin_out(t, Some(&row));
        assert_eq!(set["value"], "my folder.");
        assert_eq!(set["default"], t.default);
        assert_eq!(set["overridden"], true);
        let reset = json!({ "key": "music.lede", "value": null, "version": 3, "updated": 6 });
        assert_eq!(admin_out(t, Some(&reset))["value"], t.default);
        assert_eq!(admin_out(t, Some(&reset))["overridden"], false);

        let rows = vec![
            row.clone(),
            json!({ "key": "wall.sent", "value": null, "version": 1 }),
            json!({ "key": "gone.key", "value": "left over", "version": 1 }),
        ];
        let p = public_out(&rows);
        assert_eq!(p["texts"], json!({ "music.lede": "my folder." }));
        assert_eq!(p["version"], 4);
        assert_eq!(etag(4), "\"t4\"");
    }
}
