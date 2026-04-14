# xp-resume Config Persistence + Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace localStorage-only config with `data/config.json` as canonical source, hash admin passwords with SHA-256, and add deployment headers.

**Architecture:** On page load `main.js` fetches `/data/config.json` as the base, deep-merges any localStorage draft on top, then applies to the DOM. Admin Panel saves to localStorage for instant preview, and generates a downloadable `config.json` the user commits to the repo. Password auth uses Web Crypto SHA-256 — no plaintext stored anywhere.

**Tech Stack:** Vanilla JS (ES2020), Web Crypto API, Blob/URL API, static hosting (Netlify / Vercel / GitHub Pages)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `data/config.json` | Create | Canonical config committed to git |
| `js/main.js` | Modify lines 33–45 | Async loadConfig + deepMerge |
| `js/admin.js` | Modify lines 1–10, 147–197 | Remove DEFAULT_PASSWORD, SHA-256 auth, export button |
| `admin.html` | Modify lines 14–20, 542–555 | Remove hint, add first-login section, add download button |
| `netlify.toml` | Create | Security + cache headers |
| `vercel.json` | Create | Same headers for Vercel users |

---

## Task 1: Create `data/config.json`

**Files:**
- Create: `data/config.json`

- [ ] **Step 1: Create the data directory and config file**

Create `data/config.json` with the current hardcoded defaults. This becomes the canonical config the site loads on every visit.

```json
{
  "content": {
    "bootTitle": "Phukit T.",
    "bootTitleSuffix": "xp",
    "bootSubtitle": "Visual Designer",
    "bootHint": "For the best experience\nEnter Full Screen (F11)",
    "bootPortfolio": "Portfolio®",
    "loginTitle": "Phukit T.",
    "loginTitleSuffix": "xp",
    "loginSubtitle": "Visual Designer",
    "userName": "Phukit T.",
    "userRole": "Visual Designer"
  },
  "profile": {
    "email": "",
    "location": "",
    "instagram": "",
    "github": "",
    "linkedin": ""
  },
  "bootText": {
    "left": "Phukit T.",
    "right": "xp",
    "subtitle": "Visual Designer",
    "bottomLeft": "For the best experience\nEnter Full Screen (F11)",
    "bottomRight": "Portfolio®",
    "fontName": 72,
    "fontXP": 48,
    "fontSubtitle": 24,
    "fontHint": 14,
    "fontBrand": 36
  },
  "bootLoader": {
    "loops": 1,
    "width": 220,
    "height": 22,
    "radius": 0,
    "duration": 2
  },
  "bootScreenDuration": 3500,
  "iconSize": 48,
  "iconFontSize": 11,
  "iconGap": 16,
  "iconMargin": 20,
  "crtEffect": {
    "scanlineOpacity": 0.5,
    "vignetteOpacity": 0,
    "brightness": 100
  },
  "images": {},
  "resume": {
    "bgColor": "#ffffff"
  },
  "aboutMe": {
    "title": "About Me",
    "paragraph1": "",
    "paragraph2": "",
    "paragraph3": "",
    "paragraph4": "",
    "skillsTitle": "Skills",
    "skills": "",
    "softwareTitle": "Software",
    "software": "",
    "sidebarColor": "#1a3c5e",
    "mainColor": "#f0f4f8",
    "titleSize": 28,
    "fontSize": 14,
    "avatarSize": 80
  },
  "projects": []
}
```

- [ ] **Step 2: Verify file is valid JSON**

Open a terminal in the project root and run:
```bash
node -e "JSON.parse(require('fs').readFileSync('data/config.json','utf8')); console.log('valid')"
```
Expected output: `valid`

- [ ] **Step 3: Commit**

```bash
git add data/config.json
git commit -m "feat: add canonical data/config.json"
```

---

## Task 2: Update `js/main.js` — async config loading

**Files:**
- Modify: `js/main.js:5-475`

- [ ] **Step 1: Add `deepMerge` utility and async `loadConfig` at the top of the IIFE**

In `js/main.js`, inside the IIFE (after `'use strict';`), add before `let windowManager`:

```js
function deepMerge(base, override) {
    const result = Object.assign({}, base);
    for (const key of Object.keys(override)) {
        if (
            override[key] !== null &&
            typeof override[key] === 'object' &&
            !Array.isArray(override[key]) &&
            typeof base[key] === 'object' &&
            base[key] !== null
        ) {
            result[key] = deepMerge(base[key], override[key]);
        } else {
            result[key] = override[key];
        }
    }
    return result;
}

async function loadConfig() {
    let base = {};
    try {
        const res = await fetch('data/config.json');
        if (res.ok) base = await res.json();
    } catch (_) { /* offline or file missing — fall through to localStorage */ }
    const draft = JSON.parse(localStorage.getItem('xp_portfolio_config') || '{}');
    return deepMerge(base, draft);
}
```

- [ ] **Step 2: Make `init` async and await `loadConfig`**

Replace the existing `init` function:

```js
async function init() {
    const bootScreen = document.getElementById('bootScreen');
    if (bootScreen) {
        setTimeout(() => {
            bootScreen.classList.add('fade-out');
            setTimeout(() => { bootScreen.style.display = 'none'; }, 500);
        }, 3500);
    }

    windowManager = new WindowManager();
    clock = new Clock('trayClock');

    await applyConfig();
    setupEventListeners();
}
```

- [ ] **Step 3: Make `applyConfig` async and use the new `loadConfig`**

Replace the first two lines of `applyConfig`:

Old (line 44–45):
```js
function applyConfig() {
    const config = JSON.parse(localStorage.getItem('xp_portfolio_config') || '{}');
```

New:
```js
async function applyConfig() {
    const config = await loadConfig();
```

- [ ] **Step 4: Fix the DOMContentLoaded call at the bottom to handle async init**

Replace the last block (lines 469–474):

Old:
```js
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
```

New:
```js
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init().catch(console.error));
} else {
    init().catch(console.error);
}
```

- [ ] **Step 5: Verify in browser**

Open `index.html` via a local server (e.g. `npx serve .` or VS Code Live Server).

1. Open DevTools → Network tab
2. Hard-refresh the page
3. Confirm a request to `data/config.json` appears with status `200`
4. Confirm the page renders normally

- [ ] **Step 6: Verify fallback when config.json is missing**

Temporarily rename `data/config.json` → `data/config.json.bak`, refresh. Page should still render using hardcoded defaults. Rename back.

- [ ] **Step 7: Commit**

```bash
git add js/main.js
git commit -m "feat: load config from data/config.json with localStorage draft merge"
```

---

## Task 3: Update `js/admin.js` — export button + SHA-256 password

**Files:**
- Modify: `js/admin.js:1-10` (constants)
- Modify: `js/admin.js:147-197` (auth functions)
- Modify: `js/admin.js:195-197` (saveConfig)

- [ ] **Step 1: Remove hardcoded DEFAULT_PASSWORD constant**

At the top of `js/admin.js`, replace:

Old (lines 6–9):
```js
const CONFIG_KEY = 'xp_portfolio_config';
const PASSWORD_KEY = 'xp_admin_password';
const DEFAULT_PASSWORD = 'admin123';
```

New:
```js
const CONFIG_KEY = 'xp_portfolio_config';
const PASSWORD_KEY = 'xp_admin_password_hash';
```

- [ ] **Step 2: Add `hashPassword` utility after the constants**

Add immediately after the two constants:

```js
async function hashPassword(plain) {
    const buf = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(plain)
    );
    return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
```

- [ ] **Step 3: Replace `adminAuth` with async SHA-256 version**

Replace the existing `adminAuth` function (lines ~148–159):

Old:
```js
function adminAuth() {
    const password = document.getElementById('adminPassword').value;
    const storedPassword = localStorage.getItem(PASSWORD_KEY) || DEFAULT_PASSWORD;

    if (password === storedPassword) {
        document.getElementById('adminLogin').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'flex';
        loadAllData();
        showMessage('✅ Login successful!', 'success');
    } else {
        alert('❌ Incorrect password!');
    }
}
```

New:
```js
async function adminAuth() {
    const input = document.getElementById('adminPassword').value;
    if (!input) return;
    const stored = localStorage.getItem(PASSWORD_KEY);
    if (!stored) {
        // No password set yet — show setup flow
        showFirstLoginSection();
        return;
    }
    const hash = await hashPassword(input);
    if (hash === stored) {
        document.getElementById('adminLogin').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'flex';
        loadAllData();
        showMessage('Login successful', 'success');
    } else {
        const errEl = document.getElementById('loginError');
        if (errEl) errEl.textContent = 'Incorrect password';
    }
}

function showFirstLoginSection() {
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('firstLoginSection').style.display = 'block';
}

async function setFirstPassword() {
    const pw = document.getElementById('firstPassword').value;
    const pw2 = document.getElementById('firstPasswordConfirm').value;
    const errEl = document.getElementById('firstLoginError');
    if (pw.length < 8) { errEl.textContent = 'Password must be at least 8 characters'; return; }
    if (pw !== pw2) { errEl.textContent = 'Passwords do not match'; return; }
    const hash = await hashPassword(pw);
    localStorage.setItem(PASSWORD_KEY, hash);
    document.getElementById('firstLoginSection').style.display = 'none';
    document.getElementById('adminLogin').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'flex';
    loadAllData();
    showMessage('Password set. Welcome!', 'success');
}
```

- [ ] **Step 4: Replace `changePassword` to use SHA-256**

Find the existing `changePassword` function and replace it:

```js
async function changePassword() {
    const newPw = document.getElementById('newPassword').value;
    const confirmPw = document.getElementById('confirmPassword').value;
    if (newPw.length < 8) { showMessage('Password must be at least 8 characters', 'error'); return; }
    if (newPw !== confirmPw) { showMessage('Passwords do not match', 'error'); return; }
    const hash = await hashPassword(newPw);
    localStorage.setItem(PASSWORD_KEY, hash);
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    showMessage('Password updated', 'success');
}
```

- [ ] **Step 5: Update `saveConfig` to offer download**

Replace the existing `saveConfig` function (lines ~195–197):

Old:
```js
function saveConfig(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}
```

New:
```js
function saveConfig(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    offerConfigDownload(config);
}

function offerConfigDownload(config) {
    const existing = URL.createObjectURL(
        new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    );
    const btn = document.getElementById('downloadConfigBtn');
    if (!btn) return;
    btn.href = existing;
    btn.download = 'config.json';
    btn.classList.remove('hidden');
}
```

- [ ] **Step 6: Export new functions to window**

`admin.js` has no IIFE, so `function` declarations are already global. Only `setFirstPassword` is new and called from `onclick` in HTML — add it to the export block at the bottom of `js/admin.js` inside the `if (typeof window !== 'undefined')` block:

```js
window.setFirstPassword = setFirstPassword;
```

> **Note:** Complete Task 4 (HTML changes) before verifying — `loginBox`, `firstLoginSection`, and `downloadConfigBtn` element IDs must exist in the DOM first.

- [ ] **Step 7: Commit**

```bash
git add js/admin.js
git commit -m "feat: SHA-256 password hashing, first-login flow, config export button"
```

---

## Task 4: Update `admin.html` — UI changes

**Files:**
- Modify: `admin.html:14-20` (login box)
- Modify: `admin.html:542-555` (settings section)

- [ ] **Step 1: Update the login box — remove hint, add error label, add first-login section**

Replace the login div (lines 12–21):

Old:
```html
<div class="admin-login" id="adminLogin">
    <div class="login-box">
        <h1>🔐 Admin Panel</h1>
        <p>Enter password to access content management</p>
        <input type="password" id="adminPassword" placeholder="Enter password">
        <button onclick="adminAuth()">Login</button>
        <p class="hint">Default password: admin123</p>
    </div>
</div>
```

New:
```html
<div class="admin-login" id="adminLogin">
    <div class="login-box" id="loginBox">
        <h1>Admin Panel</h1>
        <p>Enter password to access content management</p>
        <input type="password" id="adminPassword" placeholder="Password" onkeydown="if(event.key==='Enter') adminAuth()">
        <button onclick="adminAuth()">Login</button>
        <p id="loginError" style="color:#c00;font-size:13px;min-height:18px;"></p>
    </div>
    <div id="firstLoginSection" style="display:none;" class="login-box">
        <h1>Set Admin Password</h1>
        <p>No password is configured. Set one now (min 8 characters).</p>
        <input type="password" id="firstPassword" placeholder="New password">
        <input type="password" id="firstPasswordConfirm" placeholder="Confirm password">
        <button onclick="setFirstPassword()">Set Password</button>
        <p id="firstLoginError" style="color:#c00;font-size:13px;min-height:18px;"></p>
    </div>
</div>
```

- [ ] **Step 2: Add "Download config.json" button in settings section**

Find the Export Configuration block (around line 551–555):

Old:
```html
<div class="editor-group">
    <label>Export Configuration</label>
    <p>Download all settings as JSON file</p>
    <button onclick="exportConfig()" class="btn-secondary">Export Config</button>
</div>
```

New:
```html
<div class="editor-group">
    <label>Download config.json</label>
    <p>Save all settings as <code>data/config.json</code> in your repo to make them permanent.</p>
    <a id="downloadConfigBtn" class="btn-primary hidden" style="display:inline-block;text-decoration:none;padding:8px 16px;">
        ⬇ Download config.json
    </a>
    <button onclick="exportConfig()" class="btn-secondary" style="margin-top:6px;">Export (legacy)</button>
</div>
```

- [ ] **Step 3: Add `.hidden` CSS rule to `css/admin.css`**

Open `css/admin.css` and add at the end:

```css
.hidden { display: none !important; }
```

- [ ] **Step 4: Verify in browser**

1. Open `admin.html` — confirm NO "Default password: admin123" text visible
2. Leave password field empty and click Login — nothing should error
3. Click Login without a stored hash — first-login section appears
4. Set a password (min 8 chars) — should log in automatically
5. Log out and log back in with the new password — succeeds
6. Wrong password — shows "Incorrect password" text (no `alert()`)
7. Make any config change and save — "⬇ Download config.json" button appears
8. Click the download button — browser downloads `config.json`

- [ ] **Step 5: Commit**

```bash
git add admin.html css/admin.css
git commit -m "feat: remove plaintext password hint, add first-login flow, config download button"
```

---

## Task 5: Add deployment config

**Files:**
- Create: `netlify.toml`
- Create: `vercel.json`

- [ ] **Step 1: Create `netlify.toml`**

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

- [ ] **Step 2: Create `vercel.json`**

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/data/config.json",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache" }
      ]
    }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add netlify.toml vercel.json
git commit -m "feat: add netlify and vercel deployment headers"
```

---

## Final Verification

- [ ] Open site via local server (`npx serve .`) — Network tab shows `data/config.json` request
- [ ] Change a setting in Admin Panel, save, download `config.json`
- [ ] Replace `data/config.json` in project with downloaded file
- [ ] Hard-refresh page — setting is reflected without localStorage
- [ ] Clear localStorage (`localStorage.clear()` in console) — setting still loads from `config.json`
- [ ] Admin password: no plaintext visible in `admin.html` source
- [ ] First-login flow works on a fresh browser profile (no localStorage)

---

## Success Criteria (from spec)

- [ ] After `git push`, visiting the site loads settings from `data/config.json`
- [ ] Clearing `localStorage` does not lose committed config
- [ ] Admin Panel shows "⬇ Download config.json" after any save
- [ ] No plaintext password visible in HTML source
- [ ] First visit prompts password setup if none is configured
