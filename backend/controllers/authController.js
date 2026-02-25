const { pool } = require('../config/database');
const bcrypt = require('bcrypt');
const { handleError, handleSuccess } = require('../utils/helpers');

// Register new user
exports.register = (req, res) => {
  const { username, email, password, passwordConfirm } = req.body;

  // Validation
  if (!username || !email || !password || !passwordConfirm) {
    return res.status(400).json({
      success: false,
      error: 'All fields are required'
    });
  }

  if (password !== passwordConfirm) {
    return res.status(400).json({
      success: false,
      error: 'Passwords do not match'
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      error: 'Password must be at least 6 characters'
    });
  }

  if (username.length < 3) {
    return res.status(400).json({
      success: false,
      error: 'Username must be at least 3 characters'
    });
  }

  // Check if username or email already exists
  pool.query(
    'SELECT username, email FROM users WHERE username = ? OR email = ?',
    [username, email],
    async (err, results) => {
      if (err) return handleError(res, err, 'Database error');

      if (results.length > 0) {
        let message = '';
        if (results[0].username === username) {
          message = 'Username already taken';
        } else {
          message = 'Email already registered';
        }
        return res.status(400).json({
          success: false,
          error: message
        });
      }

      // Hash password
      try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        pool.query(
          'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
          [username, email, hashedPassword],
          (err, result) => {
            if (err) return handleError(res, err, 'Failed to create account');

            console.log(`✅ New user registered: ${username} (${email})`);

            res.status(201).json({
              success: true,
              message: 'Account created successfully. You can now login.',
              user: {
                id: result.insertId,
                username: username,
                email: email
              }
            });
          }
        );
      } catch (err) {
        return handleError(res, err, 'Error hashing password');
      }
    }
  );
};

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
