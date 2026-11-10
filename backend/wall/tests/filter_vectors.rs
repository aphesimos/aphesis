//! The shared vectors, run against the Rust filter. `filter-parity.mjs` runs the same file against the page's
//! JavaScript filter, so both sides give the very same answers.

use aphesis_wall::filter::{check, clean};
use serde_json::Value;

fn vectors() -> Value {
    serde_json::from_str(include_str!("filter-vectors.json")).expect("vectors parse")
}

#[test]
fn check_vectors() {
    let v = vectors();
    let cases = v["check"].as_array().unwrap();
    assert!(cases.len() >= 100);
    let mut failed = Vec::new();
    for c in cases {
        let text = c["text"].as_str().unwrap();
        let extra: Vec<String> = c
            .get("extra")
            .and_then(Value::as_array)
            .map(|a| a.iter().map(|x| x.as_str().unwrap().to_string()).collect())
            .unwrap_or_default();
        let got = serde_json::to_value(check(text, &extra)).unwrap();
        if got != c["expect"] {
            failed.push(format!(
                "{:?} (extra {:?}): expected {}, got {}",
                text, extra, c["expect"], got
            ));
        }
    }
    assert!(
        failed.is_empty(),
        "{} of {} vectors differ:\n{}",
        failed.len(),
        cases.len(),
        failed.join("\n")
    );
    println!("{} check vectors pass", cases.len());
}

#[test]
fn clean_vectors() {
    let v = vectors();
    for c in v["clean"].as_array().unwrap() {
        assert_eq!(
            clean(c["text"].as_str().unwrap()),
            c["expect"].as_str().unwrap(),
            "{:?}",
            c["text"]
        );
    }
}
