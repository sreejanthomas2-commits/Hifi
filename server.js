const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection (Fallback to in-memory/mock if no URI)
if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB Connected via Atlas'))
    .catch(err => console.error('MongoDB Connection Error:', err));
} else {
  console.log('No MONGO_URI provided. Running with in-memory Mock Data mode.');
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Everything App API is running flawlessly.' });
});

app.get('/api/posts', (req, res) => {
  // TODO: Replace with real MongoDB query `Post.find()`
  res.json([{ id: 1, text: 'Hello from the Node.js backend!', author: '@system' }]);
});

// Catch-all to serve index.html for Single Page App routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Port configuration for Vercel/Local
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});

// Export the Express API for Vercel Serverless
module.exports = app;
