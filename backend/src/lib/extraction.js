const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const cheerio = require('cheerio');
const { convert } = require('html-to-text');
const sanitizeHtml = require('sanitize-html');

/**
 * Text Extraction Service
 * Extracts text from PDF, DOCX, and HTML files
 */

/**
 * Main extraction dispatcher
 * @param {Buffer} buffer - File buffer
 * @param {string} fileType - File type (PDF, DOCX, HTML)
 * @returns {Promise<string>} Extracted text
 */
async function extractText(buffer, fileType) {
  switch (fileType.toUpperCase()) {
    case 'PDF':
      return await extractFromPDF(buffer);
    case 'DOCX':
      return await extractFromDOCX(buffer);
    case 'HTML':
      return await extractFromHTML(buffer);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

/**
 * Extract text from PDF
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Promise<string>}
 */
async function extractFromPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Extract text from DOCX
 * @param {Buffer} buffer - DOCX file buffer
 * @returns {Promise<string>}
 */
async function extractFromDOCX(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('DOCX extraction error:', error);
    throw new Error('Failed to extract text from DOCX');
  }
}

/**
 * Extract text from HTML
 * @param {Buffer} buffer - HTML file buffer
 * @returns {Promise<string>}
 */
async function extractFromHTML(buffer) {
  try {
    const html = buffer.toString('utf-8');
    const sanitized = sanitizeHTML(html);
    const text = convert(sanitized, {
      wordwrap: false,
      preserveNewlines: true,
    });
    return text;
  } catch (error) {
    console.error('HTML extraction error:', error);
    throw new Error('Failed to extract text from HTML');
  }
}

/**
 * Sanitize HTML to remove potentially malicious content
 * @param {string} html - Raw HTML
 * @returns {string} Sanitized HTML
 */
function sanitizeHTML(html) {
  return sanitizeHtml(html, {
    allowedTags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span', 'ul', 'ol', 'li', 'strong', 'em', 'br'],
    allowedAttributes: {},
  });
}

module.exports = {
  extractText,
  extractFromPDF,
  extractFromDOCX,
  extractFromHTML,
  sanitizeHTML
};
