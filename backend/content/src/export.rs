//! The nightly export: every entry, drafts too, written back as the files the section branches read, and committed
//! to the repository's `content` branch as the owner, so the content lives in git as well as in D1.
//!
//! - `archive/content/<slug>.md`: front matter (title, date, stage, summary, example, published), the body, the notes
//!   as `[^id]: text` lines, and the figures as `figure: <name> <url>` lines in the front matter;
//! - `book/content/<NN>-<slug>.md`: the book's front matter, the picture by URL, the note's paragraphs;
//! - `works/content/works.json`: the shape of section/works' file, each map's `file` its URL, with each work's `line`
//!   and `status` when it has them;
//! - `me/content/awards.json`: the awards, in order, as `{awards: [{id, title, note, line, published?}]}`.
//!
//! Pictures stay in R2 under keys made from their bytes, so a URL in an exported file never changes what it shows.
//! The formatting is pure and tested here; the commit goes through GitHub's git data API (one tree, one commit, and
//! only when the tree changed), with `EXPORT_GITHUB_TOKEN` (contents: write on the repository).

use serde_json::{json, Value};

pub const OWNER_NAME: &str = "aphesist";
pub const OWNER_EMAIL: &str = "126630868+aphesist@users.noreply.github.com";

fn st<'a>(v: &'a Value, k: &str) -> &'a str {
    v[k].as_str().unwrap_or("")
}

/// a front matter value: quoted when it would not read back as itself
fn fm(v: &str) -> String {
    let plain = !v.is_empty()
        && !v.starts_with(['"', '\'', ' ', '#', '-', '[', '{'])
        && !v.ends_with(' ')
        && !v.contains('\n')
        && v != "true"
        && v != "false";
    if plain {
        v.to_string()
    } else {
        format!("\"{}\"", v.replace('\n', " ").replace('"', "'"))
    }
}

pub fn post_md(p: &Value) -> String {
    let mut s = String::from("---\n");
    for k in ["title", "date", "stage", "summary"] {
        s += &format!("{k}: {}\n", fm(st(p, k)));
    }
    if p["example"].as_bool() == Some(true) {
        s += "example: true\n";
    }
    if p["published"].as_bool() == Some(false) {
        s += "published: false\n";
    }
    for f in p["figures"].as_array().map(|a| a.as_slice()).unwrap_or(&[]) {
        s += &format!("figure: {} {}\n", st(f, "name"), st(f, "url"));
    }
    s += "---\n";
    s += st(p, "body").trim();
    s += "\n";
    for n in p["notes"].as_array().map(|a| a.as_slice()).unwrap_or(&[]) {
        s += &format!("\n[^{}]: {}\n", st(n, "id"), st(n, "text"));
    }
    s
}

pub fn book_md(b: &Value) -> String {
    let mut s = String::from("---\n");
    for k in ["title", "author", "year"] {
        s += &format!("{k}: {}\n", fm(st(b, k)));
    }
    s += &format!("picture: {}\n", st(&b["picture"], "url"));
    s += &format!("caption: {}\n", fm(st(b, "caption")));
    for k in ["quote", "quote_lang", "quote_en"] {
        if !st(b, k).is_empty() {
            s += &format!("{k}: {}\n", fm(st(b, k)));
        }
    }
    if let Some(a) = b["adjust"].as_object() {
        for k in crate::model::BOOK_ADJUST {
            if let Some(x) = a.get(k).and_then(Value::as_f64) {
                s += &format!("{k}: {x}\n");
            }
        }
        if let Some(c) = a.get("crop").and_then(Value::as_array) {
            s += &format!(
                "crop: {}\n",
                c.iter()
                    .map(|x| x.as_f64().unwrap_or(0.0).to_string())
                    .collect::<Vec<_>>()
                    .join(" ")
            );
        }
    }
    if b["example"].as_bool() == Some(true) {
        s += "example: true\n";
    }
    if b["published"].as_bool() == Some(false) {
        s += "published: false\n";
    }
    s += "---\n";
    let note: Vec<&str> = b["note"]
        .as_array()
        .map(|a| a.iter().filter_map(Value::as_str).collect())
        .unwrap_or_default();
    s += &note.join("\n\n");
    s += "\n";
    s
}

pub fn book_file(i: usize, b: &Value) -> String {
    format!("book/content/{:02}-{}.md", i + 1, st(b, "slug"))
}

pub fn works_json(works: &[Value]) -> String {
    let list: Vec<Value> = works
        .iter()
        .map(|w| {
            let mut o = json!({
                "id": w["id"], "name": w["name"], "gloss": w["gloss"], "gloss_tip": w["gloss_tip"], "year": w["year"],
                "role": w["role"], "description": w["description"], "links": w["links"],
                "map": { "file": w["map"]["url"], "caption": w["map"]["caption"], "settings": w["map"]["settings"] },
                "sources": w["sources"], "flags": w["flags"],
            });
            for k in ["line", "status"] {
                if !st(w, k).is_empty() {
                    o[k] = w[k].clone();
                }
            }
            if w["published"].as_bool() == Some(false) {
                o["published"] = json!(false);
            }
            o
        })
        .collect();
    serde_json::to_string_pretty(
        &json!({ "section": crate::model::works_section(), "works": list }),
    )
    .unwrap_or_default()
        + "\n"
}

pub fn awards_json(awards: &[Value]) -> String {
    let list: Vec<Value> = awards
        .iter()
        .map(|a| {
            let mut o =
                json!({ "id": a["id"], "title": a["title"], "note": a["note"], "line": a["line"] });
            if a["published"].as_bool() == Some(false) {
                o["published"] = json!(false);
            }
            o
        })
        .collect();
    serde_json::to_string_pretty(&json!({ "awards": list })).unwrap_or_default() + "\n"
}

/// every file of the export: (path, text)
pub fn files(
    posts: &[Value],
    books: &[Value],
    works: &[Value],
    awards: &[Value],
) -> Vec<(String, String)> {
    let mut out: Vec<(String, String)> = posts
        .iter()
        .map(|p| (format!("archive/content/{}.md", st(p, "slug")), post_md(p)))
        .collect();
    out.extend(
        books
            .iter()
            .enumerate()
            .map(|(i, b)| (book_file(i, b), book_md(b))),
    );
    out.push(("works/content/works.json".into(), works_json(works)));
    out.push(("me/content/awards.json".into(), awards_json(awards)));
    out.push((
        "README.md".into(),
        "# content\n\nThe nightly export of the content service: every archive post, book entry, work and award, drafts too, \
in the files the section branches read. Written by the content Worker; do not edit here, edit in the dashboard.\n"
            .into(),
    ));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_post_reads_back_as_the_archive_writes_it() {
        let p = json!({ "slug": "on-salt", "title": "on salt", "date": "2026-12-01", "stage": "nigredo", "summary": "a line: with a colon.",
                        "body": "salt.[^a]\n\n![c](simulacrum:salt)\n", "notes": [{ "id": "a", "text": "a note." }],
                        "figures": [{ "name": "salt", "url": "https://c/media/m/x.png" }], "example": false, "published": false });
        let md = post_md(&p);
        assert!(md.starts_with("---\ntitle: on salt\ndate: 2026-12-01\nstage: nigredo\nsummary: a line: with a colon.\n"));
        assert!(md.contains("published: false\n"));
        assert!(md.contains("figure: salt https://c/media/m/x.png\n"));
        assert!(md.ends_with("---\nsalt.[^a]\n\n![c](simulacrum:salt)\n\n[^a]: a note.\n"));
    }

    #[test]
    fn a_book_entry_and_works() {
        let b = json!({ "slug": "faust", "title": "faust", "author": "Rembrandt van Rijn", "year": "etching, c. 1652",
                        "picture": { "url": "https://c/media/m/y.jpg" }, "caption": "a scholar · Rembrandt", "quote": "\"Daß\" ich",
                        "quote_lang": "de", "quote_en": "", "adjust": { "gain": 1.1, "crop": [0, 10, 400, 300] }, "note": ["one.", "two."], "example": true });
        let md = book_md(&b);
        assert!(md.contains("picture: https://c/media/m/y.jpg\n"));
        assert!(md.contains("quote: \"'Daß' ich\"\n"));
        assert!(!md.contains("quote_en"));
        assert!(md.contains("gain: 1.1\ncrop: 0 10 400 300\nexample: true\n"));
        assert!(md.ends_with("---\none.\n\ntwo.\n"));
        assert_eq!(book_file(3, &b), "book/content/04-faust.md");
        let w = json!({ "id": "x", "name": "x", "map": { "url": "u", "caption": "c", "settings": {} }, "published": true });
        let j: Value = serde_json::from_str(&works_json(&[w])).unwrap();
        assert_eq!(j["works"][0]["map"]["file"], "u");
        assert_eq!(j["section"]["gloss"], "opera");
        assert!(j["works"][0].get("published").is_none());
        assert_eq!(files(&[], &[], &[], &[]).len(), 3);
    }

    #[test]
    fn works_carry_their_line_and_awards_are_a_file() {
        let w = json!({ "id": "x", "line": "a line.", "status": "", "map": { "url": "u" }, "published": true });
        let j: Value = serde_json::from_str(&works_json(&[w])).unwrap();
        assert_eq!(j["works"][0]["line"], "a line.");
        assert!(
            j["works"][0].get("status").is_none(),
            "an empty status is left out"
        );
        let a = json!({ "id": "a", "title": "t", "note": "", "line": "l", "published": false });
        let j: Value = serde_json::from_str(&awards_json(&[a])).unwrap();
        assert_eq!(j["awards"][0]["title"], "t");
        assert_eq!(j["awards"][0]["published"], false);
    }
}
