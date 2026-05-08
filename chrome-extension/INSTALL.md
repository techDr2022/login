# Techdr Task Assistant - Team Install

This extension now has a simple flow:
1) first click -> login
2) next clicks -> direct assign task form

## Install (each team member)
1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `chrome-extension` folder (must contain `manifest.json`).

## First-time setup
1. Right-click extension icon -> **Extension settings...**
2. Set Base URL (example: `https://login.techdr.in`) and save.
3. Click extension icon.
4. Login with app email/password (inside popup).

## Daily usage
- Click extension icon -> **Assign task** form opens directly.
- Fill title/message, assignee, client, task type, due date -> **Create task**.

## WhatsApp quick add (optional)
1. Select message text in WhatsApp Web.
2. Right-click -> **Add selection as task**.
3. It uses saved defaults from extension settings.

# Internal app + WhatsApp tasks — team install

Share the **`chrome-extension`** folder (zipped). Each person loads it **once** in Chrome (Chrome **114+**).

## What you get

- **Click the extension icon** → your app opens in a **pop-out window** (full site, same login as a normal tab).
- **Normal tab instead:** right-click the extension icon → **Show shortcuts panel** → **Open in Chrome tab**.
- **Settings:** right-click the extension icon → **Extension settings…**
- **WhatsApp:** select message text → right-click → **Add selection as task** (configure defaults in settings first).

## Steps (every team member)

1. Unzip so you have a folder that contains **`manifest.json`**.
2. **`chrome://extensions`** → **Developer mode** → **Load unpacked** → select that folder.
3. Log into **https://login.techdr.in** (or your URL) in Chrome once.
4. Right-click the extension icon → **Extension settings…** → save **base URL** + allow permission → **Load lists** → **Save defaults**.
5. **Click the icon** anytime to open the app.

## If the pop-out says “refused to connect”

That is a **network/server** problem, not the extension. Test the same URL in a normal address bar.
