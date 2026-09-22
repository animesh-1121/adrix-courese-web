const express = require('express');
const cheerio = require('cheerio');
const { query } = require('../../config/database');
const { requireAdmin } = require('../../middleware/adminAuth');

const router = express.Router();

// GET /api/admin/test-series/:id/questions - Get questions for a test series
router.get('/test-series/:id/questions', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'SELECT * FROM questions WHERE test_series_id = $1 ORDER BY order_number',
      [id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Questions error:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// POST /api/admin/test-series/:id/questions - Add question to test series
router.post('/test-series/:id/questions', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { question_text, option_a, option_b, option_c, option_d, correct_option, explanation } = req.body;
    
    // Validation
    if (!question_text || !option_a || !option_b || !option_c || !option_d || !correct_option) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (!['A', 'B', 'C', 'D'].includes(correct_option.toUpperCase())) {
      return res.status(400).json({ error: 'Correct answer must be A, B, C, or D' });
    }
    
    // Get current max order number
    const maxOrderResult = await query(
      'SELECT COALESCE(MAX(order_number), 0) as max_order FROM questions WHERE test_series_id = $1',
      [id]
    );
    const nextOrder = parseInt(maxOrderResult.rows[0].max_order) + 1;
    
    const result = await query(
      'INSERT INTO questions (test_series_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, order_number) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [id, question_text, option_a, option_b, option_c, option_d, correct_option.toUpperCase(), explanation, nextOrder]
    );
    
    // Update test series question count
    await query(
      'UPDATE test_series SET question_count = question_count + 1 WHERE id = $1',
      [id]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add question error:', error);
    res.status(500).json({ error: 'Failed to add question' });
  }
});

// PUT /api/admin/questions/:id - Update question
router.put('/questions/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { question_text, option_a, option_b, option_c, option_d, correct_option, explanation } = req.body;
    
    if (!['A', 'B', 'C', 'D'].includes(correct_option?.toUpperCase())) {
      return res.status(400).json({ error: 'Correct answer must be A, B, C, or D' });
    }
    
    const result = await query(
      'UPDATE questions SET question_text = $1, option_a = $2, option_b = $3, option_c = $4, option_d = $5, correct_option = $6, explanation = $7 WHERE id = $8 RETURNING *',
      [question_text, option_a, option_b, option_c, option_d, correct_option?.toUpperCase(), explanation, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// DELETE /api/admin/questions/:id - Delete question
router.delete('/questions/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get test series id before deleting
    const questionResult = await query('SELECT test_series_id FROM questions WHERE id = $1', [id]);
    
    if (questionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    
    const testSeriesId = questionResult.rows[0].test_series_id;
    
    const result = await query('DELETE FROM questions WHERE id = $1 RETURNING *', [id]);
    
    // Update test series question count
    await query(
      'UPDATE test_series SET question_count = question_count - 1 WHERE id = $1',
      [testSeriesId]
    );
    
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// POST /api/admin/test-series/:id/import/html - Import questions from HTML
router.post('/test-series/:id/import/html', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { html } = req.body;
    
    console.log('HTML import request:', { testSeriesId: id, htmlLength: html?.length });
    
    if (!html) {
      return res.status(400).json({ error: 'HTML content is required' });
    }
    
    // Simple HTML parser - extract questions
    // This is a basic implementation - in production, use a proper HTML parser
    const questions = parseHTMLQuestions(html);
    
    console.log('Parsed questions:', questions.length);
    
    // Validate questions
    const validQuestions = [];
    const invalidQuestions = [];
    
    questions.forEach((q, index) => {
      if (!q.question || !q.options || q.options.length !== 4 || !q.correctAnswer) {
        invalidQuestions.push({
          index: index + 1,
          question: q.question,
          reason: !q.question ? 'Missing question text' : 
                   !q.options ? 'Missing options' : 
                   q.options.length !== 4 ? 'Must have exactly 4 options' : 
                   'Missing correct answer'
        });
      } else {
        validQuestions.push(q);
      }
    });
    
    res.json({
      total: questions.length,
      valid: validQuestions.length,
      invalid: invalidQuestions.length,
      validQuestions,
      invalidQuestions
    });
  } catch (error) {
    console.error('Import HTML error:', error);
    res.status(500).json({ 
      error: 'Failed to import HTML',
      details: error.message 
    });
  }
});

// POST /api/admin/test-series/:id/import/confirm - Confirm and save imported questions
router.post('/test-series/:id/import/confirm', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { questions } = req.body;
    
    console.log('Import confirm request:', { testSeriesId: id, questionCount: questions?.length });
    
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'Questions array is required' });
    }
    
    // Verify test series exists
    const testSeriesCheck = await query('SELECT id FROM test_series WHERE id = $1', [id]);
    if (testSeriesCheck.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Test series not found',
        details: `No test series found with ID: ${id}`
      });
    }
    
    // Get current max order number
    const maxOrderResult = await query(
      'SELECT COALESCE(MAX(order_number), 0) as max_order FROM questions WHERE test_series_id = $1',
      [id]
    );
    let nextOrder = parseInt(maxOrderResult.rows[0].max_order) + 1;
    
    console.log('Starting import with order:', nextOrder);
    
    // Insert questions
    for (const q of questions) {
      console.log('Inserting question:', { question: q.question.substring(0, 50), hasOptions: q.options?.length });
      await query(
        'INSERT INTO questions (test_series_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, order_number) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [id, q.question, q.options[0], q.options[1], q.options[2], q.options[3], q.correctAnswer.toUpperCase(), q.explanation, nextOrder]
      );
      nextOrder++;
    }
    
    // Update test series question count
    await query(
      'UPDATE test_series SET question_count = question_count + $1 WHERE id = $2',
      [questions.length, id]
    );
    
    console.log('Import completed successfully');
    res.json({ message: `Successfully imported ${questions.length} questions` });
  } catch (error) {
    console.error('Confirm import error:', error);
    res.status(500).json({ 
      error: 'Failed to save imported questions',
      details: error.message 
    });
  }
});

// HTML question parser using cheerio
function parseHTMLQuestions(html) {
  const questions = [];
  const $ = cheerio.load(html);
  
  // Find question blocks - flexible patterns
  const text = $.text();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  let currentQuestion = null;
  let currentOptions = [];
  let currentExplanation = null;
  let currentCorrectAnswer = null;
  
  // Patterns for identifying question markers
  const questionPatterns = [
    /^(\d+\.|Q\d+\.|\d+\))/,
    /^Question\s*\d+/i
  ];
  
  // Patterns for identifying option markers
  const optionPatterns = [
    /^([A-D]\)|[A-D]\.|[A-D]\)\s*)/,
    /^(\([A-D]\))/,
    /^([A-D]:)/
  ];
  
  // Patterns for identifying correct answer
  const correctAnswerPatterns = [
    /correct\s*answer\s*[:\s]*([A-D])/i,
    /answer\s*[:\s]*([A-D])/i,
    /ans\s*[:\s]*([A-D])/i
  ];
  
  // Patterns for identifying explanation
  const explanationPatterns = [
    /explanation\s*[:\s]/i,
    /reason\s*[:\s]/i,
    /solution\s*[:\s]/i
  ];
  
  lines.forEach((line) => {
    // Check if line starts a new question
    const isQuestion = questionPatterns.some(pattern => pattern.test(line));
    
    if (isQuestion && line.length > 20) {
      // Save previous question if exists
      if (currentQuestion && currentOptions.length === 4) {
        questions.push({
          question: currentQuestion,
          options: currentOptions,
          correctAnswer: currentCorrectAnswer,
          explanation: currentExplanation
        });
      }
      
      // Start new question
      currentQuestion = line.replace(/^\d+\.|Q\d+\.|\d+\)|Question\s*\d+/i, '').trim();
      currentOptions = [];
      currentExplanation = null;
      currentCorrectAnswer = null;
    }
    
    // Check if line is an option
    const optionMatch = optionPatterns.find(pattern => pattern.test(line));
    if (optionMatch) {
      const optionText = line.replace(optionMatch, '').trim();
      if (optionText) {
        currentOptions.push(optionText);
      }
    }
    
    // Check if line contains correct answer
    const correctMatch = correctAnswerPatterns.find(pattern => pattern.test(line));
    if (correctMatch) {
      const match = line.match(correctMatch);
      if (match && match[1]) {
        currentCorrectAnswer = match[1].toUpperCase();
      }
    }
    
    // Check if line is explanation
    const isExplanation = explanationPatterns.some(pattern => pattern.test(line));
    if (isExplanation) {
      currentExplanation = line.replace(/explanation\s*[:\s]|reason\s*[:\s]|solution\s*[:\s]/i, '').trim();
    }
  });
  
  // Add last question
  if (currentQuestion && currentOptions.length === 4) {
    questions.push({
      question: currentQuestion,
      options: currentOptions,
      correctAnswer: currentCorrectAnswer,
      explanation: currentExplanation
    });
  }
  
  return questions;
}

module.exports = router;