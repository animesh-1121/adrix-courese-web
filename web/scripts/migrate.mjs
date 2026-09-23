// Usage:
//   node scripts/migrate.mjs            apply db/schema.sql (idempotent)
//   node scripts/migrate.mjs --seed     apply schema, then load development seed data
//   node scripts/migrate.mjs --reset    DROP everything in the public schema first (dev only)
//   node scripts/migrate.mjs --admin you@gmail.com   provision/promote an admin account (PRD §28)
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import * as seed from './seed-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env.local'), quiet: true, override: true });
dotenv.config({ path: path.join(root, '.env'), quiet: true, override: true });

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const adminEmail = args.includes('--admin') ? args[args.indexOf('--admin') + 1] : null;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  if (flag('--reset')) {
    if (process.env.NODE_ENV === 'production') throw new Error('Refusing to --reset with NODE_ENV=production');
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    console.log('✓ public schema dropped and recreated');
  }

  await client.query(await readFile(path.join(root, 'db', 'schema.sql'), 'utf8'));
  console.log('✓ schema applied');

  if (flag('--seed')) {
    await runSeed(client);
    console.log('✓ seed data loaded');
  }

  if (adminEmail) {
    const { rows } = await client.query(
      `INSERT INTO users (name, email, role) VALUES ($1, $2, 'ADMIN')
       ON CONFLICT (email) DO UPDATE SET role = 'ADMIN'
       RETURNING id, email, role`,
      [adminEmail.split('@')[0], adminEmail],
    );
    await client.query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, metadata)
       VALUES ('ADMIN_PROVISIONED', 'user', $1, $2)`,
      [rows[0].id, { via: 'cli' }],
    );
    console.log(`✓ ${rows[0].email} is now ADMIN (links to Google on first sign-in)`);
  }
} finally {
  await client.end();
}

async function runSeed(db) {
  await db.query('BEGIN');
  try {
    for (const u of seed.users) {
      await db.query(
        `INSERT INTO users (id, name, email, phone, role, last_login_at)
         VALUES ($1, $2, $3, $4, $5, now() - interval '1 day')
         ON CONFLICT (id) DO NOTHING`,
        [u.id, u.name, u.email, u.phone, u.role ?? 'STUDENT'],
      );
    }

    for (const s of seed.series) {
      await db.query(
        `INSERT INTO test_series (id, title, description, price, currency, is_free, duration_minutes,
                                  status, instructions, created_by, published_at)
         VALUES ($1,$2,$3,$4,'INR',$5,$6,$7::test_status,$8,$9, CASE WHEN $7::test_status = 'PUBLISHED' THEN now() END)
         ON CONFLICT (id) DO NOTHING`,
        [s.id, s.title, s.description, s.price, s.is_free, s.duration_minutes, s.status, s.instructions, seed.ADMIN_ID],
      );
    }

    const questionIds = {};
    for (const [seriesId, list] of Object.entries(seed.questions)) {
      questionIds[seriesId] = [];
      for (const [i, q] of list.entries()) {
        const { rows } = await db.query(
          `INSERT INTO questions (test_series_id, question_text, option_a, option_b, option_c, option_d,
                                  correct_answer, explanation, question_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [seriesId, q[0], q[1], q[2], q[3], q[4], q[5], q[6], i + 1],
        );
        questionIds[seriesId].push(rows[0].id);
      }
    }

    for (const [d, docId] of seed.DOCUMENT_IDS.entries()) {
      const fileType = d === 0 ? 'PDF' : 'DOCX';
      const filename = d === 0 ? 'antenatal-care-notes.pdf' : 'newborn-care-notes.docx';
      await db.query(
        `INSERT INTO documents (id, test_series_id, uploaded_by, original_filename, file_type, mime_type,
                                size_bytes, storage_key, status, ocr_provider, ai_provider)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'GENERATED',$9,'gemini')`,
        [docId, seed.SERIES.obg, seed.ADMIN_ID, filename, fileType,
          fileType === 'PDF' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          48213, `documents/${docId}/${filename}`, fileType === 'PDF' ? 'tesseract' : null],
      );
      for (const [i, q] of seed.aiDrafts[d].entries()) {
        await db.query(
          `INSERT INTO questions (test_series_id, question_text, option_a, option_b, option_c, option_d,
                                  correct_answer, explanation, question_order, source, source_document_id, review_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'AI_GENERATED',$10,'PENDING_REVIEW')`,
          [seed.SERIES.obg, q[0], q[1], q[2], q[3], q[4], q[5], q[6], 1000 + d * 100 + i, docId],
        );
      }
    }

    const priceOf = Object.fromEntries(seed.series.map((s) => [s.id, s.price]));
    for (const p of seed.purchases) {
      await db.query(
        `INSERT INTO purchases (user_id, test_series_id, amount, currency, provider, order_id, payment_id, status)
         VALUES ($1,$2,$3,'INR','RAZORPAY',$4,$5,$6)`,
        [seed.STUDENT_IDS[p.user], p.series, priceOf[p.series], p.order, p.payment, p.status],
      );
    }

    for (const a of seed.attempts) {
      const qids = questionIds[a.series];
      const correctKey = seed.questions[a.series].map((q) => q[5]);
      if (a.inProgress) {
        await db.query(
          `INSERT INTO attempts (user_id, test_series_id, total_questions, question_ids, started_at)
           VALUES ($1,$2,$3,$4, now() - interval '5 minutes')`,
          [seed.STUDENT_IDS[a.user], a.series, qids.length, qids],
        );
        continue;
      }
      let correct = 0, incorrect = 0, unanswered = 0;
      a.answers.forEach((ans, i) => {
        if (ans === null) unanswered++;
        else if (ans === correctKey[i]) correct++;
        else incorrect++;
      });
      const pct = Math.round((correct / qids.length) * 10000) / 100;
      const { rows } = await db.query(
        `INSERT INTO attempts (user_id, test_series_id, started_at, submitted_at, score, total_questions,
                               correct_answers, incorrect_answers, unanswered, percentage, time_taken_seconds,
                               status, question_ids)
         VALUES ($1,$2, now() - make_interval(days => $3) - make_interval(secs => $4),
                 now() - make_interval(days => $3), $5,$6,$5,$7,$8,$9,$4,'COMPLETED',$10)
         RETURNING id`,
        [seed.STUDENT_IDS[a.user], a.series, a.daysAgo, a.seconds, correct, qids.length, incorrect, unanswered, pct, qids],
      );
      for (const [i, ans] of a.answers.entries()) {
        await db.query(
          `INSERT INTO user_answers (attempt_id, question_id, selected_answer, is_correct) VALUES ($1,$2,$3,$4)`,
          [rows[0].id, qids[i], ans, ans === null ? null : ans === correctKey[i]],
        );
      }
    }
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}
