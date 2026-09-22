/**
 * Question Parser Service
 * Parses questions, options, and correct answers from extracted text
 */

/**
 * Main parsing function
 * @param {string} text - Extracted text from document
 * @returns {Array<{questionNumber: number, questionText: string, options: {A: string, B: string, C: string, D: string}, correctAnswer: string}>}
 */
function parseQuestions(text) {
  const questions = [];
  const answerKey = parseAnswers(text);

  // Split text into question blocks
  const questionBlocks = splitIntoQuestionBlocks(text);

  for (const block of questionBlocks) {
    const question = parseQuestionBlock(block, answerKey);
    if (question) {
      questions.push(question);
    }
  }

  return questions;
}

/**
 * Split text into individual question blocks
 * @param {string} text - Full text
 * @returns {Array<string>}
 */
function splitIntoQuestionBlocks(text) {
  const blocks = [];
  // Match patterns like "Question 1:", "Q1:", "1.", etc.
  const questionPattern = /(?:Question\s+|Q\s*)?\d+[:.]/gi;
  
  let lastIndex = 0;
  let match;
  
  while ((match = questionPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      blocks.push(text.substring(lastIndex, match.index).trim());
    }
    lastIndex = match.index;
  }
  
  if (lastIndex < text.length) {
    blocks.push(text.substring(lastIndex).trim());
  }
  
  // Filter out empty blocks and blocks that don't start with a question pattern
  return blocks.filter(block => block.length > 0 && questionPattern.test(block.substring(0, 50)));
}

/**
 * Parse a single question block
 * @param {string} block - Question text block
 * @param {Map<number, string>} answerKey - Answer key map
 * @returns {Object|null}
 */
function parseQuestionBlock(block, answerKey) {
  // Extract question number
  const questionNumberMatch = block.match(/(?:Question\s+|Q\s*)?(\d+)[:.]/i);
  if (!questionNumberMatch) return null;
  
  const questionNumber = parseInt(questionNumberMatch[1]);
  
  // Extract question text (everything after the number until first option)
  const firstOptionMatch = block.match(/(?:\n|^)\s*[A-D][\)\.]/i);
  let questionText;
  if (firstOptionMatch) {
    questionText = block.substring(questionNumberMatch.index + questionNumberMatch[0].length, firstOptionMatch.index).trim();
  } else {
    questionText = block.substring(questionNumberMatch.index + questionNumberMatch[0].length).trim();
  }
  
  // Remove "Question X:" prefix if still present
  questionText = questionText.replace(/^Question\s+\d+[:\s]*/i, '').trim();
  
  // Parse options
  const options = parseOptions(block);
  
  // Get correct answer from answer key
  const correctAnswer = answerKey.get(questionNumber);
  
  // Validate
  if (!questionText || !options.A || !options.B || !options.C || !options.D || !correctAnswer) {
    console.warn(`Question ${questionNumber} is incomplete`);
    return null;
  }
  
  return {
    questionNumber,
    questionText,
    options,
    correctAnswer
  };
}

/**
 * Parse options A, B, C, D from question block
 * @param {string} block - Question text block
 * @returns {{A: string, B: string, C: string, D: string}}
 */
function parseOptions(block) {
  const options = { A: '', B: '', C: '', D: '' };
  
  // Match patterns like "A) option text", "A. option text", "A option text"
  const optionPattern = /(?:\n|^)\s*([A-D])[\)\.]\s*([^\n]*)/gi;
  let match;
  
  while ((match = optionPattern.exec(block)) !== null) {
    const letter = match[1].toUpperCase();
    const text = match[2].trim();
    if (options.hasOwnProperty(letter)) {
      options[letter] = text;
    }
  }
  
  return options;
}

/**
 * Parse answer key from text
 * @param {string} text - Full text
 * @returns {Map<number, string>}
 */
function parseAnswers(text) {
  const answerKey = new Map();
  
  // Look for answer key section (typically at the end)
  const answerSectionPatterns = [
    /(?:Answer\s*Key|Answers|Key)[:\s]*([^\n]+)/i,
    /(?:Answer\s*Key|Answers|Key)[:\s]*\n([\s\S]+)/i,
  ];
  
  let answerText = '';
  for (const pattern of answerSectionPatterns) {
    const match = text.match(pattern);
    if (match) {
      answerText = match[1];
      break;
    }
  }
  
  // If no explicit answer section, try to find pattern at the end
  if (!answerText) {
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 20); i--) {
      const line = lines[i].trim();
      if (/^\d+[-:\s][A-D]/i.test(line)) {
        answerText = line;
        break;
      }
    }
  }
  
  // Parse answer patterns like "1-A", "1: A", "1A", "1) A"
  const answerPattern = /(\d+)[-:\)\s]*([A-D])/gi;
  let match;
  
  while ((match = answerPattern.exec(answerText)) !== null) {
    const questionNumber = parseInt(match[1]);
    const answer = match[2].toUpperCase();
    answerKey.set(questionNumber, answer);
  }
  
  return answerKey;
}

/**
 * Validate a parsed question
 * @param {Object} question - Parsed question object
 * @returns {boolean}
 */
function validateParsedQuestion(question) {
  return !!(
    question.questionNumber &&
    question.questionText &&
    question.options &&
    question.options.A &&
    question.options.B &&
    question.options.C &&
    question.options.D &&
    question.correctAnswer &&
    ['A', 'B', 'C', 'D'].includes(question.correctAnswer)
  );
}

/**
 * Extract correct answer for a specific question from answer key
 * @param {Map<number, string>} answerKey - Answer key map
 * @param {number} questionNumber - Question number
 * @returns {string|null}
 */
function extractAnswerFromKey(answerKey, questionNumber) {
  return answerKey.get(questionNumber) || null;
}

module.exports = {
  parseQuestions,
  parseQuestionBlock,
  parseOptions,
  parseAnswers,
  validateParsedQuestion,
  extractAnswerFromKey
};
