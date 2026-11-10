//! Clock and calendar, plus the whitespace class of JavaScript's `\s` (used wherever a ported regex had it).

/// Milliseconds since the epoch, from the runtime's clock.
pub fn now_ms() -> i64 {
    worker::Date::now().as_millis() as i64
}

/// `new Date(ms).toISOString().slice(0, 10)`: the UTC day as `YYYY-MM-DD`.
pub fn iso_day(ms: i64) -> String {
    let days = ms.div_euclid(86_400_000);
    // civil-from-days (Howard Hinnant), proleptic Gregorian
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + if m <= 2 { 1 } else { 0 };
    format!("{y:04}-{m:02}-{d:02}")
}

/// JavaScript's `\s`: WhiteSpace and LineTerminator (which is not Rust's `char::is_whitespace`: JavaScript adds
/// U+FEFF and leaves out U+0085).
pub fn is_js_space(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{0B}' | '\u{0C}' | '\r' | ' ' | '\u{A0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200A}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202F}'
                | '\u{205F}'
                | '\u{3000}'
                | '\u{FEFF}'
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn iso_days() {
        assert_eq!(iso_day(0), "1970-01-01");
        assert_eq!(iso_day(1_798_761_600_000 - 1), "2026-12-31");
        // Date.UTC(2026, 10, 10, 12)
        assert_eq!(iso_day(1_794_312_000_000), "2026-11-10");
        assert_eq!(iso_day(951_782_400_000), "2000-02-29");
        assert_eq!(iso_day(-1), "1969-12-31");
    }

    #[test]
    fn js_space() {
        assert!(is_js_space('\u{FEFF}'));
        assert!(!is_js_space('\u{85}'));
        assert!(!is_js_space('\u{200B}'));
    }
}
