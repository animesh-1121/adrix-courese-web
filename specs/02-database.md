# Nursing Level Up — Database Document

**Engine:** PostgreSQL, hosted on **Neon** (serverless Postgres).
**Note:** Neon stores relational data only. Files (PDF/DOCX/HTML uploads) live in Cloudflare R2 (S3-compatible object storage); Postgres stores only the file's metadata and storage key (see `documents` table, §7). See Architecture doc §6 for the reasoning.

The database is the single source of truth for every fact the platform cares about: identity, roles, content, purchases, attempts, scores, and now — uploaded documents and AI-generated question drafts.

---

## 1. Conventions

- Every table has `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` (requires `pgcrypto` extension) unless noted.
- Every table has `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`; mutable tables also have `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` maintained by a trigger.
- Enums are implemented as Postgres `ENUM` types for integrity (not free-text columns).
- All foreign keys use `ON DELETE RESTRICT` by default so historical data (purchases, attempts) can never be silently destroyed by deleting a parent row; exceptions are called out explicitly.

---

## 2. `users`

```sql
CREATE TYPE user_role AS ENUM ('STUDENT', 'ADMIN');

CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id      TEXT UNIQUE,               -- null only pre-first-login edge cases; normally always set
  name           TEXT NOT NULL,
  email          CITEXT NOT NULL UNIQUE,    -- CITEXT = case-insensitive unique emails
  phone          TEXT,                      -- nullable until Complete Profile step
  role           user_role NOT NULL DEFAULT 'STUDENT',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at  TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_google_id ON users (google_id);
CREATE INDEX idx_users_role ON users (role);
```

- `role` is **never** writable via any student-facing API. Only a seed script or a direct, audited admin operation changes it (Architecture doc §5, Backend doc §3).
- Phone format validated at the application layer (Backend doc §validation) — kept as `TEXT` in the DB since formats vary by locale, with a `CHECK` constraint for a basic sanity pattern:
```sql
ALTER TABLE users ADD CONSTRAINT chk_phone_format
  CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{7,15}$');
```

---

## 3. `test_series`

```sql
CREATE TYPE test_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE test_series (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  description       TEXT,
  price             NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency          TEXT NOT NULL DEFAULT 'INR',
  is_free           BOOLEAN NOT NULL DEFAULT true,
  duration_minutes  INTEGER NOT NULL CHECK (duration_minutes > 0),
  status            test_status NOT NULL DEFAULT 'DRAFT',
  instructions      TEXT,
  created_by        UUID REFERENCES users(id),   -- admin who created it
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at      TIMESTAMPTZ
);

CREATE INDEX idx_test_series_status ON test_series (status);
CHECK (NOT is_free OR price = 0)  -- free tests must be priced 0 (add as table CHECK)
```

- `question_count` is deliberately **not** a stored column — it's derived at query time (`SELECT COUNT(*) FROM questions WHERE test_series_id = ... AND review_status = 'APPROVED'`) so it can never drift from reality, per your PRD §6.6.

---

## 4. `questions`

```sql
CREATE TYPE answer_option AS ENUM ('A', 'B', 'C', 'D');
CREATE TYPE question_review_status AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE question_source AS ENUM ('MANUAL', 'AI_GENERATED');

CREATE TABLE questions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_series_id      UUID NOT NULL REFERENCES test_series(id) ON DELETE CASCADE,
  question_text       TEXT NOT NULL,
  option_a            TEXT NOT NULL,
  option_b            TEXT NOT NULL,
  option_c            TEXT NOT NULL,
  option_d            TEXT NOT NULL,
  correct_answer      answer_option NOT NULL,
  explanation         TEXT,
  question_order      INTEGER NOT NULL,
  source              question_source NOT NULL DEFAULT 'MANUAL',
  source_document_id  UUID REFERENCES documents(id),   -- null for MANUAL questions
  review_status       question_review_status NOT NULL DEFAULT 'APPROVED', -- MANUAL defaults APPROVED; AI_GENERATED defaults PENDING_REVIEW at insert time
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (test_series_id, question_order)
);

CREATE INDEX idx_questions_test_series_id ON questions (test_series_id);
CREATE INDEX idx_questions_review_status ON questions (review_status);
```

- `correct_answer` and `explanation` are **never** selected by any student-facing pre-submission query (enforced at the service layer — see Backend doc). This table can technically be queried carelessly, so the discipline lives in `lib/server/services/testService.ts`'s column allow-list, not in the schema itself.
- Only `review_status = 'APPROVED'` questions count toward `question_count` and are eligible to be served in a test attempt — this is what makes the AI-import review step safe: nothing an AI generates reaches a student until an admin approves it.
- `ON DELETE CASCADE` here is intentional: deleting a test series' questions (not the series itself) is a routine admin edit; the series itself uses `RESTRICT` elsewhere via `attempts`/`purchases`.

Note: `questions.source_document_id` forward-references `documents`, defined in §7 — in the actual `schema.sql` file, create `documents` before `questions`, or add this FK via `ALTER TABLE` after both tables exist.

---

## 5. `purchases`

```sql
CREATE TYPE payment_provider AS ENUM ('RAZORPAY', 'STRIPE');
CREATE TYPE purchase_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED');

CREATE TABLE purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  test_series_id  UUID NOT NULL REFERENCES test_series(id) ON DELETE RESTRICT,
  amount          NUMERIC(10,2) NOT NULL,   -- amount actually charged; frozen at purchase time
  currency        TEXT NOT NULL DEFAULT 'INR',
  provider        payment_provider NOT NULL DEFAULT 'RAZORPAY',
  order_id        TEXT NOT NULL,             -- provider's order id
  payment_id      TEXT,                      -- provider's payment id, set on success
  status          purchase_status NOT NULL DEFAULT 'PENDING',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchases_user_id ON purchases (user_id);
CREATE INDEX idx_purchases_test_series_id ON purchases (test_series_id);
CREATE INDEX idx_purchases_status ON purchases (status);
CREATE UNIQUE INDEX uq_purchases_order_id ON purchases (order_id);
```

- `amount` is copied from `test_series.price` **at purchase creation time** and never recalculated — this is what makes "changing price should not alter historical purchases" (your PRD §6.7) true by construction.
- Access = `EXISTS (SELECT 1 FROM purchases WHERE user_id = :u AND test_series_id = :t AND status = 'SUCCESS')`. This exact query is the only thing allowed to grant paid access (Backend doc §5).

---

## 6. `attempts` and `user_answers`

```sql
CREATE TYPE attempt_status AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

CREATE TABLE attempts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  test_series_id      UUID NOT NULL REFERENCES test_series(id) ON DELETE RESTRICT,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at        TIMESTAMPTZ,
  score               INTEGER,
  total_questions     INTEGER NOT NULL,
  correct_answers     INTEGER,
  incorrect_answers   INTEGER,
  unanswered          INTEGER,
  percentage          NUMERIC(5,2),
  time_taken_seconds  INTEGER,
  status              attempt_status NOT NULL DEFAULT 'IN_PROGRESS'
);

CREATE INDEX idx_attempts_user_id ON attempts (user_id);
CREATE INDEX idx_attempts_test_series_id ON attempts (test_series_id);
CREATE INDEX idx_attempts_status ON attempts (status);

CREATE TABLE user_answers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id       UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id      UUID NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  selected_answer  answer_option,          -- null = unanswered
  is_correct       BOOLEAN,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);

CREATE INDEX idx_user_answers_attempt_id ON user_answers (attempt_id);
```

- All scoring columns (`score`, `is_correct`, `percentage`, etc.) are written **only** by the scoring service inside `POST /api/tests/:id/submit`, never accepted as request input.
- `user_answers` cascades on `attempt_id` (deleting an attempt is not a normal operation but keeps referential integrity simple); it restricts on `question_id` so a question can't be deleted out from under historical answer records — admins archive test series instead of deleting questions with existing attempts.

---

## 7. `documents` (new — uploaded PDF/DOCX/HTML for AI import)

```sql
CREATE TYPE document_file_type AS ENUM ('PDF', 'DOCX', 'HTML');
CREATE TYPE document_status AS ENUM (
  'UPLOADED', 'EXTRACTING', 'EXTRACTED', 'EXTRACT_FAILED',
  'GENERATING', 'GENERATED', 'GENERATE_FAILED', 'APPROVED'
);

CREATE TABLE documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_series_id   UUID REFERENCES test_series(id) ON DELETE SET NULL, -- nullable: doc can be uploaded before a series exists, then linked
  uploaded_by      UUID NOT NULL REFERENCES users(id),                 -- admin
  original_filename TEXT NOT NULL,
  file_type        document_file_type NOT NULL,
  mime_type        TEXT NOT NULL,
  size_bytes        INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 26214400), -- 25MB cap, enforced app-side too
  storage_key       TEXT NOT NULL,   -- R2 object key, e.g. documents/{id}/{filename}
  storage_url       TEXT,            -- signed/public URL, generated on demand — not required to persist
  status            document_status NOT NULL DEFAULT 'UPLOADED',
  extracted_text_key TEXT,           -- R2 key for the extracted plain text (kept out of Postgres row size)
  ocr_provider      TEXT,            -- 'tesseract' | 'ocrspace' — recorded for traceability
  ai_provider       TEXT,            -- 'gemini' | 'groq' — recorded for traceability
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_test_series_id ON documents (test_series_id);
CREATE INDEX idx_documents_status ON documents (status);
CREATE INDEX idx_documents_uploaded_by ON documents (uploaded_by);
```

- The actual file bytes and extracted text live in R2 (object storage), **not** in Postgres — keeps row sizes small and Neon storage usage/costs low. Only keys/URLs are stored here.
- `status` tracks the full pipeline described in Architecture doc §7 so the admin UI can poll `GET /api/admin/documents/:id` and show progress (Uploaded → Extracting → Extracted → Generating → Generated → Approved).
- When an admin approves generated questions (`POST /api/admin/documents/:id/approve`), the linked `questions` rows flip from `review_status = 'PENDING_REVIEW'` to `'APPROVED'`, and `documents.status` becomes `'APPROVED'`.

---

## 8. `platform_settings` (new — admin-selectable OCR/AI provider)

```sql
CREATE TABLE platform_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_by  UUID REFERENCES users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Seeded rows:

| key | value (default) | allowed values |
|---|---|---|
| `ocr_provider` | `tesseract` | `tesseract`, `ocrspace` |
| `ai_provider` | `gemini` | `gemini`, `groq` |
| `mcq_default_count` | `20` | positive integer, editable per-import too |

Read by `lib/server/ocr.ts` / `lib/server/ai.ts` at request time (Architecture doc §7); changing a row takes effect immediately, no redeploy.

---

## 9. `audit_logs` (recommended — admin action trail)

```sql
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL REFERENCES users(id),
  action      TEXT NOT NULL,        -- e.g. TEST_PUBLISHED, QUESTION_IMPORTED, DOCUMENT_APPROVED
  entity_type TEXT NOT NULL,        -- e.g. 'test_series', 'document', 'user'
  entity_id   UUID NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_admin_id ON audit_logs (admin_id);
```

Written from the service layer, not the route handler, so every mutation path (including future ones) logs consistently.

---

## 10. NextAuth session storage

Using the **JWT session strategy** (recommended, matches serverless Next.js best), NextAuth does **not** need `accounts`/`sessions`/`verification_tokens` tables — session state lives in a signed cookie, not Postgres. Only `users` is touched (via NextAuth's callbacks, custom-written against this schema rather than the default Prisma adapter, since the schema here is hand-rolled). If you later prefer database sessions (e.g. to force-revoke a session server-side), add the standard Auth.js adapter tables at that point — not required for v1.

---

## 11. Entity relationship summary

```
users ──< purchases >── test_series ──< questions ──< user_answers >── attempts >── users
  │                            │
  │                            └──< documents (source of AI-generated questions)
  │
  └──< audit_logs (as admin_id)
```

---

## 12. Indexing checklist (from your PRD §29, confirmed present above)

```
users.email                    ✓ (unique index, CITEXT)
users.google_id                ✓
users.role                     ✓
test_series.status             ✓
questions.test_series_id       ✓
questions.review_status        ✓ (new, needed for the AI pipeline)
purchases.user_id              ✓
purchases.test_series_id       ✓
purchases.status               ✓
attempts.user_id               ✓
attempts.test_series_id        ✓
attempts.status                ✓
user_answers.attempt_id        ✓
documents.test_series_id       ✓ (new)
documents.status                ✓ (new)
audit_logs.entity_type+id      ✓ (new)
```

---

## 13. Seed data (dev environment)

Per your PRD §36, plus new tables:

```
1 Admin
5 Students
5 Test Series (mix of free/paid, mix of DRAFT/PUBLISHED)
25 Questions (MANUAL source, APPROVED)
2 sample Documents (one PDF, one DOCX) with fabricated extracted text and 5 AI_GENERATED / PENDING_REVIEW questions each, to exercise the review UI without needing live OCR/AI calls in dev
Sample Purchases (mix of statuses)
Sample Attempts (mix of statuses)
platform_settings seeded with the defaults from §8
```

All seed data clearly fictional (e.g. `student1@example.test`), never real personal data.
