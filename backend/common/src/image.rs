//! image: what a picture really is, read from its bytes, never from the upload's own label. The type from its magic
//! bytes (jpeg, png, gif, webp) and its width and height from its header. Shared by the forum (originals and density
//! maps) and the content service (density maps and pictures uploaded from the dashboard).

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Jpeg,
    Png,
    Gif,
    Webp,
}

impl Kind {
    pub fn mime(self) -> &'static str {
        match self {
            Kind::Jpeg => "image/jpeg",
            Kind::Png => "image/png",
            Kind::Gif => "image/gif",
            Kind::Webp => "image/webp",
        }
    }
    pub fn ext(self) -> &'static str {
        match self {
            Kind::Jpeg => "jpg",
            Kind::Png => "png",
            Kind::Gif => "gif",
            Kind::Webp => "webp",
        }
    }
}

/// The type a file really is, from its magic bytes.
pub fn sniff(b: &[u8]) -> Option<Kind> {
    if b.len() < 12 {
        return None;
    }
    if b.starts_with(&[0xff, 0xd8, 0xff]) {
        return Some(Kind::Jpeg);
    }
    if b.starts_with(&[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) {
        return Some(Kind::Png);
    }
    if b.starts_with(b"GIF8") {
        return Some(Kind::Gif);
    }
    if &b[0..4] == b"RIFF" && &b[8..12] == b"WEBP" {
        return Some(Kind::Webp);
    }
    None
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Size {
    pub width: u32,
    pub height: u32,
}

/// A byte, or 0 past the end (as JavaScript's bitwise operators read `undefined`).
fn at(b: &[u8], i: usize) -> u32 {
    *b.get(i).unwrap_or(&0) as u32
}
fn u16be(b: &[u8], o: usize) -> u32 {
    (at(b, o) << 8) | at(b, o + 1)
}
fn u16le(b: &[u8], o: usize) -> u32 {
    at(b, o) | (at(b, o + 1) << 8)
}
fn u24le(b: &[u8], o: usize) -> u32 {
    at(b, o) | (at(b, o + 1) << 8) | (at(b, o + 2) << 16)
}

/// Width and height from the header.
///
/// One deliberate difference from the JavaScript: a PNG cut off inside its IHDR sizes is unreadable here, where the
/// JavaScript read the missing byte as NaN (and so let a density map with NaN sides through).
pub fn image_size(b: &[u8], kind: Option<Kind>) -> Option<Size> {
    match kind? {
        Kind::Png => {
            if b.get(12..16) != Some(b"IHDR") || b.len() < 24 {
                return None;
            }
            let w = u32::from_be_bytes([b[16], b[17], b[18], b[19]]);
            let h = u32::from_be_bytes([b[20], b[21], b[22], b[23]]);
            Some(Size {
                width: w,
                height: h,
            })
        }
        Kind::Gif => Some(Size {
            width: u16le(b, 6),
            height: u16le(b, 8),
        }),
        Kind::Jpeg => {
            let mut o = 2;
            while o + 9 < b.len() {
                if b[o] != 0xff {
                    o += 1;
                    continue;
                }
                let m = b[o + 1];
                if m == 0xff {
                    o += 1;
                    continue;
                }
                if m == 0xd8 || m == 0x01 || (0xd0..=0xd7).contains(&m) {
                    o += 2;
                    continue;
                }
                let len = u16be(b, o + 2) as usize;
                // start of frame markers carry the size; c4, c8 and cc are not frames
                if (0xc0..=0xcf).contains(&m) && m != 0xc4 && m != 0xc8 && m != 0xcc {
                    return Some(Size {
                        height: u16be(b, o + 5),
                        width: u16be(b, o + 7),
                    });
                }
                if len < 2 {
                    return None;
                }
                o += 2 + len;
            }
            None
        }
        Kind::Webp => match b.get(12..16)? {
            b"VP8 " => Some(Size {
                width: u16le(b, 26) & 0x3fff,
                height: u16le(b, 28) & 0x3fff,
            }),
            b"VP8L" => {
                let v = at(b, 21) | (at(b, 22) << 8) | (at(b, 23) << 16) | (at(b, 24) << 24);
                Some(Size {
                    width: (v & 0x3fff) + 1,
                    height: ((v >> 14) & 0x3fff) + 1,
                })
            }
            b"VP8X" => Some(Size {
                width: u24le(b, 24) + 1,
                height: u24le(b, 27) + 1,
            }),
            _ => None,
        },
    }
}
