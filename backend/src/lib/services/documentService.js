const { query } = require('../../config/database');

/**
 * Document Service
 * Manages document records in the database
 */

/**
 * Create a new document record
 * @param {Object} metadata - Document metadata
 * @returns {Promise<Object>}
 */
async function createDocument(metadata) {
  const {
    test_series_id,
    uploaded_by,
    original_filename,
    file_type,
    mime_type,
    size_bytes,
    storage_key,
    storage_url
  } = metadata;

  const result = await query(
    `INSERT INTO documents 
      (test_series_id, uploaded_by, original_filename, file_type, mime_type, size_bytes, storage_key, storage_url, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'UPLOADED')
     RETURNING *`,
    [test_series_id, uploaded_by, original_filename, file_type, mime_type, size_bytes, storage_key, storage_url]
  );

  return result.rows[0];
}

/**
 * Get document by ID
 * @param {string} id - Document ID
 * @returns {Promise<Object|null>}
 */
async function getDocumentById(id) {
  const result = await query('SELECT * FROM documents WHERE id = $1', [id]);
  return result.rows[0] || null;
}

/**
 * Get all documents
 * @param {Object} filters - Optional filters (status, uploaded_by, test_series_id)
 * @returns {Promise<Array>}
 */
async function getDocuments(filters = {}) {
  let queryText = 'SELECT * FROM documents WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (filters.status) {
    queryText += ` AND status = $${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }

  if (filters.uploaded_by) {
    queryText += ` AND uploaded_by = $${paramIndex}`;
    params.push(filters.uploaded_by);
    paramIndex++;
  }

  if (filters.test_series_id) {
    queryText += ` AND test_series_id = $${paramIndex}`;
    params.push(filters.test_series_id);
    paramIndex++;
  }

  queryText += ' ORDER BY created_at DESC';

  const result = await query(queryText, params);
  return result.rows;
}

/**
 * Get documents by test series
 * @param {string} testSeriesId - Test series ID
 * @returns {Promise<Array>}
 */
async function getDocumentsByTestSeries(testSeriesId) {
  const result = await query(
    'SELECT * FROM documents WHERE test_series_id = $1 ORDER BY created_at DESC',
    [testSeriesId]
  );
  return result.rows;
}

/**
 * Update document status
 * @param {string} id - Document ID
 * @param {string} status - New status
 * @param {Object} additionalFields - Additional fields to update (extracted_text, question_count, error_message)
 * @returns {Promise<Object>}
 */
async function updateStatus(id, status, additionalFields = {}) {
  const updates = ['status = $2', 'updated_at = NOW()'];
  const params = [id, status];
  let paramIndex = 3;

  if (additionalFields.extracted_text !== undefined) {
    updates.push(`extracted_text = $${paramIndex}`);
    params.push(additionalFields.extracted_text);
    paramIndex++;
  }

  if (additionalFields.question_count !== undefined) {
    updates.push(`question_count = $${paramIndex}`);
    params.push(additionalFields.question_count);
    paramIndex++;
  }

  if (additionalFields.error_message !== undefined) {
    updates.push(`error_message = $${paramIndex}`);
    params.push(additionalFields.error_message);
    paramIndex++;
  }

  const result = await query(
    `UPDATE documents SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );

  return result.rows[0];
}

/**
 * Link document to test series
 * @param {string} documentId - Document ID
 * @param {string} testSeriesId - Test series ID
 * @returns {Promise<Object>}
 */
async function linkToTestSeries(documentId, testSeriesId) {
  const result = await query(
    'UPDATE documents SET test_series_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [testSeriesId, documentId]
  );
  return result.rows[0];
}

/**
 * Delete document and its S3 file
 * @param {string} id - Document ID
 * @param {Function} deleteFromStorage - Function to delete from S3
 * @returns {Promise<void>}
 */
async function deleteDocument(id, deleteFromStorage) {
  const document = await getDocumentById(id);
  if (!document) {
    throw new Error('Document not found');
  }

  // Delete from S3
  try {
    await deleteFromStorage(document.storage_key);
  } catch (error) {
    console.error('Failed to delete from storage:', error);
    // Continue with database deletion even if S3 deletion fails
  }

  // Delete from database
  await query('DELETE FROM documents WHERE id = $1', [id]);
}

/**
 * Get parsed questions for a document
 * @param {string} documentId - Document ID
 * @returns {Promise<Array>}
 */
async function getDocumentQuestions(documentId) {
  const result = await query(
    `SELECT * FROM questions WHERE source_document_id = $1 ORDER BY order_number`,
    [documentId]
  );
  return result.rows;
}

/**
 * Delete all questions for a document
 * @param {string} documentId - Document ID
 * @returns {Promise<void>}
 */
async function deleteDocumentQuestions(documentId) {
  await query('DELETE FROM questions WHERE source_document_id = $1', [documentId]);
}

/**
 * Approve all questions for a document
 * @param {string} documentId - Document ID
 * @returns {Promise<void>}
 */
async function approveDocumentQuestions(documentId) {
  await query(
    `UPDATE questions SET review_status = 'APPROVED' WHERE source_document_id = $1`,
    [documentId]
  );
}

module.exports = {
  createDocument,
  getDocumentById,
  getDocuments,
  getDocumentsByTestSeries,
  updateStatus,
  linkToTestSeries,
  deleteDocument,
  getDocumentQuestions,
  deleteDocumentQuestions,
  approveDocumentQuestions
};
