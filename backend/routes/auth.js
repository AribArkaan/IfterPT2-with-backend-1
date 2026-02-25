const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/auth/register - Register new user
router.post('/register', authController.register);

// POST /api/auth/login - Login with username and password
router.post('/login', authController.login);

// POST /api/auth/logout - Logout and destroy session
router.post('/logout', authController.logout);

// GET /api/auth/me - Get current user info
router.get('/me', authController.getCurrentUser);

// GET /api/auth/check - Check if user is authenticated
router.get('/check', authController.checkAuth);

module.exports = router;
