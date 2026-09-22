const express = require('express');
const multer = require('multer');
const router = express.Router();
const { requireAdmin } = require('../../middleware/adminAuth');
const { uploadFile, getSignedUrl, deleteFile, generateStorageKey } = require('../../lib/storage');
const { extractText } = require('../../lib/extraction');
const { parseQuestions } = require('../../lib/parser');
const { createDocument, getDocumentById, getDocuments, updateStatus, linkToTestSeries, deleteDocument, getDocumentQuestions, deleteDocumentQuestions, approveDocumentQuestions } = require('../../lib/services/documentService');
const { query } = require('../../config/database');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/html', 'application/msword'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, and HTML files are allowed.'));
    }
  },
});

/**
 * POST /api/admin/documents/upload
 * Upload a new document
 */
router.post('/upload', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { test_series_id } = req.body;
    const userId = req.user.id;

    // Determine file type
    let fileType = 'PDF';
    if (req.file.mimetype.includes('wordprocessingml')) {
      fileType = 'DOCX';
    } else if (req.file.mimetype.includes('html')) {
      fileType = 'HTML';
    }

    // Generate storage key
    const storageKey = generateStorageKey(req.file.originalname, userId);

    // Upload to S3
    const { key, url } = await uploadFile(req.file.buffer, storageKey, req.file.mimetype);

    // Create document record
    const document = await createDocument({
      test_series_id: test_series_id || null,
      uploaded_by: userId,
      original_filename: req.file.originalname,
      file_type: fileType,
      mime_type: req.file.mimetype,
      size_bytes: req.file.size,
      storage_key: key,
      storage_url: url,
    });

    res.status(201).json(document);
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload document' });
  }
});

/**
 * GET /api/admin/documents
 * Get all documents
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { status, test_series_id } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (test_series_id) filters.test_series_id = test_series_id;

    const documents = await getDocuments(filters);
    res.json(documents);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

/**
 * GET /api/admin/documents/:id
 * Get document details
 */
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const document = await getDocumentById(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(document);
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

/**
 * GET /api/admin/documents/:id/download
 * Get download URL for document
 */
router.get('/:id/download', requireAdmin, async (req, res) => {
  try {
    const document = await getDocumentById(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const url = await getSignedUrl(document.storage_key);
    res.json({ url });
  } catch (error) {
    console.error('Get download URL error:', error);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

/**
 * POST /api/admin/documents/:id/extract
 * Extract text from document
 */
router.post('/:id/extract', requireAdmin, async (req, res) => {
  try {
    const document = await getDocumentById(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Download file from S3
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const { s3Client } = require('../../lib/storage');
    const command = new GetObjectCommand({
      Bucket: 'documents',
      Key: document.storage_key,
    });
    const response = await s3Client.send(command);
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Extract text
    const extractedText = await extractText(buffer, document.file_type);

    // Update document with extracted text
    const updated = await updateStatus(req.params.id, 'EXTRACTED', { extracted_text });

    res.json(updated);
  } catch (error) {
    console.error('Extract text error:', error);
    await updateStatus(req.params.id, 'EXTRACT_FAILED', { error_message: error.message });
    res.status(500).json({ error: error.message || 'Failed to extract text' });
  }
});

/**
 * POST /api/admin/documents/:id/parse
 * Parse questions from extracted text
 */
router.post('/:id/parse', requireAdmin, async (req, res) => {
  try {
    const document = await getDocumentById(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (!document.extracted_text) {
      return res.status(400).json({ error: 'Document has not been extracted yet' });
    }

    // Parse questions
    const parsedQuestions = parseQuestions(document.extracted_text);

    if (parsedQuestions.length === 0) {
      return res.status(400).json({ error: 'No questions found in document' });
    }

    // Create question records
    const createdQuestions = [];
    for (const q of parsedQuestions) {
      const result = await query(
        `INSERT INTO questions 
          (test_series_id, question_text, option_a, option_b, option_c, option_d, correct_option, order_number, source_document_id, review_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING_REVIEW')
         RETURNING *`,
        [
          document.test_series_id,
          q.questionText,
          q.options.A,
          q.options.B,
          q.options.C,
          q.options.D,
          q.correctAnswer,
          q.questionNumber,
          document.id
        ]
      );
      createdQuestions.push(result.rows[0]);
    }

    // Update document status
    const updated = await updateStatus(req.params.id, 'PARSED', { question_count: parsedQuestions.length });

    res.json({ document: updated, questions: createdQuestions });
  } catch (error) {
    console.error('Parse questions error:', error);
    await updateStatus(req.params.id, 'PARSE_FAILED', { error_message: error.message });
    res.status(500).json({ error: error.message || 'Failed to parse questions' });
  }
});

/**
 * GET /api/admin/documents/:id/preview
 * Get parsed questions for review
 */
router.get('/:id/preview', requireAdmin, async (req, res) => {
  try {
    const document = await getDocumentById(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const questions = await getDocumentQuestions(req.params.id);
    res.json({ document, questions });
  } catch (error) {
    console.error('Get preview error:', error);
    res.status(500).json({ error: 'Failed to fetch preview' });
  }
});

/**
 * POST /api/admin/documents/:id/approve
 * Approve all parsed questions
 */
router.post('/:id/approve', requireAdmin, async (req, res) => {
  try {
    const document = await getDocumentById(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Approve all questions
    await approveDocumentQuestions(req.params.id);

    // Update document status
    const updated = await updateStatus(req.params.id, 'APPROVED');

    // Update test series question count if linked
    if (document.test_series_id) {
      await query(
        `UPDATE test_series 
         SET question_count = question_count + (SELECT COUNT(*) FROM questions WHERE source_document_id = $1 AND review_status = 'APPROVED')
         WHERE id = $2`,
        [req.params.id, document.test_series_id]
      );
    }

    res.json(updated);
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ error: 'Failed to approve questions' });
  }
});

/**
 * POST /api/admin/documents/:id/reject
 * Reject all parsed questions
 */
router.post('/:id/reject', requireAdmin, async (req, res) => {
  try {
    const document = await getDocumentById(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete all questions
    await deleteDocumentQuestions(req.params.id);

    // Update document status
    const updated = await updateStatus(req.params.id, 'PARSE_FAILED', { error_message: 'Rejected by admin' });

    res.json(updated);
  } catch (error) {
    console.error('Reject error:', error);
    res.status(500).json({ error: 'Failed to reject questions' });
  }
});

/**
 * PUT /api/admin/documents/:id/link
 * Link document to test series
 */
router.put('/:id/link', requireAdmin, async (req, res) => {
  try {
    const { test_series_id } = req.body;
    if (!test_series_id) {
      return res.status(400).json({ error: 'test_series_id is required' });
    }

    const updated = await linkToTestSeries(req.params.id, test_series_id);
    res.json(updated);
  } catch (error) {
    console.error('Link error:', error);
    res.status(500).json({ error: 'Failed to link document' });
  }
});

/**
 * DELETE /api/admin/documents/:id
 * Delete document
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await deleteDocument(req.params.id, deleteFile);
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete document' });
  }
});

module.exports = router;
