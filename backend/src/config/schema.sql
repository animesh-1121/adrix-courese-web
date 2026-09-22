-- Database Schema for Nursing Level Up Admin System

-- Users table (extends existing concept)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id VARCHAR(255) UNIQUE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  password_hash TEXT,
  role VARCHAR(50) DEFAULT 'STUDENT' CHECK (role IN ('STUDENT', 'ADMIN')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  last_activity TIMESTAMP
);

-- Test Series table
CREATE TABLE IF NOT EXISTS test_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL, -- in minutes
  is_free BOOLEAN DEFAULT true,
  price DECIMAL(10, 2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'INR',
  status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  question_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id)
);

-- Documents table
DO $$ BEGIN
  CREATE TYPE document_file_type AS ENUM ('PDF', 'DOCX', 'HTML');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE document_status AS ENUM (
    'UPLOADED', 'EXTRACTING', 'EXTRACTED', 'EXTRACT_FAILED',
    'PARSING', 'PARSED', 'PARSE_FAILED', 'APPROVED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_series_id UUID REFERENCES test_series(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  original_filename TEXT NOT NULL,
  file_type document_file_type NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  storage_key TEXT NOT NULL,
  storage_url TEXT,
  extracted_text TEXT,
  status document_status NOT NULL DEFAULT 'UPLOADED',
  question_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_series_id UUID REFERENCES test_series(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option VARCHAR(1) NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
  explanation TEXT,
  order_number INTEGER DEFAULT 0,
  source_document_id UUID REFERENCES documents(id),
  review_status VARCHAR(50) DEFAULT 'APPROVED' CHECK (review_status IN ('MANUAL', 'PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Test Attempts table
CREATE TABLE IF NOT EXISTS attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  test_series_id UUID NOT NULL REFERENCES test_series(id),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP,
  score INTEGER,
  total_questions INTEGER,
  correct_answers INTEGER,
  incorrect_answers INTEGER,
  unanswered INTEGER,
  time_taken INTEGER, -- in seconds
  status VARCHAR(50) DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'ABANDONED'))
);

-- User Answers table (detailed answer tracking)
CREATE TABLE IF NOT EXISTS user_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id),
  selected_answer VARCHAR(1) CHECK (selected_answer IN ('A', 'B', 'C', 'D')),
  is_correct BOOLEAN,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password Resets table
CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  test_series_id UUID NOT NULL REFERENCES test_series(id),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  provider VARCHAR(50), -- 'RAZORPAY', 'STRIPE'
  payment_id VARCHAR(255),
  order_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_test_series_status ON test_series(status);
CREATE INDEX IF NOT EXISTS idx_test_series_created_by ON test_series(created_by);
CREATE INDEX IF NOT EXISTS idx_questions_test_series ON questions(test_series_id);
CREATE INDEX IF NOT EXISTS idx_questions_source_document_id ON questions(source_document_id);
CREATE INDEX IF NOT EXISTS idx_questions_review_status ON questions(review_status);
CREATE INDEX IF NOT EXISTS idx_documents_test_series_id ON documents(test_series_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_test_series ON attempts(test_series_id);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON attempts(status);
CREATE INDEX IF NOT EXISTS idx_user_answers_attempt ON user_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_test_series ON purchases(test_series_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_series_updated_at BEFORE UPDATE ON test_series
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON purchases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
