const express = require('express');
const cors = require('cors');
require('dotenv').config({ override: true });
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const testsRoutes = require('./routes/tests');
const adminDashboardRoutes = require('./routes/admin/dashboard');
const adminUsersRoutes = require('./routes/admin/users');
const adminTestSeriesRoutes = require('./routes/admin/testSeries');
const adminQuestionsRoutes = require('./routes/admin/questions');
const adminPurchasesRoutes = require('./routes/admin/purchases');
const adminAttemptsRoutes = require('./routes/admin/attempts');
const adminDocumentsRoutes = require('./routes/admin/documents');
const publicTestSeriesRoutes = require('./routes/public/testSeries');
const { testConnection } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tests', testsRoutes);
app.use('/api/admin', adminDashboardRoutes);
app.use('/api/admin', adminUsersRoutes);
app.use('/api/admin', adminTestSeriesRoutes);
app.use('/api/admin', adminQuestionsRoutes);
app.use('/api/admin', adminPurchasesRoutes);
app.use('/api/admin', adminAttemptsRoutes);
app.use('/api/admin', adminDocumentsRoutes);
app.use('/api/test-series', publicTestSeriesRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Nursing Level Up Backend API', status: 'running' });
});

// Start server
async function startServer() {
  try {
    // Test database connection
    console.log('Testing database connection...');
    const dbConnected = await testConnection();
    
    if (dbConnected) {
      console.log('✓ Database connected successfully');
    } else {
      console.log('✗ Database connection failed');
    }
    
    app.listen(PORT, () => {
      console.log(`✓ Backend server running on port ${PORT}`);
      console.log(`✓ API available at http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();