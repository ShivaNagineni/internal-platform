# Integration Setup Guide

This document covers how to create and configure the Slack and GitHub integrations used by Internal Platform for release automation and notifications.

---

## Table of Contents

1. [Slack Setup](#1-slack-setup)
2. [GitHub Personal Access Token](#2-github-personal-access-token)
3. [GitHub Webhook](#3-github-webhook)
4. [Environment Variables Reference](#4-environment-variables-reference)
5. [Local Development (ngrok)](#5-local-development-ngrok)

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
   For local development use your ngrok URL (see [Section 5](#5-local-development-ngrok)):
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

## 4. Environment Variables Reference

All variables live in `backend/.env`. Copy `backend/.env.example` as a starting point.

```env
# ── MongoDB ───────────────────────────────────────────────────────────────────
MONGO_URI=mongodb://localhost:27017/
DB_NAME=internal_app

# ── Azure AD (authentication) ─────────────────────────────────────────────────
AZURE_AD_TENANT_ID=your-tenant-id
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret

# ── GitHub ────────────────────────────────────────────────────────────────────
GITHUB_TOKEN=github_pat_...          # Fine-grained PAT (Contents + Pull requests R/W)
GITHUB_WEBHOOK_SECRET=...            # Random secret shared with GitHub webhook config
GITHUB_REPOS=ShivaNagineni/internal-platform   # Comma-separated for multiple repos

# ── Slack ─────────────────────────────────────────────────────────────────────
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/{WORKSPACE}/{CHANNEL}/{TOKEN}   # Incoming webhook URL
SLACK_SIGNING_SECRET=...             # From Basic Information → App Credentials
```

---

## 5. Local Development (ngrok)

Both the GitHub webhook and Slack interactivity need a **publicly reachable URL** to call back into your laptop. ngrok creates a secure tunnel.

### 5.1 Install ngrok

```bash
brew install ngrok       # macOS
# or download from https://ngrok.com/download
```

### 5.2 Start the tunnel

```bash
ngrok http 8000
```

ngrok prints a forwarding URL like:

```
Forwarding  https://xxxx-xxxx.ngrok-free.app -> http://localhost:8000
```

### 5.3 Update the two places that need the URL

| Where | Value to set |
|---|---|
| GitHub webhook **Payload URL** | `https://xxxx-xxxx.ngrok-free.app/webhooks/github` |
| Slack **Interactivity Request URL** | `https://xxxx-xxxx.ngrok-free.app/webhooks/slack` |

> The free ngrok tier gives a new random URL every time you restart it. Update both places each time.

### 5.4 Verify the tunnel is working

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

Local dev
  [ ] ngrok running on port 8000
  [ ] GitHub webhook Payload URL updated to ngrok URL
  [ ] Slack Interactivity Request URL updated to ngrok URL
```
