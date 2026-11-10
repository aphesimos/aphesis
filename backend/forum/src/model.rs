//! The shapes that travel between the Worker, its objects and the page.

use serde::{Deserialize, Serialize};

/// A picture as stored: the two R2 keys and the density map's size.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Image {
    pub original: String,
    pub density: String,
    pub w: u32,
    pub h: u32,
}

/// A picture as the page sees it: paths relative to the Worker.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PublicImage {
    pub density: String,
    pub original: String,
    pub w: u32,
    pub h: u32,
    pub caption: &'static str,
}

impl From<&Image> for PublicImage {
    fn from(i: &Image) -> Self {
        PublicImage {
            density: format!("/api/images/{}", i.density),
            original: format!("/api/images/{}", i.original),
            w: i.w,
            h: i.h,
            caption: "a picture, posted here",
        }
    }
}

/// What the Worker hands a thread to store.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewPost {
    pub poster: String,
    pub text: String,
    pub created: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image: Option<Image>,
}

/// A thread's line on the board, as the Worker sends it after a post.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created: Option<i64>,
    pub bumped: i64,
    pub replies: i64,
    pub first: String,
    pub image: Option<Image>,
}
