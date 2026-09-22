-- Seed Data for Nursing Level Up Admin System

-- Admin User
INSERT INTO users (email, name, phone, password_hash, role) VALUES
('admin@nursinglevelup.com', 'Admin User', '+919876543200', '$2b$10$ukitfS9Gve.S6Imyw0ifNOuZSrQ8Sw5ltQGsXsxh0aLKQp4/WJB02', 'ADMIN')
ON CONFLICT (email) DO NOTHING;

-- Student Users
INSERT INTO users (email, name, phone, password_hash, role) VALUES
('student1@example.com', 'Rahul Sharma', '+919876543210', '$2b$10$ukitfS9Gve.S6Imyw0ifNOuZSrQ8Sw5ltQGsXsxh0aLKQp4/WJB02', 'STUDENT'),
('student2@example.com', 'Priya Patel', '+919876543211', '$2b$10$ukitfS9Gve.S6Imyw0ifNOuZSrQ8Sw5ltQGsXsxh0aLKQp4/WJB02', 'STUDENT'),
('student3@example.com', 'Amit Kumar', '+919876543212', '$2b$10$ukitfS9Gve.S6Imyw0ifNOuZSrQ8Sw5ltQGsXsxh0aLKQp4/WJB02', 'STUDENT'),
('student4@example.com', 'Sneha Singh', '+919876543213', '$2b$10$ukitfS9Gve.S6Imyw0ifNOuZSrQ8Sw5ltQGsXsxh0aLKQp4/WJB02', 'STUDENT'),
('student5@example.com', 'Vikram Joshi', '+919876543214', '$2b$10$ukitfS9Gve.S6Imyw0ifNOuZSrQ8Sw5ltQGsXsxh0aLKQp4/WJB02', 'STUDENT')
ON CONFLICT (email) DO NOTHING;

-- Test Series (matching the frontend mock data)
INSERT INTO test_series (title, description, duration, is_free, price, status, question_count) VALUES
('Test Series 01', 'Foundation nursing concepts covering basic principles and patient care fundamentals.', 45, true, 0, 'PUBLISHED', 50),
('Test Series 02', 'Intermediate nursing practice focusing on medical-surgical and pharmacology concepts.', 45, true, 0, 'PUBLISHED', 50),
('Test Series 03', 'Advanced nursing concepts including specialized care and complex patient scenarios.', 45, false, 199, 'PUBLISHED', 50),
('Test Series 04', 'Comprehensive nursing practice covering all major nursing specialties and advanced concepts.', 45, false, 199, 'PUBLISHED', 50),
('Test Series 05', 'Final preparation test series simulating actual nursing competitive exam patterns.', 45, false, 199, 'DRAFT', 50)
ON CONFLICT DO NOTHING;

-- Sample Questions for Test Series 01
-- Note: These will be inserted after we get the actual UUIDs from the test_series table
-- For now, we'll use a placeholder approach that will be updated after execution

-- Sample Purchases
INSERT INTO purchases (user_id, test_series_id, amount, provider, payment_id, order_id, status) VALUES
(2, 3, 199, 'MOCK', 'pay_mock_123', 'order_mock_123', 'SUCCESS'),
(3, 3, 199, 'MOCK', 'pay_mock_124', 'order_mock_124', 'SUCCESS'),
(4, 4, 199, 'MOCK', 'pay_mock_125', 'order_mock_125', 'SUCCESS');

-- Sample Attempts
INSERT INTO attempts (user_id, test_series_id, started_at, submitted_at, score, total_questions, correct_answers, incorrect_answers, unanswered, time_taken, status) VALUES
(2, 1, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 30 minutes', 42, 50, 42, 6, 2, 5400, 'COMPLETED'),
(2, 2, NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours', 38, 50, 38, 8, 4, 2472, 'COMPLETED'),
(3, 1, NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days 23 hours', 45, 50, 45, 3, 2, 2145, 'COMPLETED'),
(4, 1, NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days 23 hours', 40, 50, 40, 7, 3, 2700, 'COMPLETED');

-- Sample User Answers
INSERT INTO user_answers (attempt_id, question_id, selected_answer, is_correct) VALUES
(1, 1, 'C', true),
(1, 2, 'B', true),
(1, 3, 'C', true),
(1, 4, 'B', true),
(1, 5, 'C', true);
