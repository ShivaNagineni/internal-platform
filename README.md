# Internal Platform

An internal tooling platform covering Leave Management, Innovation Hub, Release Control, and Team Dashboard.

## Stack

- **Frontend** — React 18, TypeScript, Vite, Tailwind CSS, MSAL (Azure AD)
- **Backend** — FastAPI, Beanie (MongoDB ODM), Motor, Pydantic v2
- **Auth** — Azure Active Directory (OAuth 2.0 / OIDC)
- **Database** — MongoDB
- **Notifications** — Slack

## Prerequisites

- Node.js 20+
- Python 3.11+
- MongoDB running locally (`mongod`) or Docker
- Azure AD app registration

## Quick Start

```bash
# Install root dependencies (concurrently)
npm install

# Set up backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your values

# Seed the database (optional)
python seed.py

cd ..

# Start both frontend and backend
npm run dev
```

Frontend runs on `http://localhost:3000`, API on `http://localhost:8000`.

## Environment Variables

Copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` → `frontend/.env`, then fill in:

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `AZURE_AD_TENANT_ID` | Azure AD tenant ID |
| `AZURE_AD_CLIENT_ID` | Azure AD app client ID |
| `AZURE_AD_CLIENT_SECRET` | Azure AD client secret (for Graph API user sync) |
| `GITHUB_WEBHOOK_SECRET` | Secret for GitHub webhook signature verification |
| `SLACK_BOT_TOKEN` | Slack bot token for notifications |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook URL |

## GitHub Webhook

Releases are tracked automatically via GitHub webhooks. Add a webhook to both repos:

- **Payload URL:** `https://your-host/webhooks/github`
- **Content type:** `application/json`
- **Secret:** value of `GITHUB_WEBHOOK_SECRET`
- **Events:** Pull requests only

| PR event | Branch | Release status |
|---|---|---|
| Opened | `Development` → `Qa` | PLANNED |
| Merged | → `Qa` | STAGING |
| Opened | `Qa` → `main` / `master` | IN_PROGRESS |
| Merged | → `main` / `master` | RELEASED |

PR title must contain the version, e.g. `v1.0.0 - Initial release`.
