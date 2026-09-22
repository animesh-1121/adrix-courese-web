# Nursing Level Up — Backend Document

**Runtime:** Next.js Route Handlers (Node.js runtime, not Edge — needed for DB drivers, file streaming, OCR/AI SDKs) + TypeScript.
**DB access:** `pg` / `postgres` (or `drizzle-orm` / `prisma` — pick one; examples below are driver-agnostic) against Neon.
**Auth:** NextAuth.js (Auth.js v5), Google provider, JWT session.
**Storage:** Cloudflare R2 via `@aws-sdk/client-s3`.
**Payments:** Razorpay Node SDK.

This is the **business/security layer**. Nothing here trusts the client. Every route re-derives truth from Postgres.

---

## 1. Folder structure

```
app/
├── api/
│   ├── auth/[...nextauth]/route.ts        # NextAuth handlers (Google OAuth)
│   ├── me/route.ts                        # GET/PUT own profile
│   ├── me/purchases/route.ts
│   ├── me/attempts/route.ts
│   ├── me/progress/route.ts
│   │
│   ├── test-series/route.ts               # GET public list (published only)
│   ├── test-series/[id]/route.ts          # GET public detail
│   │
│   ├── tests/[id]/start/route.ts          # POST — creates attempt, returns questions w/o answers
│   ├── tests/[id]/submit/route.ts         # POST — server-side scoring
│   ├── results/[id]/route.ts              # GET — own result only (or admin)
│   │
│   ├── purchases/create/route.ts          # POST — creates PENDING purchase
│   ├── purchases/[id]/route.ts            # GET
│   ├── payments/razorpay/order/route.ts   # POST
│   ├── payments/razorpay/verify/route.ts  # POST
│   ├── payments/razorpay/webhook/route.ts # POST (no session — signature verified instead)
│   │
│   └── admin/
│       ├── dashboard/route.ts
│       ├── users/route.ts
│       ├── users/[id]/route.ts
│       ├── test-series/route.ts
│       ├── test-series/[id]/route.ts
│       ├── test-series/[id]/publish/route.ts
│       ├── test-series/[id]/unpublish/route.ts
│       ├── test-series/[id]/archive/route.ts
│       ├── test-series/[id]/questions/route.ts
│       ├── questions/[id]/route.ts
│       ├── documents/upload/route.ts       # NEW — multipart upload → R2
│       ├── documents/[id]/route.ts         # NEW — status/details
│       ├── documents/[id]/extract/route.ts # NEW — trigger text extraction/OCR
│       ├── documents/[id]/generate/route.ts# NEW — trigger AI MCQ generation
│       ├── documents/[id]/preview/route.ts # NEW — list PENDING_REVIEW questions
│       ├── documents/[id]/approve/route.ts # NEW — approve + link to test series
│       ├── purchases/route.ts
│       ├── attempts/route.ts
│       ├── attempts/[id]/route.ts
│       └── settings/route.ts               # NEW — read/write platform_settings
│
├── (student pages...)
└── (admin pages...)

lib/
├── server/
│   ├── db.ts                # Postgres connection pool (Neon, uses @neondatabase/serverless or pg)
│   ├── auth.ts               # NextAuth config, requireUser(), requireAdmin(), requireOwner()
│   ├── storage.ts            # R2 client: uploadFile(), getSignedUrl(), deleteFile()
│   ├── ocr.ts                # extractText(document) — dispatches to tesseract/ocrspace per platform_settings
│   ├── ai.ts                 # generateMcqs(text, count) — dispatches to gemini/groq per platform_settings
│   ├── htmlSanitize.ts       # sanitize-html wrapper for uploaded HTML
│   └── services/
│       ├── authService.ts
│       ├── userService.ts
│       ├── testSeriesService.ts
│       ├── questionService.ts
│       ├── attemptService.ts
│       ├── scoringService.ts
│       ├── purchaseService.ts
│       ├── documentService.ts   # NEW — orchestrates upload → extract → generate → approve
│       └── auditService.ts
├── validation/                  # zod schemas, mirrored client + server side
└── errors.ts                    # ApiError class + standardized error response builder

middleware.ts                    # edge-level redirect guard (UX layer only, see Architecture §4)
```

---

## 2. Standard error envelope (unchanged from your PRD §20)

```json
{
  "success": false,
  "error": { "code": "UNAUTHORIZED", "message": "Authentication required" }
}
```

Implemented once in `lib/errors.ts` as an `ApiError` class; every Route Handler wraps its body in a try/catch that calls `toErrorResponse(err)`. Standard codes: `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `VALIDATION_ERROR` (422), `CONFLICT` (409), `INTERNAL_ERROR` (500).

---

## 3. Authentication (Google OAuth via NextAuth.js)

`lib/server/auth.ts`:

```ts
export const authOptions: NextAuthConfig = {
  providers: [Google({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! })],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account }) {
      // account.provider === 'google'; account.providerAccountId is the verified Google ID
      const existing = await userService.findByGoogleId(account.providerAccountId);
      if (!existing) {
        await userService.createStudent({
          googleId: account.providerAccountId,
          name: user.name!,
          email: user.email!,       // verified by Google, never client-supplied
        });
      } else {
        await userService.touchLastLogin(existing.id);
      }
      return true;
    },
    async jwt({ token, account }) {
      if (account) {
        const dbUser = await userService.findByGoogleId(account.providerAccountId);
        token.userId = dbUser.id;
        token.role = dbUser.role;    // ALWAYS re-read from DB, never from the OAuth token itself
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.role = token.role;
      return session;
    },
  },
};

export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
  return session.user; // { id, role, ... }
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ApiError(403, "FORBIDDEN", "Admin access required");
  return user;
}
```

- New Google users are **always** created with `role: STUDENT`. There is no code path anywhere that accepts a client-supplied `role`.
- `email`/`name`/`googleId` come only from the verified NextAuth `account`/`user` objects (populated from Google's verified token), never from request body fields — closing the exact gap called out in your PRD §26/§27.
- Admin accounts are provisioned only by a seed script or a manual `UPDATE users SET role='ADMIN' WHERE email=...` run by you directly against Neon — never through any API (PRD §28, unchanged).

### Login flow (matches your PRD §5.2 exactly)

```
Login page → signIn('google') → Google consent → NextAuth callback (above)
→ redirect: phone missing? → /complete-profile : /dashboard
```

`phone missing?` check happens in a Server Component on `/dashboard`'s layout (reads `session.user`, queries `users.phone`), not trusted from client state.

---

## 4. RBAC layers (mapped 1:1 to your PRD §18)

| Layer | Where |
|---|---|
| 1. Frontend route protection | `middleware.ts` — redirects, not security |
| 2. Backend authentication | `requireUser()` in every non-public Route Handler |
| 3. Backend authorization (role) | `requireAdmin()` in every `app/api/admin/**` handler |
| 4. Resource ownership | e.g. `results/[id]/route.ts`: `if (attempt.user_id !== user.id && user.role !== 'ADMIN') throw new ApiError(403, ...)` |
| 5. Business rules | `purchaseService.hasAccess(userId, testSeriesId)` — the **only** function allowed to decide paid access |

Example — `GET /api/results/[id]/route.ts`:

```ts
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const attempt = await attemptService.getById(params.id);
  if (!attempt) throw new ApiError(404, "NOT_FOUND", "Result not found");
  if (attempt.user_id !== user.id && user.role !== "ADMIN") {
    throw new ApiError(403, "FORBIDDEN", "Not your result");
  }
  return Response.json({ success: true, data: attempt });
}
```

---

## 5. Test access & scoring (unchanged logic from your PRD §14–15, now as Route Handlers)

`POST /api/tests/[id]/start/route.ts`:
```
requireUser()
→ testSeriesService.getPublished(id) — 404 if not PUBLISHED
→ if not is_free: purchaseService.hasAccess(user.id, id) — 403 "purchase required" if false
→ attemptService.create(user.id, id)
→ questionService.listForAttempt(id)   -- SELECT excludes correct_answer, explanation
→ return { attemptId, questions }
```

`POST /api/tests/[id]/submit/route.ts`:
```
requireUser()
→ attemptService.getOwned(attemptId, user.id) — 403 if not owner, 409 if already COMPLETED
→ load questions.correct_answer from DB (never from request body)
→ scoringService.score(answers, questions) — computes correct/incorrect/unanswered/percentage server-side
→ persist user_answers + update attempts (score, percentage, status=COMPLETED, submitted_at, time_taken_seconds)
→ return result
```

The request body may only contain `{ questionId, selectedAnswer }[]`. Any `score`/`isCorrect`/`percentage` field in the body is ignored entirely — the scoring service never reads those keys.

---

## 6. Payments (Razorpay)

```
POST /api/purchases/create        → creates purchases row, status=PENDING, amount frozen from test_series.price
POST /api/payments/razorpay/order → creates Razorpay order, returns order_id to client for Checkout
POST /api/payments/razorpay/verify→ verifies (order_id + payment_id + razorpay_signature) via HMAC with RAZORPAY_KEY_SECRET
                                     → only on success: purchases.status = 'SUCCESS', payment_id stored
POST /api/payments/razorpay/webhook → durable fallback: Razorpay calls this server-to-server;
                                       verifies webhook signature (RAZORPAY_WEBHOOK_SECRET) independently of the client
```

`hasAccess()` only ever checks `purchases.status = 'SUCCESS'` in Postgres — a client claiming "payment succeeded" without a verified signature never flips that flag (your PRD §16, §39 anti-patterns honored).

---

## 7. Document upload → OCR → AI MCQ generation pipeline (new feature, detailed)

### 7.1 Upload

`POST /api/admin/documents/upload/route.ts` (multipart form-data):
```
requireAdmin()
→ validate: file extension ∈ {.pdf, .docx, .html}, MIME type matches extension, size ≤ 25MB
→ storage.uploadFile(buffer, key) → Cloudflare R2 (lib/server/storage.ts, S3 SDK)
→ INSERT INTO documents (status='UPLOADED', file_type, storage_key, uploaded_by, ...)
→ auditService.log('DOCUMENT_UPLOADED', ...)
→ return document row
```

File is **never executed or rendered** server-side — it is only ever passed to a parser library or streamed to R2 as opaque bytes.

### 7.2 Extraction

`POST /api/admin/documents/[id]/extract/route.ts`:
```
requireAdmin()
→ documents.status = 'EXTRACTING'
→ download file from R2
→ switch(file_type):
    PDF  → try pdf-parse (text layer). If extracted text is empty/near-empty (scanned PDF) → fall back to ocr.ts (Tesseract.js, page-by-page via pdf-to-image + OCR)
    DOCX → mammoth.extractRawText()
    HTML → cheerio.load() → text extraction, then sanitize-html on any content that will ever be re-displayed
→ store extracted text as a new object in R2 (extracted_text_key), NOT in the Postgres row (keeps DB rows small)
→ documents.status = 'EXTRACTED' (or 'EXTRACT_FAILED' with error_message)
```

`lib/server/ocr.ts` reads `platform_settings.ocr_provider` to decide `tesseract` vs `ocrspace` (Architecture doc §7).

### 7.3 AI MCQ generation

`POST /api/admin/documents/[id]/generate/route.ts`:
```
requireAdmin()
→ body: { count?: number }  (defaults to platform_settings.mcq_default_count)
→ documents.status = 'GENERATING'
→ text = fetch extracted_text_key from R2
→ ai.ts::generateMcqs(text, count) — calls Gemini Flash (or Groq per platform_settings) with a
  strict JSON-schema prompt:
    "Return ONLY a JSON array of {question, option_a, option_b, option_c, option_d, correct_answer, explanation}.
     Base every question strictly on the provided nursing text. correct_answer must be one of A/B/C/D."
→ validate the AI response against a zod schema; reject/retry once if malformed
→ INSERT questions with source='AI_GENERATED', review_status='PENDING_REVIEW', source_document_id=id,
  test_series_id = documents.test_series_id (or null if not yet linked to a series)
→ documents.status = 'GENERATED' (or 'GENERATE_FAILED')
```

Nothing generated here is visible to students yet — `review_status = 'PENDING_REVIEW'` questions are excluded from every student-facing query by construction (Database doc §4).

### 7.4 Review & approval

```
GET  /api/admin/documents/[id]/preview   → lists the PENDING_REVIEW questions for admin to read/edit in the UI
PUT  /api/admin/questions/[id]           → admin edits a draft question (same endpoint used for manual questions)
POST /api/admin/documents/[id]/approve   → body: { testSeriesId } (create new or pick existing DRAFT series)
                                            → UPDATE questions SET review_status='APPROVED', test_series_id=:id
                                            → documents.status = 'APPROVED'
                                            → auditService.log('DOCUMENT_APPROVED', ...)
```

Admin can also individually reject a bad draft question (`review_status = 'REJECTED'`, excluded permanently) without discarding the whole batch.

### 7.5 Settings

`GET/PUT /api/admin/settings/route.ts` — reads/writes `platform_settings` rows for `ocr_provider` and `ai_provider` (requires `requireAdmin()`). This is what powers the dropdown described in Architecture doc §7's "Admin-facing provider choice."

---

## 8. Security checklist (mapped to your PRD §19, now Next.js-specific)

- Parameterized queries only — no string-built SQL, whichever driver/ORM is chosen.
- `zod` validates every request body and route param before it reaches a service function.
- Uploaded HTML is parsed for text only via `cheerio`, then passed through `sanitize-html`; it is **never** written into a page as raw HTML, never `dangerouslySetInnerHTML`'d anywhere in the admin preview UI.
- File upload hard limits: extension allow-list, MIME sniff check, 25MB size cap, enforced both client-side (UX) and server-side (authoritative) in the Route Handler.
- Admin routes protected in both `middleware.ts` (UX) and every handler (`requireAdmin()`, authoritative).
- IDOR prevented by the "resource ownership" layer (§4) on every `/api/me/*`, `/api/results/*`, `/api/purchases/*` route.
- Razorpay webhook endpoint verifies the provider's HMAC signature independently — it does not trust `req.body` shape alone.
- Secrets (`DATABASE_URL`, `GOOGLE_CLIENT_SECRET`, `RAZORPAY_KEY_SECRET`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `NEXTAUTH_SECRET`) live only in `.env` / host environment variables, never in Git, never exposed to the client bundle (only `NEXT_PUBLIC_*` vars are).
- Rate limiting recommended on `documents/upload`, `documents/*/generate` (AI calls cost quota) and `payments/*` — a simple token-bucket in `lib/server/rateLimit.ts` keyed by admin/user id, backed by an in-memory map (single-instance) or Upstash Redis free tier if you deploy multi-instance.

---

## 9. Environment variables

```
# Database
DATABASE_URL=

# Auth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Payments
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
# Stripe kept for architectural parity, not required for v1
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Object storage (Cloudflare R2)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

# OCR / AI (free tiers)
GEMINI_API_KEY=
GROQ_API_KEY=
OCRSPACE_API_KEY=       # optional, only if ocr_provider='ocrspace'

# Frontend-exposed (safe only)
NEXT_PUBLIC_APP_URL=
```

None of the non-`NEXT_PUBLIC_*` values are ever imported into a `"use client"` component — enforced by keeping all of them read only inside `lib/server/*` files, which Next.js excludes from the client bundle by virtue of only being imported from Route Handlers / Server Components.

---

## 10. Performance (from your PRD §29, applied to Route Handlers)

- Admin list routes (`/api/admin/users`, `/api/admin/attempts`, `/api/admin/purchases`) paginate via `LIMIT/OFFSET` or keyset pagination — never `SELECT *` unbounded.
- `question_count` and dashboard aggregates computed with a single `GROUP BY`/`COUNT` query, not N+1 per-row lookups.
- Neon's serverless driver (`@neondatabase/serverless`) or a pooled `pg.Pool` — avoid opening a new connection per request in a way that exhausts Neon's connection limit; use Neon's pooled connection string in production.
