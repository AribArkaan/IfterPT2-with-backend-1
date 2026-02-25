const { pool } = require('../config/database');
const bcrypt = require('bcrypt');
const { handleError, handleSuccess } = require('../utils/helpers');

// Login user
exports.login = (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password are required'
    });
  }

  // Find user in database
  const sql = 'SELECT id, username, email, password FROM users WHERE username = ? OR email = ?';

  pool.query(sql, [username, username], (err, results) => {
    if (err) return handleError(res, err, 'Database error');

    if (results.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    const user = results[0];

    // Compare password with bcrypt
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) return handleError(res, err, 'Error comparing passwords');

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: 'Invalid username or password'
        });
      }

      // Password matches - create session
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.email = user.email;

      console.log(`✅ User '${user.username}' logged in successfully`);

      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    });
  });
};

// Logout user
exports.logout = (req, res) => {
  const username = req.session.username || 'Unknown';
  
  req.session.destroy((err) => {
    if (err) {
      return handleError(res, err, 'Failed to logout');
    }

    console.log(`✅ User '${username}' logged out`);

    res.json({
      success: true,
      message: 'Logout successful'
    });
  });
};

// Get current user info
exports.getCurrentUser = (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      error: 'Not logged in'
    });
  }

  res.json({
    success: true,
    user: {
      id: req.session.userId,
      username: req.session.username,
      email: req.session.email
    }
  });
};

// Check authentication status
exports.checkAuth = (req, res) => {
  res.json({
    success: true,
    authenticated: req.session && req.session.userId ? true : false,
    user: req.session ? {
      id: req.session.userId,
      username: req.session.username,
      email: req.session.email
    } : null
  });
};
