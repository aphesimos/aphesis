# me

**me.aphes.ist** is the readable counterpart to aphes.ist: one plain page that says who I am, what I have made and
how to reach me, for people who want the summary rather than the fog. It keeps the design system (the two faces,
lowercase, the tokens, the φ in the corner, the eye) through the lab kit, the system's readable form, and drops what
belongs to the work itself: no motion, no sound, no cursor, the stipple ground off unless the reader turns it on.

## What is here

| file | what it is |
| --- | --- |
| `index.html` | the page: one column, semantic HTML, its own few rules on the system's tokens. It reads complete without JavaScript (the theme then follows the system) |
| `build.py` | gathers what is served into `dist/`: the page, the lab kit (`system/lab-kit/v1/` from `design-system`), the φ (`system/assets/Logos/phi.svg`) and `public/`. It generates nothing, and lists any `[[placeholder]]` left in the page |
| `public/` | `_headers` (security headers, caching) and `robots.txt` for Cloudflare Pages |
| `../.github/workflows/me.yml` | the deploy |

The lab kit is copied beside the page instead of linked from aphes.ist, so the page loads from its own origin and
stands on its own; it follows `v1` at every build, as the site's own deploy does.

## Build and look at it

```sh
git fetch origin design-system:refs/remotes/origin/design-system
python3 me/build.py --out dist          # --ref design-system to use the local branch
python3 -m http.server -d dist 8000     # then http://localhost:8000
```

`--require-filled` makes the build stop while a `[[placeholder]]` is left; the deploy always uses it.

## Before the first deploy: what only the owner can fill

- `[[linkedin]]`: the LinkedIn profile URL (the link and its text, in the contact list).
- `[[cv link]]`: the CV's URL (the link and its text). A PDF can live in `me/public/` and be linked as `/cv.pdf`.

## Deploy

The workflow `me` builds the page and publishes it with wrangler to the Cloudflare Pages project **`aphesist-me`**,
on every push to `me` that touches `me/` or the workflow, and by hand (Actions → me → Run workflow; it always builds
the `me` branch). It uses the repository's existing secrets, `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, and
creates the project the first time it runs.

1. Fill the placeholders above and commit on `me`.
2. Push the branch: `git push origin me`. The workflow runs, creates `aphesist-me` and deploys; the page answers at
   `https://aphesist-me.pages.dev`.
3. Attach the domain, once: Cloudflare dashboard → Workers & Pages → `aphesist-me` → **Custom domains** →
   **Set up a domain** → `me.aphes.ist` → Continue → Activate domain. The `aphes.ist` zone is on Cloudflare, so it
   creates the DNS record (a proxied CNAME `me` → `aphesist-me.pages.dev`) and the certificate by itself; nothing is
   added by hand. It is live within a few minutes.

## Content

The page is written in English, lowercase as the house style asks (proper nouns in running text keep their
capitals), in the first person, short. Every fact comes from the owner's CV and from the works entries on
`section/works`; nothing else is claimed.
