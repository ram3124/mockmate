const mongoose = require('mongoose');

// -----------------------------------------------------------------------------
// Database Connection
// -----------------------------------------------------------------------------
// Extracted into its own module so that both server.js and utility scripts
// (e.g. seedQuestions.js) can connect to MongoDB without duplicating the
// connection string logic or error handling.
// -----------------------------------------------------------------------------

/**
 * Connect to MongoDB using the MONGO_URI environment variable.
 * Falls back to a local development URI if the env var is not set.
 *
 * @returns {Promise<typeof mongoose>} The mongoose connection instance.
 * @throws {Error} If the connection fails (caller should handle).
 */
const connectDB = async () => {
  const mongoURI =
    process.env.MONGO_URI || 'mongodb://localhost:27017/mockmate';

  const connection = await mongoose.connect(mongoURI);

  console.log(`✅  MongoDB connected: ${connection.connection.host}`);

  return connection;
};

module.exports = connectDB;
