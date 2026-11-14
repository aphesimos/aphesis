//! The three kinds of entries: what the dashboard may write (checked here, pure functions over JSON) and what the
//! API answers (built from D1 rows). Pictures are R2 keys in storage and absolute URLs in answers.
//!
//! - **post** (archive · codex): slug, title, summary, stage, date, markdown body, notes `[{id, text}]` (the
//!   archive's `[^id]` footnotes), figures `[{name, key, w, h}]` (density maps the body names as
//!   `![caption](simulacrum:<name>)`), example, published.
//! - **book** (book · liber): slug, title, author, year, note (paragraphs separated by a blank line, line breaks kept inside: the archive's small markdown), quote,
//!   quote_lang, quote_en, caption, picture `{key, w, h}`, adjust (simulacrum settings and map adjustments:
//!   gain, scatter, erosion, ceiling, crop `[x, y, w, h]`, blur, contrast, brightness), position, example, published.
//! - **work** (works · opera): the fields of section/works `content/works.json`: id, name, gloss, gloss_tip, year,
//!   role, description, links `[{label, href}]`, map `{key, w, h, caption, settings}`, sources, flags, position,
//!   published; and for the me page a one-line summary (`line`) and a short `status` ("in progress").
//! - **award** (me · awards): id, title, note (who it was with), line (what it was for), position, published. No
//!   pictures.

use serde_json::{json, Map, Value};

pub const STAGES: [&str; 4] = ["nigredo", "albedo", "citrinitas", "rubedo"];
pub const BOOK_ADJUST: [&str; 7] = [
    "gain",
    "scatter",
    "erosion",
    "ceiling",
    "blur",
    "contrast",
    "brightness",
];
pub const WORK_SETTINGS: [&str; 4] = ["scatter", "erosion", "ceiling", "gain"];

type R<T> = Result<T, String>;

fn slug_ok(s: &str, max: usize) -> bool {
    !s.is_empty()
        && s.len() <= max
        && s.bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
        && !s.starts_with('-')
        && !s.ends_with('-')
}

/// a media key the content service made: `m/<24 hex>.<png|jpg>`
pub fn key_ok(k: &str) -> bool {
    let Some(rest) = k.strip_prefix("m/") else {
        return false;
    };
    let Some((h, ext)) = rest.split_once('.') else {
        return false;
    };
    h.len() == 24
        && h.bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        && (ext == "png" || ext == "jpg")
}

fn date_ok(s: &str) -> bool {
    let b = s.as_bytes();
    if b.len() != 10 || b[4] != b'-' || b[7] != b'-' {
        return false;
    }
    let (Ok(y), Ok(m), Ok(d)) = (
        s[0..4].parse::<u32>(),
        s[5..7].parse::<u32>(),
        s[8..10].parse::<u32>(),
    ) else {
        return false;
    };
    let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    let days = [
        31,
        if leap { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    (1000..=9999).contains(&y) && (1..=12).contains(&m) && d >= 1 && d <= days[(m - 1) as usize]
}

fn lang_ok(s: &str) -> bool {
    s.is_empty() || {
        let mut p = s.split('-');
        let first = p.next().unwrap_or("");
        (2..=3).contains(&first.len())
            && first.bytes().all(|b| b.is_ascii_lowercase())
            && p.all(|x| {
                !x.is_empty() && x.len() <= 8 && x.bytes().all(|b| b.is_ascii_alphanumeric())
            })
    }
}

/// a text field: a string, trimmed, without control characters other than newlines and tabs, within bounds
fn text(v: &Value, field: &str, min: usize, max: usize) -> R<String> {
    let s = match &v[field] {
        Value::Null => "",
        Value::String(s) => s.as_str(),
        _ => return Err(format!("{field} must be text")),
    };
    let s: String = s
        .replace("\r\n", "\n")
        .chars()
        .filter(|c| !c.is_control() || *c == '\n' || *c == '\t')
        .collect();
    let s = s.trim().to_string();
    let n = s.chars().count();
    if n < min {
        return Err(if min == 1 {
            format!("{field} is needed")
        } else {
            format!("{field} is too short")
        });
    }
    if n > max {
        return Err(format!("{field} is too long"));
    }
    Ok(s)
}

fn line(v: &Value, field: &str, min: usize, max: usize) -> R<String> {
    let s = text(v, field, min, max)?;
    if s.contains('\n') {
        return Err(format!("{field} is one line"));
    }
    Ok(s)
}

fn flag(v: &Value, field: &str) -> bool {
    v[field].as_bool().unwrap_or(false)
}

fn int(v: &Value, field: &str) -> R<i64> {
    match &v[field] {
        Value::Null => Ok(0),
        Value::Number(n) => n
            .as_i64()
            .filter(|n| n.abs() < 1_000_000)
            .ok_or(format!("{field} must be a whole number")),
        _ => Err(format!("{field} must be a whole number")),
    }
}

fn picture(v: &Value, field: &str, required: bool) -> R<Value> {
    let p = &v[field];
    if p.is_null() && !required {
        return Ok(json!({}));
    }
    let key = p["key"].as_str().unwrap_or("");
    if !key_ok(key) {
        return Err(format!("{field} needs a picture"));
    }
    let w = p["w"].as_u64().unwrap_or(0);
    let h = p["h"].as_u64().unwrap_or(0);
    if !(1..=4096).contains(&w) || !(1..=4096).contains(&h) {
        return Err(format!("{field} has no size"));
    }
    Ok(json!({ "key": key, "w": w, "h": h }))
}

fn numbers(v: &Value, names: &[&str], range: (f64, f64)) -> R<Map<String, Value>> {
    let mut out = Map::new();
    for &n in names {
        match &v[n] {
            Value::Null => {}
            Value::Number(x) => {
                let x = x.as_f64().unwrap_or(f64::NAN);
                if !(range.0..=range.1).contains(&x) {
                    return Err(format!("{n} is out of range"));
                }
                out.insert(n.into(), json!(x));
            }
            _ => return Err(format!("{n} must be a number")),
        }
    }
    Ok(out)
}

// ---------------- posts ----------------

#[derive(Debug, Clone, PartialEq)]
pub struct Post {
    pub slug: String,
    pub title: String,
    pub summary: String,
    pub stage: String,
    pub date: String,
    pub body: String,
    pub notes: Value,
    pub figures: Value,
    pub example: bool,
}

pub fn post_in(v: &Value) -> R<Post> {
    let slug = line(v, "slug", 1, 80)?;
    if !slug_ok(&slug, 80) || slug == "archive" || slug == "home" {
        return Err("the slug is the address: lowercase letters, digits and hyphens".into());
    }
    let stage = line(v, "stage", 1, 20)?;
    if !STAGES.contains(&stage.as_str()) {
        return Err("stage is nigredo, albedo, citrinitas or rubedo".into());
    }
    let date = line(v, "date", 1, 10)?;
    if !date_ok(&date) {
        return Err("date is yyyy-mm-dd".into());
    }
    let mut notes = Vec::new();
    for n in v["notes"].as_array().map(|a| a.as_slice()).unwrap_or(&[]) {
        let id = line(n, "id", 1, 40)?;
        if !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        {
            return Err("a note's id is letters, digits, - and _".into());
        }
        let t = text(n, "text", 1, 2000)?;
        if notes.iter().any(|x: &Value| x["id"] == id) {
            return Err(format!("note {id} is there twice"));
        }
        notes.push(json!({ "id": id, "text": t.replace('\n', " ") }));
    }
    if notes.len() > 200 {
        return Err("at most 200 notes".into());
    }
    let mut figures = Vec::new();
    for f in v["figures"].as_array().map(|a| a.as_slice()).unwrap_or(&[]) {
        let name = line(f, "name", 1, 40)?;
        if !slug_ok(&name, 40) {
            return Err("a figure's name is lowercase letters, digits and hyphens".into());
        }
        let mut p = picture(&json!({ "p": f }), "p", true)
            .map_err(|_| format!("figure {name} needs a picture"))?;
        p["name"] = json!(name);
        if figures.iter().any(|x: &Value| x["name"] == name) {
            return Err(format!("figure {name} is there twice"));
        }
        figures.push(p);
    }
    if figures.len() > 40 {
        return Err("at most 40 figures".into());
    }
    Ok(Post {
        slug,
        title: line(v, "title", 1, 200)?,
        summary: line(v, "summary", 1, 400)?,
        stage,
        date,
        body: text(v, "body", 0, 200_000)?,
        notes: Value::Array(notes),
        figures: Value::Array(figures),
        example: flag(v, "example"),
    })
}

fn parsed(row: &Value, k: &str) -> Value {
    row[k]
        .as_str()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or(Value::Null)
}

fn with_url(mut p: Value, base: &str) -> Value {
    if let Some(k) = p["key"].as_str().filter(|k| !k.is_empty()) {
        p["url"] = json!(format!("{base}/media/{k}"));
    }
    p
}

fn bit(row: &Value, k: &str) -> bool {
    row[k].as_i64().unwrap_or(0) != 0 || row[k].as_f64().unwrap_or(0.0) != 0.0
}

/// a D1 row as the API answers it; `base` is the API's own origin, for the pictures' URLs
pub fn post_out(row: &Value, base: &str, admin: bool) -> Value {
    let figures: Vec<Value> = parsed(row, "figures")
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|f| with_url(f, base))
        .collect();
    let mut o = json!({
        "slug": row["slug"], "title": row["title"], "summary": row["summary"], "stage": row["stage"],
        "date": row["date"], "body": row["body"], "notes": parsed(row, "notes"), "figures": figures,
        "example": bit(row, "example"), "updated": row["updated"],
    });
    if admin {
        o["published"] = json!(bit(row, "published"));
    }
    o
}

// ---------------- books ----------------

#[derive(Debug, Clone, PartialEq)]
pub struct Book {
    pub slug: String,
    pub title: String,
    pub author: String,
    pub year: String,
    pub note: String,
    pub quote: String,
    pub quote_lang: String,
    pub quote_en: String,
    pub caption: String,
    pub picture: Value,
    pub adjust: Value,
    pub position: i64,
    pub example: bool,
}

pub fn book_in(v: &Value) -> R<Book> {
    let slug = line(v, "slug", 1, 80)?;
    if !slug_ok(&slug, 80) {
        return Err("the slug is the address: lowercase letters, digits and hyphens".into());
    }
    let quote_lang = line(v, "quote_lang", 0, 20)?;
    if !lang_ok(&quote_lang) {
        return Err("quote_lang is a language tag, like la or grc".into());
    }
    let a = &v["adjust"];
    let mut adjust = numbers(a, &BOOK_ADJUST, (0.0, 20.0))?;
    match &a["crop"] {
        Value::Null => {}
        Value::Array(c)
            if c.len() == 4
                && c.iter()
                    .all(|x| x.as_f64().is_some_and(|x| (0.0..=10000.0).contains(&x))) =>
        {
            adjust.insert("crop".into(), Value::Array(c.clone()));
        }
        _ => return Err("crop is x, y, width and height in map pixels".into()),
    }
    let note = text(v, "note", 1, 4000)?;
    // paragraphs: one blank line between them. Inside one, the line breaks stay (the book sets the archive's small
    // markdown, and a list or a quote is written on lines), a line's indent stays, its other spaces become one.
    let mut paragraphs: Vec<Vec<String>> = vec![Vec::new()];
    for l in note.lines() {
        if l.trim().is_empty() {
            if !paragraphs.last().is_some_and(|p| p.is_empty()) {
                paragraphs.push(Vec::new());
            }
        } else {
            let indent: String = l.chars().take_while(|c| c.is_whitespace()).collect();
            let words = l.split_whitespace().collect::<Vec<_>>().join(" ");
            paragraphs.last_mut().unwrap().push(format!("{indent}{words}"));
        }
    }
    let note = paragraphs
        .iter()
        .filter(|p| !p.is_empty())
        .map(|p| p.join("\n"))
        .collect::<Vec<_>>()
        .join("\n\n");
    Ok(Book {
        slug,
        title: line(v, "title", 1, 200)?,
        author: line(v, "author", 1, 200)?,
        year: line(v, "year", 1, 60)?,
        note,
        quote: text(v, "quote", 0, 600)?,
        quote_lang,
        quote_en: text(v, "quote_en", 0, 600)?,
        caption: line(v, "caption", 1, 300)?,
        picture: picture(v, "picture", true)?,
        adjust: Value::Object(adjust),
        position: int(v, "position")?,
        example: flag(v, "example"),
    })
}

pub fn book_out(row: &Value, base: &str, admin: bool) -> Value {
    let picture = with_url(
        json!({ "key": row["picture"], "w": row["picture_w"], "h": row["picture_h"] }),
        base,
    );
    let note: Vec<Value> = row["note"]
        .as_str()
        .unwrap_or("")
        .split("\n\n")
        .filter(|p| !p.is_empty())
        .map(|p| json!(p))
        .collect();
    let mut o = json!({
        "slug": row["slug"], "title": row["title"], "author": row["author"], "year": row["year"],
        "note": note, "quote": row["quote"], "quote_lang": row["quote_lang"], "quote_en": row["quote_en"],
        "caption": row["caption"], "picture": picture, "adjust": parsed(row, "adjust"),
        "position": row["position"], "example": bit(row, "example"), "updated": row["updated"],
    });
    if admin {
        o["published"] = json!(bit(row, "published"));
    }
    o
}

// ---------------- works ----------------

#[derive(Debug, Clone, PartialEq)]
pub struct Work {
    pub id: String,
    pub name: String,
    pub gloss: String,
    pub gloss_tip: String,
    pub year: String,
    pub role: String,
    pub description: String,
    pub links: Value,
    pub map: Value,
    pub sources: Value,
    pub flags: Value,
    pub position: i64,
    pub line: String,
    pub status: String,
}

pub fn work_in(v: &Value) -> R<Work> {
    let id = line(v, "id", 1, 60)?;
    if !slug_ok(&id, 60) {
        return Err("the id is the address: lowercase letters, digits and hyphens".into());
    }
    let mut links = Vec::new();
    for l in v["links"].as_array().map(|a| a.as_slice()).unwrap_or(&[]) {
        let label = line(l, "label", 1, 80)?;
        let href = line(l, "href", 1, 500)?;
        if !(href.starts_with("https://") || href.starts_with("http://"))
            || href.contains(char::is_whitespace)
        {
            return Err("a link goes to an http or https address".into());
        }
        links.push(json!({ "label": label, "href": href }));
    }
    if links.len() > 8 {
        return Err("at most 8 links".into());
    }
    let m = &v["map"];
    let mut map = picture(&json!({ "map": m }), "map", true)?;
    map["caption"] = json!(line(m, "caption", 1, 300)?);
    map["settings"] = Value::Object(numbers(&m["settings"], &WORK_SETTINGS, (0.0, 4.0))?);
    let obj = |k: &str| -> R<Value> {
        match &v[k] {
            Value::Null => Ok(json!({})),
            Value::Object(o)
                if o.values()
                    .all(|x| x.is_string() || x.is_boolean() || x.is_number()) =>
            {
                Ok(Value::Object(o.clone()))
            }
            _ => Err(format!("{k} is a flat object")),
        }
    };
    Ok(Work {
        id,
        name: line(v, "name", 1, 120)?,
        gloss: line(v, "gloss", 1, 80)?,
        gloss_tip: line(v, "gloss_tip", 1, 200)?,
        year: line(v, "year", 1, 40)?,
        role: line(v, "role", 1, 200)?,
        description: text(v, "description", 1, 2000)?,
        links: Value::Array(links),
        map,
        sources: obj("sources")?,
        flags: obj("flags")?,
        position: int(v, "position")?,
        line: line(v, "line", 0, 300)?,
        status: line(v, "status", 0, 40)?,
    })
}

pub fn work_out(row: &Value, base: &str, admin: bool) -> Value {
    let mut o = json!({
        "id": row["id"], "name": row["name"], "gloss": row["gloss"], "gloss_tip": row["gloss_tip"],
        "year": row["year"], "role": row["role"], "description": row["description"], "links": parsed(row, "links"),
        "map": with_url(parsed(row, "map"), base), "line": row["line"], "status": row["status"],
        "position": row["position"], "updated": row["updated"],
    });
    if admin {
        o["published"] = json!(bit(row, "published"));
        o["sources"] = parsed(row, "sources");
        o["flags"] = parsed(row, "flags");
    }
    o
}

// ---------------- awards ----------------

#[derive(Debug, Clone, PartialEq)]
pub struct Award {
    pub id: String,
    pub title: String,
    pub note: String,
    pub line: String,
    pub position: i64,
}

pub fn award_in(v: &Value) -> R<Award> {
    let id = line(v, "id", 1, 60)?;
    if !slug_ok(&id, 60) {
        return Err("the id is the address: lowercase letters, digits and hyphens".into());
    }
    Ok(Award {
        id,
        title: line(v, "title", 1, 160)?,
        note: line(v, "note", 0, 120)?,
        line: line(v, "line", 0, 400)?,
        position: int(v, "position")?,
    })
}

pub fn award_out(row: &Value, admin: bool) -> Value {
    let mut o = json!({
        "id": row["id"], "title": row["title"], "note": row["note"], "line": row["line"],
        "position": row["position"], "updated": row["updated"],
    });
    if admin {
        o["published"] = json!(bit(row, "published"));
    }
    o
}

/// the works section's own name, as in works.json
pub fn works_section() -> Value {
    json!({ "name": "works", "gloss": "opera", "gloss_tip": "opera · works" })
}

#[cfg(test)]
mod tests {
    use super::*;

    const KEY: &str = "m/0123456789abcdef01234567.png";

    fn post() -> Value {
        json!({ "slug": "on-salt", "title": "on salt", "summary": "a line.", "stage": "nigredo", "date": "2026-12-01",
                "body": "text[^a]\n\n![c](simulacrum:salt)", "notes": [{ "id": "a", "text": "a note" }],
                "figures": [{ "name": "salt", "key": KEY, "w": 480, "h": 600 }] })
    }

    #[test]
    fn posts_are_checked() {
        let p = post_in(&post()).unwrap();
        assert_eq!(p.slug, "on-salt");
        assert_eq!(p.figures[0]["name"], "salt");
        let bad = |k: &str, v: Value| {
            let mut x = post();
            x[k] = v;
            post_in(&x).unwrap_err()
        };
        assert!(bad("slug", json!("On Salt")).contains("slug"));
        assert!(bad("slug", json!("archive")).contains("slug"));
        assert!(bad("slug", json!("-x")).contains("slug"));
        assert!(bad("stage", json!("viriditas")).contains("stage"));
        assert!(bad("date", json!("2026-02-30")).contains("date"));
        assert!(bad("date", json!("26-02-01")).contains("date"));
        assert!(bad("title", json!("")).contains("title is needed"));
        assert!(bad("title", json!("a\nb")).contains("one line"));
        assert!(bad("title", json!(5)).contains("text"));
        assert!(bad(
            "notes",
            json!([{ "id": "a", "text": "x" }, { "id": "a", "text": "y" }])
        )
        .contains("twice"));
        assert!(bad(
            "figures",
            json!([{ "name": "x", "key": "../etc", "w": 1, "h": 1 }])
        )
        .contains("picture"));
        assert!(bad(
            "figures",
            json!([{ "name": "x", "key": KEY, "w": 0, "h": 1 }])
        )
        .contains("picture"));
        let mut x = post();
        x["title"] = json!("  on\u{0007} salt  ");
        assert_eq!(post_in(&x).unwrap().title, "on salt");
        assert!(date_ok("2024-02-29") && !date_ok("2023-02-29"));
    }

    #[test]
    fn keys_are_only_the_service_own() {
        assert!(key_ok(KEY));
        assert!(key_ok("m/0123456789abcdef01234567.jpg"));
        assert!(!key_ok("m/0123456789abcdef0123456.png"));
        assert!(!key_ok("m/0123456789abcdef01234567.gif"));
        assert!(!key_ok("x/0123456789abcdef01234567.png"));
        assert!(!key_ok("m/0123456789ABCDEF01234567.png"));
    }

    fn book() -> Value {
        json!({ "slug": "faust", "title": "faust", "author": "Rembrandt", "year": "c. 1652", "note": "one\n\n\ntwo  words",
                "quote": "Daß ich", "quote_lang": "de", "quote_en": "that I", "caption": "a scholar · Rembrandt",
                "picture": { "key": KEY, "w": 560, "h": 480 }, "adjust": { "gain": 1.1, "crop": [0, 10, 400, 300] }, "position": 4 })
    }

    #[test]
    fn books_are_checked() {
        let b = book_in(&book()).unwrap();
        assert_eq!(b.note, "one\n\ntwo words");
        /* a list and a quote keep their lines, a plain paragraph's wrapped lines stay lines (the book joins them) */
        let mut x = book();
        x["note"] = json!("intro  line\n- a\n-  b   c\n  - nested\n   \n> q\n> r\n\n\n\nlast");
        assert_eq!(book_in(&x).unwrap().note, "intro line\n- a\n- b c\n  - nested\n\n> q\n> r\n\nlast");
        assert_eq!(b.adjust["crop"], json!([0, 10, 400, 300]));
        let bad = |k: &str, v: Value| {
            let mut x = book();
            x[k] = v;
            book_in(&x).unwrap_err()
        };
        assert!(bad("quote_lang", json!("German")).contains("quote_lang"));
        assert!(bad("adjust", json!({ "crop": [1, 2] })).contains("crop"));
        assert!(bad("adjust", json!({ "gain": 99 })).contains("gain"));
        assert!(bad("picture", json!(null)).contains("picture"));
        assert!(bad("position", json!(1.5)).contains("position"));
        assert!(lang_ok("grc") && lang_ok("") && lang_ok("pt-br") && !lang_ok("x"));
    }

    fn work() -> Value {
        json!({ "id": "heild", "name": "heild", "gloss": "totum", "gloss_tip": "totum · the whole", "year": "2026",
                "role": "author", "description": "the whole.", "links": [{ "label": "the site", "href": "https://example.com" }],
                "map": { "key": KEY, "w": 640, "h": 320, "caption": "the wordmark", "settings": { "scatter": 0.8 } },
                "sources": { "map": "x" }, "flags": { "needs_owner_review": false },
                "line": "the whole, in a line.", "status": "in progress" })
    }

    #[test]
    fn works_are_checked() {
        let w = work_in(&work()).unwrap();
        assert_eq!(w.map["settings"]["scatter"], json!(0.8));
        assert_eq!(
            (w.line.as_str(), w.status.as_str()),
            ("the whole, in a line.", "in progress")
        );
        // both are optional
        let mut bare = work();
        bare.as_object_mut().unwrap().remove("line");
        bare.as_object_mut().unwrap().remove("status");
        let w = work_in(&bare).unwrap();
        assert_eq!((w.line.as_str(), w.status.as_str()), ("", ""));
        let bad = |k: &str, v: Value| {
            let mut x = work();
            x[k] = v;
            work_in(&x).unwrap_err()
        };
        assert!(bad(
            "links",
            json!([{ "label": "x", "href": "javascript:alert(1)" }])
        )
        .contains("link"));
        assert!(bad("id", json!("Heild")).contains("id"));
        assert!(bad("sources", json!({ "a": { "b": 1 } })).contains("flat"));
        assert!(bad("map", json!({ "key": KEY, "w": 1, "h": 1 })).contains("caption"));
        assert!(bad("line", json!("a\nb")).contains("line is one line"));
        assert!(bad("line", json!("x".repeat(301))).contains("too long"));
        assert!(bad("status", json!("x".repeat(41))).contains("too long"));
        assert!(bad("status", json!("in\nprogress")).contains("one line"));
        let mut edge = work();
        edge["line"] = json!("x".repeat(300));
        edge["status"] = json!("x".repeat(40));
        assert!(work_in(&edge).is_ok());
    }

    #[test]
    fn awards_are_checked() {
        let a = json!({ "id": "startup-one", "title": "winner, FIAP Startup One 2026", "note": "with XP", "line": "first among 550+.", "position": 1 });
        let ok = award_in(&a).unwrap();
        assert_eq!((ok.id.as_str(), ok.position), ("startup-one", 1));
        let bad = |k: &str, v: Value| {
            let mut x = a.clone();
            x[k] = v;
            award_in(&x).unwrap_err()
        };
        assert!(bad("id", json!("Startup One")).contains("id"));
        assert!(bad("id", json!("x".repeat(61))).contains("too long"));
        assert!(bad("title", json!("")).contains("title is needed"));
        assert!(bad("title", json!("x".repeat(161))).contains("too long"));
        assert!(bad("note", json!("x".repeat(121))).contains("too long"));
        assert!(bad("line", json!("x".repeat(401))).contains("too long"));
        assert!(bad("line", json!("a\nb")).contains("one line"));
        assert!(bad("position", json!("1")).contains("position"));
        // note, line and position are optional
        let min = award_in(&json!({ "id": "a", "title": "t" })).unwrap();
        assert_eq!(
            (min.note.as_str(), min.line.as_str(), min.position),
            ("", "", 0)
        );
        let row = json!({ "id": "a", "title": "t", "note": "", "line": "", "position": 2, "published": 1, "updated": 9 });
        assert!(award_out(&row, false).get("published").is_none());
        assert_eq!(award_out(&row, true)["published"], true);
        assert_eq!(award_out(&row, false)["position"], 2);
    }

    #[test]
    fn answers_carry_urls_and_hide_drafts_state_from_the_public() {
        let row = json!({ "slug": "s", "title": "t", "summary": "u", "stage": "albedo", "date": "2026-01-01", "body": "b",
                          "notes": "[]", "figures": format!("[{{\"name\":\"f\",\"key\":\"{KEY}\",\"w\":2,\"h\":3}}]"),
                          "example": 1, "published": 0, "updated": 5 });
        let o = post_out(&row, "https://content-api.aphes.ist", false);
        assert_eq!(
            o["figures"][0]["url"],
            format!("https://content-api.aphes.ist/media/{KEY}")
        );
        assert_eq!(o["example"], true);
        assert!(o.get("published").is_none());
        assert_eq!(post_out(&row, "x", true)["published"], false);
        let brow = json!({ "slug": "b", "note": "one\n\ntwo", "picture": KEY, "picture_w": 5, "picture_h": 6, "adjust": "{}" });
        let b = book_out(&brow, "https://h", false);
        assert_eq!(b["note"], json!(["one", "two"]));
        assert_eq!(b["picture"]["url"], format!("https://h/media/{KEY}"));
        let wrow = json!({ "id": "w", "line": "l", "status": "s", "links": "[]", "map": format!("{{\"key\":\"{KEY}\",\"w\":1,\"h\":1,\"caption\":\"c\"}}"), "sources": "{\"a\":\"b\"}", "flags": "{}" });
        assert!(work_out(&wrow, "h", false).get("sources").is_none());
        assert_eq!(work_out(&wrow, "h", false)["line"], "l");
        assert_eq!(work_out(&wrow, "h", false)["status"], "s");
        assert_eq!(work_out(&wrow, "h", true)["sources"]["a"], "b");
    }
}
