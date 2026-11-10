//! The owner's password, kept only as a PBKDF2-SHA256 hash.
//!
//! The stored form is one line, made by `tools/hash-password.mjs`:
//!
//! ```text
//! pbkdf2-sha256$<iterations>$<salt, base64>$<hash, base64>
//! ```
//!
//! In the Worker the hash is derived with WebCrypto (`crypto.subtle.deriveBits`), natively in the runtime, so it
//! costs a fraction of what the same loop costs in Wasm. The Workers Free plan allows 10 ms of CPU a request; measured
//! under workerd on a 2.1 GHz Xeon, one derivation costs about 0.17 ms per thousand iterations (25,000: about 4.4 ms),
//! so the default is 25,000 and the Worker refuses to run more than 60,000 (about 10 ms) whatever the stored line says.
//! A pure Rust derivation sits beside it for the tests (RFC 7914 vectors), which also prove the two agree.

use sha2::{Digest, Sha256};

pub const PREFIX: &str = "pbkdf2-sha256";
pub const DEFAULT_ITERATIONS: u32 = 25_000;
pub const MIN_ITERATIONS: u32 = 10_000;
pub const MAX_ITERATIONS: u32 = 60_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Stored {
    pub iterations: u32,
    pub salt: Vec<u8>,
    pub hash: Vec<u8>,
}

/// The stored line, or `None` when it is not one this Worker will check (unknown scheme, iterations outside the
/// bounds, a salt under 16 bytes, a hash under 32).
pub fn parse(line: &str) -> Option<Stored> {
    let mut p = line.trim().split('$');
    if p.next()? != PREFIX {
        return None;
    }
    let iterations: u32 = p.next()?.parse().ok()?;
    let salt = b64_decode(p.next()?)?;
    let hash = b64_decode(p.next()?)?;
    if p.next().is_some()
        || !(MIN_ITERATIONS..=MAX_ITERATIONS).contains(&iterations)
        || salt.len() < 16
        || hash.len() < 32
    {
        return None;
    }
    Some(Stored {
        iterations,
        salt,
        hash,
    })
}

pub fn format(s: &Stored) -> String {
    format!(
        "{PREFIX}${}${}${}",
        s.iterations,
        b64_encode(&s.salt),
        b64_encode(&s.hash)
    )
}

fn hmac(key: &[u8], parts: &[&[u8]]) -> [u8; 32] {
    let mut k = [0u8; 64];
    if key.len() > 64 {
        k[..32].copy_from_slice(&Sha256::digest(key));
    } else {
        k[..key.len()].copy_from_slice(key);
    }
    let mut inner = Sha256::new();
    inner.update(k.map(|b| b ^ 0x36));
    for p in parts {
        inner.update(p);
    }
    let mut outer = Sha256::new();
    outer.update(k.map(|b| b ^ 0x5c));
    outer.update(inner.finalize());
    outer.finalize().into()
}

/// PBKDF2-HMAC-SHA256 in plain Rust: for the tests and for tools, not for the Worker's hot path.
pub fn derive(password: &[u8], salt: &[u8], iterations: u32, len: usize) -> Vec<u8> {
    let mut out = Vec::with_capacity(len);
    let mut block = 1u32;
    while out.len() < len {
        let mut u = hmac(password, &[salt, &block.to_be_bytes()]);
        let mut t = u;
        for _ in 1..iterations {
            u = hmac(password, &[&u]);
            for (a, b) in t.iter_mut().zip(u.iter()) {
                *a ^= b;
            }
        }
        out.extend_from_slice(&t);
        block += 1;
    }
    out.truncate(len);
    out
}

/// PBKDF2-SHA256 through the runtime's WebCrypto.
///
/// Interop: workers-rs has no wrapper for SubtleCrypto, so `importKey` and `deriveBits` are called through js-sys,
/// as `common::hash::random_bytes` calls `getRandomValues`.
pub async fn derive_webcrypto(
    password: &[u8],
    salt: &[u8],
    iterations: u32,
    len: usize,
) -> Result<Vec<u8>, String> {
    use js_sys::{futures::JsFuture, Array, Object, Reflect, Uint8Array};
    use wasm_bindgen::{JsCast, JsValue};
    let err = |e: JsValue| format!("webcrypto: {e:?}");
    let crypto = Reflect::get(&js_sys::global(), &"crypto".into()).map_err(err)?;
    let subtle = Reflect::get(&crypto, &"subtle".into()).map_err(err)?;
    let call = |name: &str, args: &Array| -> Result<js_sys::Promise, String> {
        let f: js_sys::Function = Reflect::get(&subtle, &name.into())
            .map_err(err)?
            .dyn_into()
            .map_err(err)?;
        f.apply(&subtle, args).map_err(err)?.dyn_into().map_err(err)
    };
    let usages = Array::of1(&"deriveBits".into());
    let key = JsFuture::from(call(
        "importKey",
        &Array::of5(
            &"raw".into(),
            &Uint8Array::from(password).into(),
            &"PBKDF2".into(),
            &JsValue::FALSE,
            &usages,
        ),
    )?)
    .await
    .map_err(err)?;
    let params = Object::new();
    Reflect::set(&params, &"name".into(), &"PBKDF2".into()).map_err(err)?;
    Reflect::set(&params, &"hash".into(), &"SHA-256".into()).map_err(err)?;
    Reflect::set(&params, &"salt".into(), &Uint8Array::from(salt)).map_err(err)?;
    Reflect::set(&params, &"iterations".into(), &JsValue::from(iterations)).map_err(err)?;
    let bits = JsFuture::from(call(
        "deriveBits",
        &Array::of3(&params, &key, &JsValue::from((len * 8) as u32)),
    )?)
    .await
    .map_err(err)?;
    Ok(Uint8Array::new(&bits).to_vec())
}

// ---------- base64 (standard alphabet, padding optional on input, written on output) ----------
const B64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

pub fn b64_encode(data: &[u8]) -> String {
    let mut s = String::with_capacity(data.len().div_ceil(3) * 4);
    for c in data.chunks(3) {
        let n = (c[0] as u32) << 16
            | (*c.get(1).unwrap_or(&0) as u32) << 8
            | *c.get(2).unwrap_or(&0) as u32;
        s.push(B64[(n >> 18) as usize & 63] as char);
        s.push(B64[(n >> 12) as usize & 63] as char);
        s.push(if c.len() > 1 {
            B64[(n >> 6) as usize & 63] as char
        } else {
            '='
        });
        s.push(if c.len() > 2 {
            B64[n as usize & 63] as char
        } else {
            '='
        });
    }
    s
}

pub fn b64_decode(s: &str) -> Option<Vec<u8>> {
    let s = s.trim_end_matches('=');
    let mut out = Vec::with_capacity(s.len() * 3 / 4);
    let (mut acc, mut bits) = (0u32, 0u32);
    for ch in s.bytes() {
        let v = B64.iter().position(|&c| c == ch)? as u32;
        acc = acc << 6 | v;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
        }
    }
    if bits >= 6 {
        return None;
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use aphesis_common::hash::hex;

    #[test]
    fn rfc7914_vectors() {
        assert_eq!(
            hex(&derive(b"passwd", b"salt", 1, 64)),
            "55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc\
             49ca9cccf179b645991664b39d77ef317c71b845b1e30bd509112041d3a19783"
        );
        assert_eq!(
            hex(&derive(b"Password", b"NaCl", 80000, 64)),
            "4ddcd8f60b98be21830cee5ef22701f9641a4418d04c0414aeff08876b34ab56\
             a1d425a1225833549adb841b51c9b3176a272bdebba1d078478f62b397f33c8d"
        );
    }

    #[test]
    fn stored_lines_round_trip_and_bounds() {
        let s = Stored {
            iterations: 25_000,
            salt: (0u8..16).collect(),
            hash: derive(b"pw", &(0u8..16).collect::<Vec<_>>(), 25_000, 32),
        };
        let line = format(&s);
        assert!(line.starts_with("pbkdf2-sha256$25000$"));
        assert_eq!(parse(&line), Some(s.clone()));
        assert_eq!(parse(&format!("  {line}\n")), Some(s.clone()));
        let with = |it: u32| {
            format(&Stored {
                iterations: it,
                ..s.clone()
            })
        };
        assert!(parse(&with(MIN_ITERATIONS - 1)).is_none());
        assert!(parse(&with(MAX_ITERATIONS + 1)).is_none());
        assert!(parse(&with(MAX_ITERATIONS)).is_some());
        assert!(parse(&line.replace("pbkdf2-sha256", "pbkdf2-sha1")).is_none());
        assert!(parse(&format!("{line}$x")).is_none());
        assert!(parse("").is_none());
        assert!(parse(&format(&Stored {
            salt: vec![1; 8],
            ..s.clone()
        }))
        .is_none());
    }

    #[test]
    fn base64() {
        for data in [&b""[..], b"f", b"fo", b"foo", b"foob", b"fooba", b"foobar"] {
            assert_eq!(b64_decode(&b64_encode(data)).unwrap(), data);
        }
        assert_eq!(b64_encode(b"foobar"), "Zm9vYmFy");
        assert_eq!(b64_encode(b"fo"), "Zm8=");
        assert_eq!(b64_decode("Zm8").unwrap(), b"fo");
        assert!(b64_decode("Z").is_none());
        assert!(b64_decode("Zm8*").is_none());
    }

    #[test]
    fn matches_node() {
        // node -e "console.log(require('crypto').pbkdf2Sync('correct horse', Buffer.from('000102030405060708090a0b0c0d0e0f','hex'), 25000, 32, 'sha256').toString('hex'))"
        let salt: Vec<u8> = (0u8..16).collect();
        assert_eq!(
            hex(&derive(b"correct horse", &salt, 25_000, 32)),
            NODE_VECTOR.trim()
        );
    }
    const NODE_VECTOR: &str = include_str!("../tests/pbkdf2-node-vector.txt");
}
