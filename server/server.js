// Load environment variables first
require('dotenv').config();

// Patch express to forward async errors automatically
// require('express-async-errors');

const express = require('express');
const cors = require('cors');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const questionRoutes = require('./routes/questionRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const errorHandler = require('./middleware/errorHandler');

// -----------------------------------------------------------------------------
// Initialise Express
// -----------------------------------------------------------------------------
const app = express();

// -----------------------------------------------------------------------------
// Middleware
// -----------------------------------------------------------------------------

// CORS — allow requests from the configured client origin
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  }),
);

// Parse JSON request bodies
app.use(express.json());

// -----------------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Health-check endpoint
app.get('/', (req, res) => {
  res.json({ success: true, message: 'MockMate API is running 🚀' });
});

// -----------------------------------------------------------------------------
// Global Error Handler (must be registered AFTER all routes)
// -----------------------------------------------------------------------------
app.use(errorHandler);

// -----------------------------------------------------------------------------
// Database Connection & Server Start
// -----------------------------------------------------------------------------
const PORT = process.env.PORT || 5000;

// Use the shared connectDB module instead of inline mongoose.connect() so that
// the connection logic is defined in one place and reused by scripts.
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`🚀  MockMate server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌  Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
  