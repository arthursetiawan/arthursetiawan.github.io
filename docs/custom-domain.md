# Custom domain: arthursetiawan.com

GitHub Pages source: `arthursetiawan/arthursetiawan.github.io`.

## DNS (registrar or Cloudflare)

**Apex — A records:**

| Host | Type | Value |
|------|------|-------|
| `@` | A | `185.199.108.153` |
| `@` | A | `185.199.109.153` |
| `@` | A | `185.199.110.153` |
| `@` | A | `185.199.111.153` |

**`www` — CNAME:**

| Host | Type | Value |
|------|------|-------|
| `www` | CNAME | `arthursetiawan.github.io` |

Optional: GitHub’s four IPv6 `2606:50c0:8000::…` AAAA records if your DNS supports them.

## GitHub

Repo → **Settings → Pages → Custom domain** → `arthursetiawan.com` → after DNS checks pass, enable **Enforce HTTPS**.

This repo includes a root `CNAME` with that hostname (required by Pages).

## After DNS is live

Site links and `og:url` still use `arthursetiawan.github.io` until DNS and HTTPS are verified. Plan a follow-up pass to prefer `https://arthursetiawan.com/` in HTML/README links—not done in the custom-domain prep commit.

## Verify

- `dig arthursetiawan.com A` → the four GitHub IPs above.
- Browser: `https://arthursetiawan.com` matches `https://arthursetiawan.github.io`.