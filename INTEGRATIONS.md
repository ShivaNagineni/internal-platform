# Integration Setup Guide

This document covers how to create and configure the Slack, GitHub, and Zoho integrations used by Internal Platform for release automation, notifications, and authentication.

---

## Table of Contents

1. [Slack Setup](#1-slack-setup)
2. [GitHub Personal Access Token](#2-github-personal-access-token)
3. [GitHub Webhook](#3-github-webhook)
4. [Zoho OAuth Setup](#4-zoho-oauth-setup)
5. [Environment Variables Reference](#5-environment-variables-reference)
6. [Local Development (ngrok)](#6-local-development-ngrok)

---

## 1. Slack Setup

The platform uses two Slack features:

| Feature | Purpose |
|---|---|
| Incoming Webhook | Post notifications (releases, leave requests) into a channel |
| Interactivity | Receive button clicks (Approve / Reject) back from Slack |

### 1.1 Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**.
2. Choose **From scratch**.
3. Give it a name (e.g. `Internal Platform`) and select your workspace.
4. Click **Create App**.

### 1.2 Enable Incoming Webhooks

1. In the left sidebar click **Incoming Webhooks**.
2. Toggle **Activate Incoming Webhooks** to **On**.
3. Scroll down and click **Add New Webhook to Workspace**.
4. Pick the channel you want notifications posted to (e.g. `#releases`) and click **Allow**.
5. Copy the **Webhook URL** — it is a long URL in the format:
   ```
   https://hooks.slack.com/services/{WORKSPACE_ID}/{CHANNEL_ID}/{TOKEN}
   ```
6. Set this as `SLACK_WEBHOOK_URL` in your `.env`.

> This webhook URL is the only thing needed to **send** messages. No bot token required.

### 1.3 Enable Interactivity (button clicks)

This is required so that "Approve Deployment", "Approve Release", and "Reject Release" buttons in Slack actually do something.

1. In the left sidebar click **Interactivity & Shortcuts**.
2. Toggle **Interactivity** to **On**.
3. In the **Request URL** field enter your backend's public URL followed by `/webhooks/slack`:
   ```
   https://your-domain.com/webhooks/slack
   ```
   For local development use your ngrok URL (see [Section 6](#6-local-development-ngrok)):
   ```
   https://xxxx-xxxx.ngrok-free.app/webhooks/slack
   ```
4. Click **Save Changes**.

> Every time your ngrok URL changes you must update this field.

### 1.4 Get the Signing Secret

Slack signs every request it sends so the backend can verify it came from Slack and not a third party.

1. In the left sidebar click **Basic Information**.
2. Scroll to **App Credentials**.
3. Copy the **Signing Secret**.
4. Set this as `SLACK_SIGNING_SECRET` in your `.env`.

### 1.5 Summary of Slack values to collect

| `.env` variable | Where to find it |
|---|---|
| `SLACK_WEBHOOK_URL` | **Incoming Webhooks** → your webhook row → copy URL |
| `SLACK_SIGNING_SECRET` | **Basic Information** → App Credentials → Signing Secret |

---

## 2. GitHub Personal Access Token

The backend uses a **Fine-Grained Personal Access Token (PAT)** to:

- Auto-merge the `Development → Qa` PR when "Approve Deployment" is clicked
- Auto-create a `Qa → main` PR when a release reaches Staging
- Auto-merge the `Qa → main` PR when "Approve Release" is clicked
- Auto-create a `Development → Qa` PR when a release is manually planned in the app

### 2.1 Create the token

1. Go to [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new).
2. Under **Token name** give it a descriptive name (e.g. `internal-platform-automation`).
3. Set an **Expiration** (90 days is a good balance; add a calendar reminder to rotate it).
4. Under **Resource owner** select your personal account or organisation.
5. Under **Repository access** choose **Only select repositories** and pick the repo(s) you want to automate.

### 2.2 Required permissions

Set exactly these permissions — nothing more is needed:

| Permission | Access level | Why |
|---|---|---|
| **Contents** | Read and write | Merge PRs (merging counts as a write to the branch) |
| **Pull requests** | Read and write | Create PRs and merge them via the API |

Everything else can remain **No access**.

6. Click **Generate token** and copy the token immediately — you cannot see it again.
7. Set this as `GITHUB_TOKEN` in your `.env`.

### 2.3 Token format

Fine-grained tokens start with `github_pat_`:

```
github_pat_11XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### 2.4 Rotating the token

When the token expires:

1. Go to [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens).
2. Find the token, click it, and choose **Regenerate token**.
3. Update `GITHUB_TOKEN` in `backend/.env`.
4. Restart the backend (`@lru_cache` on `get_settings()` caches the old value until restart).

---

## 3. GitHub Webhook

GitHub webhooks drive the release pipeline automatically. When a PR is opened or merged the backend updates the release status.

### 3.1 PR → release status mapping

| PR event | Head branch | Base branch | Release status |
|---|---|---|---|
| Opened | `Development` | `Qa` | PLANNED |
| Merged | `Development` | `Qa` | STAGING |
| Opened | `Qa` | `main` / `master` | IN_PROGRESS |
| Merged | `Qa` | `main` / `master` | RELEASED |

> **PR title must contain the version number**, e.g. `v1.2.0 - My release title`. The webhook ignores PRs without a `vX.Y.Z` pattern in the title.

### 3.2 Create the webhook

1. Go to your repo on GitHub → **Settings** → **Webhooks** → **Add webhook**.
2. Fill in the fields:

| Field | Value |
|---|---|
| **Payload URL** | `https://your-domain.com/webhooks/github` (or ngrok URL for local dev) |
| **Content type** | `application/json` |
| **Secret** | A random string you generate (see below) |
| **Which events?** | Choose **Let me select individual events**, then tick **Pull requests** only |
| **Active** | ✓ checked |

3. Click **Add webhook**.

### 3.3 Generate a webhook secret

The secret lets the backend verify that incoming webhook calls are really from GitHub.

```bash
# Generate a random 32-character secret
openssl rand -hex 32
```

Copy the output, paste it into the GitHub webhook **Secret** field, and also set it as `GITHUB_WEBHOOK_SECRET` in your `.env`.

### 3.4 Verify delivery

After saving the webhook GitHub sends a **ping** event. Go to the webhook page, click **Recent Deliveries** and confirm the ping shows a green tick (200 response).

---

## 4. Zoho OAuth Setup

Zoho OAuth lets all employees sign in with their Zoho account, in addition to Azure AD. Users from Zoho who don't have an Azure AD account are automatically provisioned in the platform on first login.

### 4.1 Open the Zoho API Console

Go to [api-console.zoho.com](https://api-console.zoho.com) and sign in with your Zoho account.

### 4.2 Create the OAuth client

1. Click **Add Client**.
2. **Choose the correct client type — this matters:**

   | Type | Use this? | Why |
   |---|---|---|
   | **Server-based Applications** | ✅ Yes | Backend holds the client secret and exchanges the code server-side |
   | Client-based Applications | ❌ No | For SPAs with no backend secret — wrong for this setup |
   | Self Client | ❌ No | For personal scripts, not user-facing login |

3. Select **Server-based Applications** and fill in the form:

   | Field | Value |
   |---|---|
   | **Client Name** | `Internal Platform` |
   | **Homepage URL** | `http://localhost:3000` (update to prod URL when deploying) |
   | **Authorized Redirect URIs** | `http://localhost:3000/auth/zoho/callback` |

4. Click **CREATE**.

5. Zoho shows your **Client ID** and **Client Secret** — copy both immediately.

   - Client ID format: `1000.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
   - Client Secret: a long alphanumeric string

6. Add them to `backend/.env`:
   ```env
   ZOHO_CLIENT_ID=1000.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ZOHO_CLIENT_SECRET=your-client-secret
   ZOHO_REDIRECT_URI=http://localhost:3000/auth/zoho/callback
   ```

### 4.3 Delete a wrongly created client

If you accidentally created a **Client-based Applications** client (or any other wrong type) you can delete it cleanly:

1. Go to [api-console.zoho.com](https://api-console.zoho.com).
2. Find the wrong client in the list and click on it to open its details.
3. Click the **Delete** button (usually in the top-right or bottom of the client details page).
4. Confirm the deletion.

> Deleting a client immediately invalidates its Client ID and Client Secret. If you had already added those credentials to `.env`, replace them with the new Server-based client's credentials and restart the backend.

### 4.4 Required OAuth scopes

The platform requests these scopes during login:

| Scope | Purpose |
|---|---|
| `openid` | Required for OIDC — enables the userinfo endpoint |
| `profile` | User's display name |
| `email` | User's email address (used to link with existing Azure AD accounts) |

No admin-level or data-write scopes are needed.

### 4.5 How account linking works

When a Zoho user signs in for the first time:

- If a user with the **same email** already exists (e.g. from Azure AD sync), the Zoho UID is linked to that account — the user keeps their existing role and data.
- If no matching email exists, a new account is created with the **EMPLOYEE** role. A manager can promote them via the Users page.

### 4.6 Summary of Zoho values to collect

| `.env` variable | Where to find it |
|---|---|
| `ZOHO_CLIENT_ID` | API Console → your client → Client ID |
| `ZOHO_CLIENT_SECRET` | API Console → your client → Client Secret |
| `ZOHO_REDIRECT_URI` | Set to `http://localhost:3000/auth/zoho/callback` (or your prod URL) |

---

## 5. Environment Variables Reference

All variables live in `backend/.env`. Copy `backend/.env.example` as a starting point.

```env
# ── MongoDB ───────────────────────────────────────────────────────────────────
MONGO_URI=mongodb://localhost:27017/
DB_NAME=internal_app

# ── Azure AD (authentication) ─────────────────────────────────────────────────
AZURE_AD_TENANT_ID=your-tenant-id
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret

# ── Zoho OAuth (authentication) ───────────────────────────────────────────────
ZOHO_CLIENT_ID=1000.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
ZOHO_CLIENT_SECRET=your-zoho-client-secret
ZOHO_REDIRECT_URI=http://localhost:3000/auth/zoho/callback

# ── GitHub ────────────────────────────────────────────────────────────────────
GITHUB_TOKEN=github_pat_...          # Fine-grained PAT (Contents + Pull requests R/W)
GITHUB_WEBHOOK_SECRET=...            # Random secret shared with GitHub webhook config
GITHUB_REPOS=ShivaNagineni/internal-platform   # Comma-separated for multiple repos

# ── Slack ─────────────────────────────────────────────────────────────────────
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/{WORKSPACE}/{CHANNEL}/{TOKEN}
SLACK_SIGNING_SECRET=...             # From Basic Information → App Credentials

# ── App ───────────────────────────────────────────────────────────────────────
SECRET_KEY=change-me-in-production   # Used to sign Zoho session JWTs
```

---

## 6. Local Development (ngrok)

Both the GitHub webhook and Slack interactivity need a **publicly reachable URL** to call back into your laptop. ngrok creates a secure tunnel.

### 6.1 Install ngrok

```bash
brew install ngrok       # macOS
# or download from https://ngrok.com/download
```

### 6.2 Start the tunnel

```bash
ngrok http 8000
```

ngrok prints a forwarding URL like:

```
Forwarding  https://xxxx-xxxx.ngrok-free.app -> http://localhost:8000
```

### 6.3 Update the two places that need the URL

| Where | Value to set |
|---|---|
| GitHub webhook **Payload URL** | `https://xxxx-xxxx.ngrok-free.app/webhooks/github` |
| Slack **Interactivity Request URL** | `https://xxxx-xxxx.ngrok-free.app/webhooks/slack` |

> The free ngrok tier gives a new random URL every time you restart it. Update both places each time.

### 6.4 Verify the tunnel is working

```bash
curl https://xxxx-xxxx.ngrok-free.app/health
# Should return: {"status":"ok"}
```

---

## Quick-reference checklist

```
Slack
  [ ] App created
  [ ] Incoming Webhook enabled and URL copied → SLACK_WEBHOOK_URL
  [ ] Interactivity enabled with /webhooks/slack request URL
  [ ] Signing Secret copied → SLACK_SIGNING_SECRET

GitHub
  [ ] Fine-grained PAT created with Contents R/W + Pull requests R/W → GITHUB_TOKEN
  [ ] Webhook added to repo pointing to /webhooks/github
  [ ] Webhook secret generated and set in both GitHub and → GITHUB_WEBHOOK_SECRET
  [ ] GITHUB_REPOS set to owner/repo

Zoho
  [ ] Server-based Applications client created at api-console.zoho.com
  [ ] Any wrongly typed clients deleted
  [ ] Client ID copied → ZOHO_CLIENT_ID
  [ ] Client Secret copied → ZOHO_CLIENT_SECRET
  [ ] Redirect URI set to /auth/zoho/callback → ZOHO_REDIRECT_URI

Local dev
  [ ] ngrok running on port 8000
  [ ] GitHub webhook Payload URL updated to ngrok URL
  [ ] Slack Interactivity Request URL updated to ngrok URL
```
