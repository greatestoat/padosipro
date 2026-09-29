# Design notes

## 1. Goals

Build the required flow (Register → Email OTP → Login → Profile → Task selection →
Confirmation → Home) as a native mobile app backed by its own API, with security
and correctness taken seriously at every step, and code that is easy to read and test.

## 2. Architecture

```
Expo app (React Native)
     │  JSON over HTTP, Bearer JWT
     ▼
Express
  routes → middleware (auth, validate) → controllers → services → Prisma → PostgreSQL
                                                         └────→ Nodemailer → Mailpit
  errorHandler (central) ← every layer throws AppError / ZodError
```

| Layer | Rule |
|---|---|
| Routes | Wire a URL to middleware and a controller. Nothing else |
| Middleware | Cross-cutting concerns: JWT auth, Zod validation, error handling |
| Controllers | Read the request, call one service, format the response. No business logic |
| Services | All business rules (OTP, login, task selection). Framework-independent, so they are easy to test |
| Validators | Zod schemas. The single source of truth for input shape and the TypeScript types |

Environment variables are validated once at startup (`config/env.ts`), and the
process exits with a clear message if any is missing or weak.

## 3. Data model

`User` 1—1 `Profile`, `User` 1—N `OtpVerification`, `User` N—N `Task` through `UserTask`.

- `User.email` is unique, so duplicate accounts are impossible even under races.
- `Profile.userId` is unique, which enforces one profile per user and makes saving an upsert.
- `UserTask (userId, taskId)` is unique, so a task cannot be selected twice.
- All foreign keys use `onDelete: Cascade`, so deleting a user leaves no orphans.
- Indexes cover the hot queries: the latest OTP per user, tasks by category, and a user's selections.
- `Task.name` is unique so the seed can be re-run safely.

## 4. Email OTP design

| Requirement | Implementation |
|---|---|
| Exactly 6 digits | `crypto.randomInt(0, 1_000_000)` padded with zeros (cryptographically secure) |
| Valid 10 minutes | `expiresAt` checked on verify |
| Single use | Consumed with `updateMany WHERE used = false`. Only one concurrent request can win |
| Max 5 wrong attempts | Counter incremented atomically **before** comparing, so parallel guesses cannot exceed the limit. The 6th attempt is rejected even with the right code |
| Resend cooldown 30s | Compared against the newest OTP's `createdAt` |
| Store only a hash | Only `codeHash` is stored. No raw-code column exists |
| Never returned by the API | The code exists only in the email body. It is not logged either |
| Newest code wins | Issuing a code invalidates all earlier unused ones |

**Why HMAC instead of a plain hash.** A 6-digit code has only a million possibilities.
A plain SHA-256 of it could be reversed instantly from a leaked database. The code is
stored as `HMAC-SHA256(server secret, userId:code)`. It is still "hash only", but a DB
leak alone is useless, and a code cannot be replayed against another user's row.
Comparison uses `timingSafeEqual`.

**Verify semantics.** Correct code on attempt 5 works. Attempt 6 fails with
`OTP_MAX_ATTEMPTS`, and the user requests a new code.

## 5. Authentication and session

- Passwords are hashed with bcrypt (12 rounds). Registration enforces 8 to 72 characters with at least one letter and one number (72 is bcrypt's byte limit).
- Login returns a signed JWT (`HS256`, algorithm pinned on verify, 1 hour expiry) plus `expiresIn` in seconds.
- Only verified users can log in. The verification check happens **after** the password check, so someone without the password cannot learn whether an email exists or is unverified.
- Unknown email and wrong password return the identical response. A dummy bcrypt comparison keeps their timing similar.
- Resend and verify return generic results for unknown emails, to prevent account enumeration.
- The auth middleware re-checks the user in the database on every request, so deleted or unverified accounts cannot keep using an old token.
- **Logout is client-side.** JWTs are stateless, so the endpoint is authenticated and returns success, and the app deletes its token. The endpoint exists so real revocation can be added without changing the API contract (see limitations).

## 6. API conventions

- One response envelope for success and error, with stable machine-readable `errorCode`s so the app never parses messages.
- Validation failures add an `errors[]` array (`field`, `message`) so forms can show per-field messages. This is a small addition to the required error format.
- Centralised error handling: services throw `AppError`, Zod throws `ZodError`, and one handler maps everything to the envelope. Unexpected errors return a generic 500 in production and never leak internals.
- Input is normalised at the boundary: emails are trimmed and lowercased, and Indian mobile numbers are accepted as `98765 43210` or `+919876543210` and stored as `+919876543210`. Numbers must be `+91` plus exactly 10 digits starting with 6 to 9.
- `PUT /api/user/tasks` replaces the selection inside one transaction (all or nothing) and rejects unknown task ids with a clear error.
- The mobile routing decision uses `profileCompleted` and `hasSelectedTasks`, computed from real data at login instead of stored flags that could go stale.

## 7. Testing strategy

- Real Express, Zod, Prisma, bcrypt and JWT run against a separate `padosipro_test` database. A guard refuses to run against any URL without `_test`.
- Only the email sender is mocked, since the API never returns the OTP. Tests read the code from the mock's arguments.
- Expiry and cooldown are tested by backdating database rows. This is deterministic and needs no sleeping or fake timers.
- Test files run serially because they share a database.

## 8. Infrastructure

Docker Compose runs PostgreSQL 16 and Mailpit (SMTP on 1025, inbox on 8025). Mailpit
catches all OTP emails locally, and nothing is ever sent to a real address. Secrets live
in `.env` (git-ignored), and `.env.example` documents every variable.

## 9. Known limitations and next steps

These were deliberately left out of scope for the assignment:

- **No IP or account rate limiting** on login and register. Per-OTP attempt limits exist, but `express-rate-limit` (or a gateway) should sit in front of a real deployment.
- **No server-side token revocation or refresh tokens.** A stolen token is valid until expiry. A `tokenVersion` column on `User` (checked in the middleware, incremented on logout) would add real revocation.
- **Unverified re-registration overwrites the password** of an unverified account. That is safe because it cannot log in, but a production system might handle it differently.
- **CORS is open.** That is fine for a native app, but should be restricted if a web client is added.
- **Categories are a string column**, not a table. That is enough for four fixed categories. A `Category` model would suit admin-managed categories.
- **Tests cover auth and OTP.** Profile and task endpoints are verified manually and by the walkthrough script, and would be the next tests to add.