const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl: getSignedUrlFromAWS } = require('@aws-sdk/s3-request-presigner');

/**
 * S3 Storage Service
 * Handles file upload, download, and deletion for S3-compatible storage
 */

// Initialize S3 client
const s3Client = new S3Client({
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION || 'us-east-2',
  forcePathStyle: true, // Required for some S3-compatible services
});

/**
 * Upload a file to S3
 * @param {Buffer} fileBuffer - File content as buffer
 * @param {string} key - Storage key (path in bucket)
 * @param {string} contentType - MIME type
 * @returns {Promise<{key: string, url: string}>}
 */
async function uploadFile(fileBuffer, key, contentType) {
  try {
    const command = new PutObjectCommand({
      Bucket: 'documents', // Using a fixed bucket name for Neon S3
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await s3Client.send(command);
    return { key, url: `${process.env.AWS_ENDPOINT_URL_S3}/documents/${key}` };
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error('Failed to upload file to storage');
  }
}

/**
 * Generate a signed URL for downloading a file
 * @param {string} key - Storage key
 * @param {number} expiresIn - URL expiration in seconds (default: 3600)
 * @returns {Promise<string>}
 */
async function getSignedUrl(key, expiresIn = 3600) {
  try {
    const command = new GetObjectCommand({
      Bucket: 'documents',
      Key: key,
    });

    const url = await getSignedUrlFromAWS(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('S3 signed URL error:', error);
    throw new Error('Failed to generate download URL');
  }
}

/**
 * Delete a file from S3
 * @param {string} key - Storage key
 * @returns {Promise<void>}
 */
async function deleteFile(key) {
  try {
    const command = new DeleteObjectCommand({
      Bucket: 'documents',
      Key: key,
    });

    await s3Client.send(command);
  } catch (error) {
    console.error('S3 delete error:', error);
    throw new Error('Failed to delete file from storage');
  }
}

/**
 * Generate a unique storage key for a file
 * @param {string} originalFilename - Original filename
 * @param {string} userId - User ID
 * @returns {string}
 */
function generateStorageKey(originalFilename, userId) {
  const timestamp = Date.now();
  const sanitizedName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${userId}/${timestamp}_${sanitizedName}`;
}

module.exports = {
  uploadFile,
  getSignedUrl,
  deleteFile,
  generateStorageKey,
  s3Client
};
