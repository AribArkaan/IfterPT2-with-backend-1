// Session configuration for express-session
const session = require('express-session');

const sessionConfig = session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
});

module.exports = sessionConfig;
