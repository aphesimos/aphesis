//! SHA-256 in plain Rust (no round trip to `crypto.subtle`), so hashes are synchronous and testable natively.

use sha2::{Digest, Sha256};

pub fn sha256(data: &[u8]) -> [u8; 32] {
    Sha256::digest(data).into()
}

pub fn hex(bytes: &[u8]) -> String {
    const D: &[u8; 16] = b"0123456789abcdef";
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push(D[(b >> 4) as usize] as char);
        s.push(D[(b & 15) as usize] as char);
    }
    s
}

pub fn sha256_hex(s: &str) -> String {
    hex(&sha256(s.as_bytes()))
}

/// Random bytes from the runtime's CSPRNG.
///
/// Interop: workers-rs has no wrapper for `crypto.getRandomValues`, so it is called through js-sys. Filling a
/// JavaScript Uint8Array and copying it out keeps the call independent of Wasm memory views.
pub fn random_bytes(n: usize) -> Vec<u8> {
    let arr = js_sys::Uint8Array::new_with_length(n as u32);
    let crypto = js_sys::Reflect::get(&js_sys::global(), &"crypto".into()).expect("crypto");
    let f: js_sys::Function = js_sys::Reflect::get(&crypto, &"getRandomValues".into())
        .expect("getRandomValues")
        .into();
    f.call1(&crypto, &arr).expect("getRandomValues failed");
    arr.to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_digests() {
        assert_eq!(
            sha256_hex(""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            sha256_hex("abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert_eq!(hex(&[0, 15, 255]), "000fff");
    }
}
