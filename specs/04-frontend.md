# Nursing Level Up — Frontend Document

**Stack:** Next.js (App Router) + React + TypeScript + Tailwind CSS.
**Data access:** Server Components fetch directly from `lib/server/services/*` (same process, no network hop) for initial page loads; Client Components call `/api/*` Route Handlers via `fetch()` for interactive actions (starting a test, submitting answers, uploading a document, etc.).

The frontend is a **pure presentation layer**. It renders what the backend returns and never invents authentication, role, purchase, or scoring state on its own (Architecture doc §3).

---

## 1. Folder structure

```
app/
├── layout.tsx                      # root layout, session provider, theme
├── page.tsx                        # landing page
├── login/page.tsx
├── complete-profile/page.tsx
│
├── test-series/
│   ├── page.tsx                    # catalog (Server Component, published only)
│   └── [id]/page.tsx               # detail page
│
├── unlock/[id]/page.tsx            # Razorpay checkout trigger
├── dashboard/page.tsx
├── profile/page.tsx
├── tests/[id]/page.tsx             # test-taking UI (Client Component, timed)
├── results/[id]/page.tsx
│
└── admin/
    ├── login/page.tsx
    ├── page.tsx                    # admin dashboard
    ├── users/page.tsx
    ├── users/[id]/page.tsx
    ├── test-series/page.tsx
    ├── test-series/create/page.tsx
    ├── test-series/[id]/page.tsx
    ├── test-series/[id]/edit/page.tsx
    ├── test-series/[id]/questions/page.tsx
    ├── test-series/[id]/import/page.tsx   # NEW — PDF/DOCX/HTML upload → AI review UI
    ├── purchases/page.tsx
    ├── attempts/page.tsx
    ├── attempts/[id]/page.tsx
    └── settings/page.tsx                  # NEW — OCR/AI provider selection

components/
├── navigation/{Header, AdminSidebar, UserMenu}.tsx
├── test-series/{TestSeriesCard, AccessBadge, PriceTag}.tsx
├── test/{Timer, QuestionNavigator, QuestionCard, OptionButton, SubmitDialog}.tsx
├── results/{ScoreSummary, QuestionReview}.tsx
├── dashboard/{ProfileSummary, ActivityStats, PurchasedList, RecentAttempts}.tsx
├── admin/
│   ├── {DataTable, StatusBadge, ConfirmDialog, StatCard}.tsx
│   └── import/
│       ├── DocumentDropzone.tsx     # NEW — drag/drop, accepts .pdf/.docx/.html only
│       ├── PipelineStatus.tsx       # NEW — Uploaded→Extracting→Extracted→Generating→Generated→Approved
│       ├── QuestionReviewList.tsx   # NEW — editable list of AI-drafted questions
│       └── ProviderSelect.tsx       # NEW — OCR/AI provider dropdown (reads/writes settings)
└── ui/{Button, Input, Select, Card, Badge, Spinner, Modal}.tsx

lib/
├── api.ts              # typed fetch wrapper, attaches credentials, parses the {success,data|error} envelope
├── auth.ts             # client-side session helpers (wraps next-auth/react)
├── permissions.ts       # UI-only helpers like canSeeAdminNav(role) — never the actual authorization
└── validation.ts        # zod schemas shared with backend for client-side pre-validation

hooks/
├── useAuth.ts           # wraps useSession()
├── useUser.ts           # fetches /api/me
├── useDocumentImport.ts # NEW — polls document status during extract/generate
└── useTimer.ts          # test countdown

types/
├── user.ts, testSeries.ts, question.ts, purchase.ts, attempt.ts
└── document.ts          # NEW
```

---

## 2. Header / navigation (per your PRD §5.1)

Rendered from a Server Component that reads the session:

- **Guest:** Logo · Test Series · Login
- **Student:** Logo · Test Series · Dashboard · Profile menu
- **Admin:** same as student on the public site (admin nav does **not** appear publicly — admin reaches `/admin` directly, per your PRD)

The nav never guesses role from `localStorage`; it reads `session.user.role` from `useSession()` / the server session, which itself is only ever set by the backend's JWT callback (Backend doc §3).

---

## 3. Landing page `/`

Sections exactly as specified in your PRD §5.1: Header, Hero ("Explore Test Series" primary CTA, "Try Free Test" secondary), Free test-series section, Paid test-series section, Interactive sample MCQ (a self-contained, client-only demo question with no backend calls — clearly non-scored), How it works, Creator section, Footer.

---

## 4. Login `/login`

Single button: **Continue with Google**, calling `signIn('google')` from `next-auth/react`. No password field, no email/password form — Google is the only method per your PRD. Redirect target after sign-in is resolved server-side (phone missing → `/complete-profile`, else → `/dashboard` or the originally-requested page).

---

## 5. Complete Profile `/complete-profile`

- Name/email rendered **read-only**, sourced from `session.user` (Google-verified, not editable here).
- Phone input with client-side format validation (`lib/validation.ts`), submitted via `PUT /api/me/profile`. Server re-validates (Backend doc §validation) — the client check is UX only.

---

## 6. Test Series catalog `/test-series`

Server Component calling `testSeriesService.listPublished()` directly (or `GET /api/test-series` if you split deployments). Each `TestSeriesCard` computes its displayed state **from data returned by the backend**, never invented client-side:

```
FREE               → is_free = true
LOGIN REQUIRED      → is_free = true  && !session
PURCHASE REQUIRED   → is_free = false && session && !hasPurchased
PURCHASED           → is_free = false && session &&  hasPurchased
```

`hasPurchased` comes from the backend response (`GET /api/test-series` includes `viewerHasAccess` computed server-side per the authenticated viewer) — the card never computes purchase state from anything stored client-side.

---

## 7. Test Series detail `/test-series/[id]`

CTA logic (your PRD §5.5), driven entirely by server-supplied `{ isAuthenticated, isFree, hasAccess }`:

| State | CTA |
|---|---|
| Guest + free | "Login to Start" → `/login?next=/tests/[id]` |
| Guest + paid | "Login to Unlock" → `/login?next=/unlock/[id]` |
| Student + free | "Start Test" → `/tests/[id]` |
| Student + paid, not purchased | "Unlock for ₹199" → `/unlock/[id]` |
| Student + paid, purchased | "Start Test" → `/tests/[id]` |

---

## 8. Unlock `/unlock/[id]`

Client Component: calls `POST /api/purchases/create` then `POST /api/payments/razorpay/order`, opens Razorpay Checkout with the returned `order_id`. On Checkout success, calls `POST /api/payments/razorpay/verify` — **only** a `success: true` response from that call (i.e., backend-verified signature) updates the UI to "Access granted"; the Razorpay client-side callback alone never does (Backend doc §6, PRD §39 anti-pattern honored).

---

## 9. Dashboard `/dashboard`

Server Component composing `ProfileSummary`, `ActivityStats`, `PurchasedList`, `RecentAttempts` — each fed by `GET /api/me`, `/api/me/purchases`, `/api/me/attempts`, `/api/me/progress` respectively (or direct service calls in the single-deploy model). No client-side computation of scores/averages beyond simple display formatting of numbers the backend already computed.

---

## 10. Test-taking UI `/tests/[id]`

Client Component (needs local timer/navigation state):

1. On mount: `POST /api/tests/[id]/start` → receives `{ attemptId, questions }` where each question has **no `correct_answer` field at all** (not hidden — absent).
2. `Timer` counts down from `duration_minutes`; auto-submits on expiry.
3. `QuestionNavigator` + `QuestionCard` + `OptionButton` manage local answer state (`Map<questionId, selectedOption>`), persisted only in React state / optionally `sessionStorage` for resilience against accidental refresh — never treated as the scoring source.
4. `SubmitDialog` confirms, then `POST /api/tests/[id]/submit` with `{ attemptId, answers }`. The response (already scored server-side) drives the redirect to `/results/[id]`.

The frontend **cannot** show a running "correct/incorrect" indicator during the test, because it never has the answer key to check against.

---

## 11. Results `/results/[id]`

Server Component; backend enforces ownership (Backend doc §4) so a student requesting someone else's result ID gets a 403 before any data reaches the page. Displays score, totals, percentage, and (subject to your product decision) a question-by-question review with `selected_answer` vs `correct_answer`, only ever returned by the backend **after** the attempt is `COMPLETED`.

---

## 12. Profile `/profile`

Name/email read-only (Google-managed), phone editable via `PUT /api/me/profile`.

---

## 13. Admin shell `/admin/*`

`AdminSidebar`: Dashboard · Users · Test Series · Purchases · Attempts · Settings · Logout. Every `/admin/*` page is a Server Component that calls `requireAdmin()`-equivalent (redirects to `/admin/login` or 403 page if the session role isn't `ADMIN`) before rendering anything — mirrors the backend guard so an unauthorized user never even sees the shell flash.

---

## 14. Admin — Document Import UI `/admin/test-series/[id]/import` (new feature)

This is the UI for the PDF/DOCX/HTML → auto-MCQ pipeline (Architecture doc §7, Backend doc §7).

**Step 1 — Upload**
`DocumentDropzone` accepts drag/drop or file picker, restricted to `.pdf`, `.docx`, `.html` (enforced via the `accept` attribute **and** re-validated server-side — client-side restriction is UX only). On drop, `POST /api/admin/documents/upload` (multipart). Shows upload progress.

**Step 2 — Pipeline status**
`PipelineStatus` polls `GET /api/admin/documents/[id]` (via `useDocumentImport` hook, ~2s interval) and renders a stepper: `Uploaded → Extracting → Extracted → Generating → Generated`. On `EXTRACT_FAILED` / `GENERATE_FAILED`, shows `error_message` and a "Retry" button that re-calls the relevant `extract`/`generate` endpoint.

**Step 3 — Provider choice**
Before triggering generation, `ProviderSelect` shows the current OCR/AI provider (read from `GET /api/admin/settings`) with a short inline explanation, matching Architecture doc §7:

```
OCR engine:        ( ) Tesseract.js — free, unlimited, self-hosted [default]
                    ( ) OCR.space — free tier, higher accuracy on scans

MCQ generator:      ( ) Gemini Flash — free tier, best quality [default]
                    ( ) Groq (Llama) — free tier, fastest, fallback
```
Changing these calls `PUT /api/admin/settings` — this is a platform-wide default (persisted in `platform_settings`), not a per-file toggle, matching the Database doc §8 design; a future iteration could make it per-document if needed.

**Step 4 — Review**
`QuestionReviewList` shows every `PENDING_REVIEW` question from `GET /api/admin/documents/[id]/preview` in an editable form (question text + 4 options + correct answer radio + explanation), reusing the same field components as manual question entry (`/admin/test-series/[id]/questions`). Admin can edit inline (`PUT /api/admin/questions/[id]`) or reject a single bad question without discarding the batch.

**Step 5 — Approve**
"Approve & Add to Test Series" button calls `POST /api/admin/documents/[id]/approve`. On success, redirects to `/admin/test-series/[id]/questions`, now showing the approved questions alongside any manual ones — no distinction visible to students either way (source is an internal/admin-only field).

---

## 15. Admin — Settings `/admin/settings`

Hosts the same `ProviderSelect` as a persistent page (not just inline during import), plus `mcq_default_count`. Straightforward form bound to `GET/PUT /api/admin/settings`.

---

## 16. UI/UX direction (per your PRD §31–32, unchanged)

- Student site: clean, academic, calm, readable — no glassmorphism/neon/excess gradients. Respect `prefers-reduced-motion`.
- Admin: information-dense tables, filters, status badges, confirmation dialogs before destructive actions (archive test series, reject question, delete document). Desktop-first, responsive as a secondary concern.

---

## 17. Client-side "permissions" are UX only

`lib/permissions.ts` may contain helpers like:

```ts
export function canSeeAdminNav(role?: Role) {
  return role === "ADMIN";
}
```

These exist **only** to hide/show UI affordances. They are explicitly documented as non-authoritative — every real decision (can this user actually load this data, actually perform this action) is re-checked by the backend on every request, per Architecture doc §3–4. No `localStorage.role`, no `?role=ADMIN` query param, no client-computed `isPurchased` — all forbidden per your PRD §39, and nothing in this frontend design relies on them.

---

## 18. Forms & validation

Every form uses a `zod` schema shared from `lib/validation.ts` (same shapes as the backend's request validators) for immediate feedback, but submission always goes through the real API and displays the server's error envelope (`error.code`/`error.message`) if server-side validation disagrees — the client check is a convenience, never the final gate.
