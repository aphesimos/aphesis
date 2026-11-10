//! validate: what a post may carry. Pure functions over strings and bytes, a port of the JavaScript Worker's
//! `validate.js`:
//! - text: up to 2000 characters and 60 lines, control characters removed, line ends normalized;
//! - the original picture: jpeg, png, webp or gif, up to 4 MB, its type read from its first bytes (never trusted
//!   from the upload's own label), at most 40 megapixels;
//! - the density map made in the browser: jpeg or png, up to 900 KB, 32 to 960 pixels on its sides (960 so the small
//!   text of a wide screenshot still reads; a detailed 960 px map is about 470 KB as a JPEG at quality .88, noise at
//!   most 660 KB, so 900 KB leaves room for a PNG of most pictures).

use aphesis_common::time::is_js_space;

pub const TEXT: usize = 2000;
pub const LINES: usize = 60;
pub const ORIGINAL: usize = 4 * 1024 * 1024;
pub const DENSITY: usize = 900 * 1024;
pub const DENSITY_LONG: u32 = 960;
pub const DENSITY_SHORT: u32 = 32;
pub const PIXELS: f64 = 40e6;

pub use aphesis_common::image::{image_size, sniff, Kind, Size};

/// What the JavaScript strips: C0 controls except tab and newline, DEL, zero-width and direction marks, embeddings,
/// overrides and isolates.
fn dropped(c: char) -> bool {
    matches!(c, '\u{0}'..='\u{8}' | '\u{B}'..='\u{1F}' | '\u{7F}' | '\u{200B}'..='\u{200F}' | '\u{202A}'..='\u{202E}' | '\u{2066}'..='\u{2069}')
}

/// The words of a post, cleaned. `required`: a post with no picture needs words.
pub fn check_text(raw: &str, required: bool) -> Result<String, String> {
    // \r\n? -> \n, then the invisible and control characters go
    let mut t = String::with_capacity(raw.len());
    let mut chars = raw.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\r' {
            if chars.peek() == Some(&'\n') {
                chars.next();
            }
            t.push('\n');
        } else if !dropped(c) {
            t.push(c);
        }
    }
    // \n{4,} -> \n\n\n
    let mut s = String::with_capacity(t.len());
    let mut run = 0;
    for c in t.chars() {
        if c == '\n' {
            run += 1;
            if run <= 3 {
                s.push(c);
            }
        } else {
            run = 0;
            s.push(c);
        }
    }
    // \s+$ -> ''
    let s = s.trim_end_matches(is_js_space);
    // ^\s*\n -> '': leading whitespace up to its last newline
    let lead = s.len() - s.trim_start_matches(is_js_space).len();
    let s = match s[..lead].rfind('\n') {
        Some(i) => &s[i + 1..],
        None => s,
    };
    if required && s.trim_matches(is_js_space).is_empty() {
        return Err("a post needs words".into());
    }
    if s.chars().count() > TEXT {
        return Err(format!("at most {TEXT} characters"));
    }
    if s.split('\n').count() > LINES {
        return Err(format!("at most {LINES} lines"));
    }
    Ok(s.to_string())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Picture {
    pub kind: Kind,
    pub width: u32,
    pub height: u32,
}

pub fn check_original(b: &[u8]) -> Result<Picture, &'static str> {
    if b.is_empty() {
        return Err("the picture is empty");
    }
    if b.len() > ORIGINAL {
        return Err("pictures up to 4 mb");
    }
    let kind = sniff(b).ok_or("only jpeg, png, webp or gif")?;
    let size = image_size(b, Some(kind))
        .filter(|s| s.width > 0 && s.height > 0)
        .ok_or("this picture could not be read")?;
    if size.width as f64 * size.height as f64 > PIXELS {
        return Err("this picture is too large");
    }
    Ok(Picture {
        kind,
        width: size.width,
        height: size.height,
    })
}

pub fn check_density(b: Option<&[u8]>) -> Result<Picture, &'static str> {
    let b = b
        .filter(|b| !b.is_empty())
        .ok_or("the density map is missing")?;
    if b.len() > DENSITY {
        return Err("the density map is too heavy");
    }
    let kind = match sniff(b) {
        Some(k @ (Kind::Jpeg | Kind::Png)) => k,
        _ => return Err("the density map must be jpeg or png"),
    };
    let size = image_size(b, Some(kind)).ok_or("the density map could not be read")?;
    let (long, short) = (size.width.max(size.height), size.width.min(size.height));
    if long > DENSITY_LONG || short < DENSITY_SHORT {
        return Err("the density map has the wrong size");
    }
    Ok(Picture {
        kind,
        width: size.width,
        height: size.height,
    })
}

#[cfg(test)]
pub mod fixtures {
    //! minimal headers of each kind, with a given size (the same bytes as the JavaScript tests)
    pub fn png(w: u32, h: u32) -> Vec<u8> {
        let mut b = vec![0u8; 33 + 64];
        b[..16].copy_from_slice(&[
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
        ]);
        b[16..20].copy_from_slice(&w.to_be_bytes());
        b[20..24].copy_from_slice(&h.to_be_bytes());
        b
    }
    pub fn jpeg(w: u32, h: u32) -> Vec<u8> {
        let mut b = vec![0u8; 2 + 18 + 19 + 64];
        b[..2].copy_from_slice(&[0xff, 0xd8]);
        b[2..20].copy_from_slice(&[
            0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
        ]);
        b[20..30].copy_from_slice(&[
            0xff,
            0xc0,
            0,
            17,
            8,
            (h >> 8) as u8,
            h as u8,
            (w >> 8) as u8,
            w as u8,
            1,
        ]);
        b
    }
    pub fn gif(w: u32, h: u32) -> Vec<u8> {
        let mut b = vec![0u8; 32];
        b[..10].copy_from_slice(&[
            0x47,
            0x49,
            0x46,
            0x38,
            0x39,
            0x61,
            w as u8,
            (w >> 8) as u8,
            h as u8,
            (h >> 8) as u8,
        ]);
        b
    }
    pub fn webp_x(w: u32, h: u32) -> Vec<u8> {
        let mut b = vec![0u8; 40];
        b[0..4].copy_from_slice(b"RIFF");
        b[8..12].copy_from_slice(b"WEBP");
        b[12..16].copy_from_slice(b"VP8X");
        let (w, h) = (w - 1, h - 1);
        b[24..27].copy_from_slice(&[w as u8, (w >> 8) as u8, (w >> 16) as u8]);
        b[27..30].copy_from_slice(&[h as u8, (h >> 8) as u8, (h >> 16) as u8]);
        b
    }
}

#[cfg(test)]
mod tests {
    use super::fixtures::*;
    use super::*;

    fn size(w: u32, h: u32) -> Option<Size> {
        Some(Size {
            width: w,
            height: h,
        })
    }

    #[test]
    fn types_come_from_the_bytes_not_the_label() {
        assert_eq!(sniff(&png(10, 10)), Some(Kind::Png));
        assert_eq!(sniff(&jpeg(10, 10)), Some(Kind::Jpeg));
        assert_eq!(sniff(&gif(10, 10)), Some(Kind::Gif));
        assert_eq!(sniff(&webp_x(10, 10)), Some(Kind::Webp));
        assert_eq!(
            sniff(br#"<svg xmlns="http://www.w3.org/2000/svg"></svg>"#),
            None
        );
        assert_eq!(sniff(b"<html><script>alert(1)</script>"), None);
        assert_eq!(sniff(&[0u8; 4]), None);
    }

    #[test]
    fn sizes_are_read_from_headers() {
        assert_eq!(
            image_size(&png(560, 420), sniff(&png(560, 420))),
            size(560, 420)
        );
        assert_eq!(
            image_size(&jpeg(480, 640), Some(Kind::Jpeg)),
            size(480, 640)
        );
        assert_eq!(image_size(&gif(300, 200), Some(Kind::Gif)), size(300, 200));
        assert_eq!(
            image_size(&webp_x(1024, 768), Some(Kind::Webp)),
            size(1024, 768)
        );
        let broken = [0xff, 0xd8, 0xff, 0xe0, 0, 2, 0, 0, 0, 0, 0, 0];
        assert_eq!(image_size(&broken, sniff(&broken)), None);
    }

    #[test]
    fn webp_variants_and_short_headers() {
        let mut b = vec![0u8; 30];
        b[0..4].copy_from_slice(b"RIFF");
        b[8..12].copy_from_slice(b"WEBP");
        b[12..16].copy_from_slice(b"VP8 ");
        b[26..28].copy_from_slice(&(0xc000u16 | 320).to_le_bytes());
        b[28..30].copy_from_slice(&240u16.to_le_bytes());
        assert_eq!(image_size(&b, Some(Kind::Webp)), size(320, 240));
        let mut l = vec![0u8; 25];
        l[0..4].copy_from_slice(b"RIFF");
        l[8..12].copy_from_slice(b"WEBP");
        l[12..16].copy_from_slice(b"VP8L");
        let v: u32 = (99) | (49 << 14);
        l[21..25].copy_from_slice(&v.to_le_bytes());
        assert_eq!(image_size(&l, Some(Kind::Webp)), size(100, 50));
        // a VP8L cut short reads its missing bytes as 0, as in JavaScript: 1 x 1
        assert_eq!(image_size(&l[..16], Some(Kind::Webp)), size(1, 1));
        // a PNG cut inside IHDR cannot be read
        assert_eq!(image_size(&png(10, 10)[..20], Some(Kind::Png)), None);
    }

    #[test]
    fn originals_type_weight_and_size() {
        assert!(check_original(&jpeg(2000, 1500)).is_ok());
        assert!(check_original(&[]).is_err());
        let mut heavy = vec![0u8; ORIGINAL + 1];
        heavy[..jpeg(10, 10).len()].copy_from_slice(&jpeg(10, 10));
        assert_eq!(check_original(&heavy), Err("pictures up to 4 mb"));
        assert_eq!(
            check_original(b"GIF? no, a script pretending to be one...."),
            Err("only jpeg, png, webp or gif")
        );
        assert_eq!(
            check_original(&png(10000, 10000)),
            Err("this picture is too large")
        );
        assert_eq!(
            check_original(&png(0, 10)),
            Err("this picture could not be read")
        );
    }

    #[test]
    fn density_maps_jpeg_or_png_light_960_at_most() {
        assert!(check_density(Some(&jpeg(560, 420))).is_ok());
        assert!(check_density(Some(&png(640, 480))).is_ok());
        assert!(check_density(Some(&jpeg(960, 540))).is_ok());
        assert!(check_density(Some(&png(720, 960))).is_ok());
        assert!(check_density(Some(&jpeg(961, 540))).is_err());
        assert!(check_density(Some(&jpeg(1200, 900))).is_err());
        assert!(check_density(Some(&gif(560, 420))).is_err());
        assert!(check_density(Some(&webp_x(560, 420))).is_err());
        assert!(check_density(Some(&jpeg(560, 10))).is_err());
        let mut fits = vec![0u8; DENSITY];
        fits[..jpeg(960, 720).len()].copy_from_slice(&jpeg(960, 720));
        assert!(check_density(Some(&fits)).is_ok());
        let mut heavy = vec![0u8; DENSITY + 1];
        heavy[..jpeg(560, 420).len()].copy_from_slice(&jpeg(560, 420));
        assert_eq!(
            check_density(Some(&heavy)),
            Err("the density map is too heavy")
        );
        assert_eq!(check_density(None), Err("the density map is missing"));
    }

    #[test]
    fn text_cleaned_required_bounded() {
        assert_eq!(
            check_text("  hello\r\nworld  \n\n", true),
            Ok("  hello\nworld".into())
        );
        assert!(check_text("   \n ", true).is_err());
        assert_eq!(check_text("", false), Ok(String::new()));
        assert_eq!(check_text("a\u{0}b\u{202e}c", true), Ok("abc".into()));
        assert!(check_text(&"x".repeat(TEXT), true).is_ok());
        assert_eq!(
            check_text(&"x".repeat(TEXT + 1), true),
            Err("at most 2000 characters".into())
        );
        assert_eq!(
            check_text(&"a\n".repeat(LINES + 2), true),
            Err("at most 60 lines".into())
        );
        assert_eq!(check_text("a\n\n\n\n\n\nb", true), Ok("a\n\n\nb".into()));
        assert_eq!(
            check_text(">>12 yes\n>quoted", true),
            Ok(">>12 yes\n>quoted".into())
        );
    }

    #[test]
    fn text_edges_match_the_javascript() {
        // values from node: checkText(...) in validate.js
        assert_eq!(check_text(" \n \n x", true), Ok(" x".into()));
        assert_eq!(check_text("\r\rx", true), Ok("x".into()));
        assert_eq!(
            check_text("a\r\n\r\n\r\n\r\nb", true),
            Ok("a\n\n\nb".into())
        );
        assert_eq!(
            check_text("tab\tkept\u{85}", true),
            Ok("tab\tkept\u{85}".into())
        );
        assert_eq!(check_text("\u{feff}\nx", true), Ok("x".into()));
        assert_eq!(
            check_text("色".repeat(TEXT).as_str(), true).map(|s| s.chars().count()),
            Ok(TEXT)
        );
    }
}
