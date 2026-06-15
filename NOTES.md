# KnockTrakr — Security & Tech Debt Notes

## Known items — do NOT change without a dedicated task

### 1. JWT stored in localStorage
**Current state:** JWTs (7-day expiry) are stored in `localStorage` via `AuthContext`.
**Risk:** Vulnerable to XSS attacks that can steal the token.
**Future fix:** Move to `httpOnly` cookies (server sets `Set-Cookie`, client never touches the token directly). Requires auth middleware changes on both server and client.
**Priority:** Medium — low XSS surface right now, but should be done before any public launch.

### 2. Multi-tenant isolation — one gap found
**All routes audited** — every data query filters by `req.user.companyId`. One gap:

**`PUT /api/knocktrakr/neighborhoods/:id/assign`**
The route verifies the neighborhood belongs to the requesting manager's company (correct), but it does NOT verify that the `repIds` in the request body belong to the same company. A manager could assign a rep from a different company to their neighborhood, and that rep would see the neighborhood via `GET /neighborhoods/mine`.

**Fix:** Add a company check before inserting assignments:
```sql
SELECT id FROM users WHERE id = ANY($1::int[]) AND company_id = $2 AND role = 'rep'
```
Use only the returned IDs (those belonging to the correct company) for the insert.
**Priority:** Low right now (no cross-company data is exposed beyond neighborhood names), but fix before scaling.

### 3. Email FROM address pending
`server/services/email.js` — FROM is currently `onboarding@resend.dev` (Resend sandbox, only sends to verified recipient addresses). To send to any address, verify `mail.knocktrakr.com` as a sending domain in Resend, add the DNS TXT records on Porkbun, then update FROM to `KnockTrakr <noreply@mail.knocktrakr.com>`.

### 4. Railway env vars to set once app.knocktrakr.com DNS is live
```
APP_URL=https://app.knocktrakr.com
ALLOWED_ORIGIN=https://app.knocktrakr.com
```
