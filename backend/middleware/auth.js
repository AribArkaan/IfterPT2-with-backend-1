// Authentication middleware to check if user is logged in

function requireLogin(req, res, next) {
  if (req.session && req.session.userId) {
    return next(); // User is logged in, continue
  }
  
  // User is not logged in
  if (req.accepts('html')) {
    // If requesting HTML, redirect to login
    return res.redirect('/login');
  } else {
    // If requesting API, return error
    return res.status(401).json({ success: false, error: 'Unauthorized: Please login first' });
  }
}

function isLoggedIn(req) {
  return req.session && req.session.userId;
}

module.exports = {
  requireLogin,
  isLoggedIn
};
