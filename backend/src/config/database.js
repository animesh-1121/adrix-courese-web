const { Pool } = require('pg');
require('dotenv').config({ override: true });

// Create a PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // This allows SSL with self-signed certs (Neon)
  }
});

// Test database connection
async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Database connection error:', error.message);
    // Provide helpful error message
    if (error.code === 'ENOTFOUND') {
      console.error('DNS resolution failed. Please check:');
      console.error('1. The DATABASE_URL in .env is correct');
      console.error('2. Your network can reach AWS endpoints');
      console.error('3. The Neon project still exists');
    }
    return false;
  }
}

// Get database pool instance
function getPool() {
  return pool;
}

// Execute a query
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
}

// Close all connections in the pool
async function closePool() {
  await pool.end();
}

module.exports = {
  testConnection,
  getPool,
  query,
  closePool
};