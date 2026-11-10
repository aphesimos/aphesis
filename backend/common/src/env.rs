//! Reading vars and secrets. Both arrive as strings on the Worker's env; an empty string counts as absent, so a
//! secret left blank in a deploy behaves exactly like one never set.

pub fn string(env: &worker::Env, name: &str) -> Option<String> {
    let v = env
        .var(name)
        .map(|v| v.to_string())
        .or_else(|_| env.secret(name).map(|s| s.to_string()))
        .ok()?;
    if v.is_empty() {
        None
    } else {
        Some(v)
    }
}

/// `+env.X || fallback` in the JavaScript Workers: a number that is missing, unreadable or zero falls back.
pub fn number(env: &worker::Env, name: &str, fallback: f64) -> f64 {
    js_number(string(env, name).as_deref(), fallback)
}

pub fn js_number(raw: Option<&str>, fallback: f64) -> f64 {
    let n = match raw.map(str::trim) {
        None | Some("") => 0.0,
        Some(s) => s.parse::<f64>().unwrap_or(f64::NAN),
    };
    if n.is_nan() || n == 0.0 {
        fallback
    } else {
        n
    }
}

#[cfg(test)]
mod tests {
    use super::js_number;

    #[test]
    fn numbers_fall_back_like_javascript() {
        assert_eq!(js_number(None, 4.0), 4.0);
        assert_eq!(js_number(Some(""), 4.0), 4.0);
        assert_eq!(js_number(Some("0"), 4.0), 4.0);
        assert_eq!(js_number(Some("x"), 4.0), 4.0);
        assert_eq!(js_number(Some("3"), 4.0), 3.0);
        assert_eq!(js_number(Some(" 120 "), 4.0), 120.0);
    }
}
