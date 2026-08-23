# PEPTIVANTA CRM — Cloudflare D1 production setup

## Required Cloudflare resources

Pages project: `peptivanta-crm`

Create one D1 database, recommended name: `peptivanta-crm-db`.

Bind it to the Pages project with the exact binding variable name:

`DB`

The Pages Functions create the required tables automatically on first request. No manual SQL migration is required.

## Required secret

Add a Production secret/environment variable:

`BOOTSTRAP_TOKEN`

Use a random value of at least 32 characters. It is only used once to create the first Super Administrator. Do not commit this value to GitHub.

Optional OCR secret:

`OCRSPACE_API_KEY`

If omitted, the screenshot OCR function uses the OCR.Space test key and may be rate-limited.

## First launch

1. Redeploy after adding the D1 binding and secret.
2. Open the CRM root URL.
3. The login page detects an empty `users` table and shows “首次初始化”.
4. Enter `BOOTSTRAP_TOKEN`, admin username/display name, and a password of at least 10 characters.
5. The server creates the first Super Administrator and an HttpOnly session cookie.
6. The CRM creates the shared application state in D1 automatically.
7. If the administrator browser already has local CRM data, the cloud shell offers a one-time migration into D1.

## Permission groups enforced by server

- 超级管理员: all CRM data and all management functions.
- 一级管理员: managed sales teams; can manage subordinate accounts in those teams.
- 二级管理员 / 组长: own sales team data.
- 普通销售: only customers/orders owned by the logged-in sales rep.

The server filters D1 data before returning it. Hidden data is not merely hidden by CSS.

## Security model

- Passwords: PBKDF2-SHA256, 210,000 iterations, per-user random salt.
- Sessions: random bearer value stored as SHA-256 hash in D1; browser cookie is HttpOnly + Secure + SameSite=Strict.
- Session lifetime: 12 hours.
- Static CRM assets and non-public APIs are protected by Pages middleware.
- Shared CRM state uses optimistic `revision` locking; concurrent writes return HTTP 409 rather than silently overwriting another user's update.
- Audit table records login, user creation/update, and state sync operations.

## D1 tables

Created automatically by `functions/_lib/auth.js`:

- `users`
- `sessions`
- `app_state`
- `audit_log`

## Important

Do not use `crm/v7.html` as the production entry URL. The production entry is `crm/index.html` -> `crm/app.html`. The middleware still requires a valid server session for the underlying CRM assets.
