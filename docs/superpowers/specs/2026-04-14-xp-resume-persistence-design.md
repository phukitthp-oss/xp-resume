# xp-resume: Config Persistence + Security Design

**Date:** 2026-04-14
**Status:** Approved

## Problem

All configuration (wallpaper, content, icons, projects, profile) is stored in
`localStorage` under the key `xp_portfolio_config`. This means:

- Settings are lost when the user clears browser data
- Settings do not persist across devices or browsers
- Admin password is hardcoded as `admin123` and shown in plain text in the HTML

## Goals

1. Config changes made in the Admin Panel survive redeployment and browser clears
2. Admin password is no longer hardcoded or visible in source
3. Site is ready to deploy on GitHub Pages / Netlify / Vercel

---

## Architecture

### Config Priority (load order)

```
config.json (repo)  →  localStorage (draft)  →  hardcoded defaults
highest priority                               lowest priority
```

On page load, `main.js` fetches `/data/config.json`. If the fetch succeeds,
that becomes the base. localStorage overrides (unsaved drafts) are merged on
top. This means the committed `config.json` is always the canonical state.

### Files Changed

| File | Change |
|------|--------|
| `data/config.json` | **New** — canonical config, committed to git |
| `js/main.js` | Add `fetch('/data/config.json')` + priority merge logic |
| `js/admin.js` | Add export button, SHA-256 password hashing, first-login flow |
| `admin.html` | Remove password hint, add first-login prompt |
| `netlify.toml` | **New** — security headers + cache rules |

---

## Section 1: Config System

### data/config.json

A committed JSON file that mirrors the shape of `xp_portfolio_config` in
localStorage. Initially populated with the current defaults. The Admin Panel
produces a downloadable copy of this file when the user clicks
**"⬇ Download config.json"**.

### main.js — loadConfig()

Replace the current synchronous `localStorage.getItem` call with:

```js
async function loadConfig() {
    let base = {};
    try {
        const res = await fetch('/data/config.json');
        if (res.ok) base = await res.json();
    } catch (_) { /* static host, file missing, or offline */ }

    const draft = JSON.parse(localStorage.getItem('xp_portfolio_config') || '{}');
    return deepMerge(base, draft);  // draft values override base
    // deepMerge: recursive Object.assign — nested keys (images, profile, etc.)
    // are merged individually, not replaced wholesale
}
```

`applyConfig()` becomes async and awaits `loadConfig()`.

### admin.js — saveConfig()

Current `saveConfig` writes to localStorage only. New behavior:

1. Write to localStorage immediately (live preview continues to work)
2. Re-generate the in-memory config object
3. Enable the **"⬇ Download config.json"** button with a fresh Blob download

```js
function saveConfig(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    offerConfigDownload(config);   // updates the download button href
}

function offerConfigDownload(config) {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const btn = document.getElementById('downloadConfigBtn');
    btn.href = url;
    btn.download = 'config.json';
    btn.classList.remove('hidden');
}
```

User workflow after editing:
1. Make changes in Admin Panel → **Save** (localStorage updated instantly)
2. Click **"⬇ Download config.json"**
3. Replace `data/config.json` in repo → `git push` → deploy

---

## Section 2: Admin Security

### Problem

```html
<p class="hint">Default password: admin123</p>  <!-- visible to anyone -->
```

```js
const DEFAULT_PASSWORD = 'admin123';  // hardcoded in JS
```

### Solution

#### First-Login Flow

If `localStorage.getItem('xp_admin_password_hash')` is `null`:
- Show a **"Set your admin password"** form instead of the login form
- User sets a password (min 8 chars) → hashed with SHA-256 → stored as hash
- Never store plaintext

#### Password Hashing (Web Crypto API)

```js
async function hashPassword(password) {
    const buf = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(password)
    );
    return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
```

#### Auth Check

```js
async function adminAuth() {
    const hash = await hashPassword(document.getElementById('adminPassword').value);
    const stored = localStorage.getItem(PASSWORD_KEY);
    if (hash === stored) { /* login */ }
    else { showError('Incorrect password'); }
}
```

#### UI Changes in admin.html

- Remove `<p class="hint">Default password: admin123</p>`
- Add `#firstLoginSection` (hidden by default) with "Set Password" form
- Add "Change Password" button in Settings section

---

## Section 3: Deployment Config

### netlify.toml

```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/data/config.json"
  [headers.values]
    Cache-Control = "no-cache"
```

For Vercel, an equivalent `vercel.json` with the same headers can be provided.

---

## Out of Scope

- Moving admin panel to a separate subdomain or path
- Rate limiting (not possible on static host without serverless)
- Encrypting config.json contents (not necessary; config has no secrets)
- Migrating from IndexedDB (project images) — IndexedDB stays as-is

---

## Success Criteria

- [ ] After `git push`, visiting the site loads settings from `data/config.json`
- [ ] Clearing `localStorage` does not lose committed config
- [ ] Admin Panel shows "⬇ Download config.json" after any save
- [ ] No plaintext password visible in HTML source
- [ ] First visit prompts password setup if none is configured
