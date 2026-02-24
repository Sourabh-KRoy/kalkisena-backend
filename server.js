require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const multer = require('multer');
const { sequelize } = require('./models');

const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Health check route
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/driver-auth', require('./routes/driverAuth'));
app.use('/api/rides', require('./routes/rides'));
app.use('/api/book-purchase', require('./routes/bookPurchase'));
app.use('/api/form', require('./routes/form'));
app.use('/api/payment', require('./routes/nepalPayment'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Handle multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(422).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB'
      });
    }
    return res.status(422).json({
      success: false,
      message: err.message || 'File upload error'
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Database connection and server start
sequelize.authenticate()
  .then(() => {
    console.log('Database connection has been established successfully.');
    
    // Sync database (use with caution in production)
    if (process.env.NODE_ENV === 'development') {
      return sequelize.sync({ alter: false }); // Set to true if you want to auto-sync models
    }
  })
  .then(() => {
    // Create HTTP server from Express app
    const http = require('http');
    const server = http.createServer(app);
    
    // Initialize Socket.IO
    const { initializeSocket } = require('./utils/socketService');
    initializeSocket(server);
    
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`WebSocket server initialized`);
    });
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
    process.exit(1);
  });

module.exports = app;
