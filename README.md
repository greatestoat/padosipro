# PadosiPro (take-home assignment)

A native mobile app with its own backend API, built as a take-home assignment.
[app.padosipro.com](https://app.padosipro.com/) was used only as a design and
functional reference. No WebView, no calls to PadosiPro production APIs, no
copied source code, and test data only.

**User flow:** Register → Email OTP verification → Login → First-login profile →
Task selection → Confirmation → Home showing selected tasks.

## Status

| Part | State |
|---|---|
| Backend API (`backend/`) | Complete, with automated tests |
| Mobile app (`mobile/`) | React Native + Expo + TypeScript (see `mobile/` once added) |

## Stack

- **Backend:** Node.js, TypeScript, Express 4, Prisma 6, PostgreSQL 16, JWT, bcrypt, Nodemailer, Zod
- **Infrastructure:** Docker Compose (PostgreSQL + Mailpit)
- **Tests:** Vitest + Supertest
- **Mobile:** React Native, Expo, TypeScript

## Prerequisites

- Node.js 20 or newer
- Docker with Docker Compose
- `jq` (only for the walkthrough script)

## Quick start (backend)

```bash
# 1. Start PostgreSQL and Mailpit (from the project root)
docker compose up -d

# 2. Install and configure
cd backend
npm install
cp .env.example .env
```

Open `backend/.env` and replace `JWT_SECRET` and `OTP_HMAC_SECRET` with random
values (each at least 32 characters). Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

```bash
# 3. Create tables and seed 24 tasks
npx prisma migrate dev
npx prisma db seed

# 4. Run the API on http://localhost:4000
npm run dev
```

Check it: `curl localhost:4000/api/health`

| Service | URL |
|---|---|
| API | http://localhost:4000/api |
| Mailpit inbox (OTP emails appear here) | http://localhost:8025 |
| Mailpit SMTP | localhost:1025 |
| PostgreSQL | localhost:5432 |

## Environment variables

See `backend/.env.example`. The server validates all of them at startup and
refuses to boot if one is missing or too weak.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 4000 | API port |
| `DATABASE_URL` | none | PostgreSQL connection string |
| `JWT_SECRET` | none | Signs access tokens (min 32 chars) |
| `JWT_EXPIRES_IN` | 1h | Token lifetime |
| `OTP_HMAC_SECRET` | none | Keys the OTP hash (min 32 chars) |
| `OTP_TTL_MINUTES` | 10 | OTP validity |
| `OTP_MAX_ATTEMPTS` | 5 | Wrong attempts allowed per code |
| `OTP_RESEND_COOLDOWN_SECONDS` | 30 | Minimum gap between OTP emails |
| `SMTP_HOST` / `SMTP_PORT` | localhost / 1025 | Mailpit |
| `MAIL_FROM` | PadosiPro <no-reply@padosipro.local> | Sender address |

Only `.env.example` is committed. `.env` is git-ignored.

## API reference

Every response uses one of two shapes:

```json
{ "success": true,  "message": "...", "data": {} }
{ "success": false, "message": "...", "errorCode": "...", "errors": [] }
```

`errors[]` (`{ field, message }`) appears only on `VALIDATION_ERROR`.

| Method | Path | Auth | Body | Purpose |
|---|---|---|---|---|
| GET | `/api/health` | no | none | Liveness and database check |
| POST | `/api/auth/register` | no | `email, password, confirmPassword` | Create account and email an OTP |
| POST | `/api/auth/verify-otp` | no | `email, otp` | Verify email |
| POST | `/api/auth/resend-otp` | no | `email` | Send a fresh OTP |
| POST | `/api/auth/login` | no | `email, password` | Returns JWT (verified users only) |
| POST | `/api/auth/logout` | yes | none | Ends the session (client discards token) |
| GET | `/api/profile` | yes | none | `data.profile` is `null` until saved |
| PUT | `/api/profile` | yes | `name, mobileNumber, address, businessName?` | Create or update profile |
| GET | `/api/tasks` | yes | none | All tasks, optional `?category=Home` |
| GET | `/api/tasks/categories` | yes | none | Category names |
| GET | `/api/user/tasks` | yes | none | The user's selected tasks |
| PUT | `/api/user/tasks` | yes | `taskIds: string[]` | Replace the selection (min 1) |

Authenticated routes need `Authorization: Bearer <token>`.

The login response includes `user.profileCompleted` and `user.hasSelectedTasks`.
The mobile app uses them to decide whether to show Profile, Task selection, or Home.

### Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Body failed Zod validation (see `errors[]`) |
| `INVALID_JSON` | 400 | Malformed JSON body |
| `OTP_INVALID` | 400 | Wrong, used, or superseded code |
| `OTP_EXPIRED` | 400 | Code older than 10 minutes |
| `ALREADY_VERIFIED` | 400 | Email is already verified |
| `INVALID_TASK_IDS` | 400 | A selected task does not exist |
| `UNAUTHORIZED` | 401 | Missing bearer token |
| `INVALID_TOKEN` | 401 | Bad token, or the account no longer exists |
| `TOKEN_EXPIRED` | 401 | JWT expired, so log in again |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password (same response for both) |
| `EMAIL_NOT_VERIFIED` | 403 | Correct password, but the email is unverified |
| `ROUTE_NOT_FOUND` | 404 | Unknown route |
| `EMAIL_ALREADY_REGISTERED` | 409 | A verified account already uses this email |
| `OTP_MAX_ATTEMPTS` | 429 | More than 5 wrong attempts on this code |
| `OTP_RESEND_COOLDOWN` | 429 | Resend requested within 30 seconds |
| `EMAIL_SEND_FAILED` | 502 | SMTP delivery failed |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected error |

## Try the whole flow

With the API running:

```bash
cd backend
bash scripts/walkthrough.sh
```

It registers a throwaway user, reads the OTP from the Mailpit API, verifies,
logs in, saves a profile, selects tasks, and logs out, printing every response.

Manual version (the OTP comes from http://localhost:8025):

```bash
API=localhost:4000/api
H='Content-Type: application/json'

curl -s -X POST $API/auth/register -H "$H" \
  -d '{"email":"me@example.com","password":"Passw0rd123","confirmPassword":"Passw0rd123"}'

curl -s -X POST $API/auth/verify-otp -H "$H" -d '{"email":"me@example.com","otp":"123456"}'

curl -s -X POST $API/auth/login -H "$H" -d '{"email":"me@example.com","password":"Passw0rd123"}'
# copy data.token, then:
TOKEN=...
curl -s -X PUT $API/profile -H "$H" -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test User","mobileNumber":"9876543210","address":"12 Test Street, Hyderabad"}'
curl -s $API/tasks -H "Authorization: Bearer $TOKEN"
curl -s -X PUT $API/user/tasks -H "$H" -H "Authorization: Bearer $TOKEN" \
  -d '{"taskIds":["<id-from-/tasks>"]}'
```

## Tests

```bash
docker compose up -d
docker compose exec postgres psql -U padosipro -d padosipro -c "CREATE DATABASE padosipro_test;"   # once
cd backend
npm test
```

Tests run against the separate `padosipro_test` database (a safety check aborts
if the URL does not contain `_test`), so development data is never touched.
Mailpit is not needed because tests mock the email sender and read the OTP from it.

Covered: OTP generation and hashing, expiry, single use, maximum wrong attempts,
resend cooldown, verified login, unverified-login rejection, incorrect password,
and the full register → verify → login flow.

## Useful commands

| Command (in `backend/`) | Purpose |
|---|---|
| `npm run dev` | API with auto-reload |
| `npm run build` / `npm start` | Compile and run the compiled server |
| `npm test` / `npm run test:watch` | Run tests |
| `npx prisma studio` | Browse the database |
| `npx prisma db seed` | Re-seed tasks (safe to repeat) |
| `docker compose down -v` | Stop containers and delete all local data |

## Project structure

```
padosipro/
├── backend/
│   ├── prisma/          schema, migrations, seed
│   ├── scripts/         walkthrough.sh
│   └── src/
│       ├── config/      env validation, Prisma client, mailer
│       ├── controllers/ HTTP in/out only
│       ├── middleware/  auth, validation, error handling
│       ├── routes/
│       ├── services/    business logic
│       ├── validators/  Zod schemas
│       ├── utils/       AppError, response helpers, OTP, JWT
│       └── tests/
├── mobile/              Expo app
├── docker-compose.yml
├── README.md
└── DESIGN.md            architecture and security decisions
```

## Notes on scope

- The seeded data contains tasks only. There are no seeded users or credentials.
- All secrets in the repo are throwaway local defaults. Real secrets go in `.env`, which is git-ignored.
- See `DESIGN.md` for trade-offs and known limitations.