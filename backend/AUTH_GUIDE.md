# 🔐 Authentication Setup Guide

## Overview

Your application now has a complete authentication system that requires users to login before accessing the admin panel.

## How It Works

1. **Public Access**
   - `/` - Landing/Display page (accessible to everyone)
   - `/login` - Login page (accessible to everyone)

2. **Protected Access**
   - `/admin` - Admin panel (requires login)

3. **Redirects**
   - If a login user visits `/login`, they're redirected to `/admin`
   - If an unauthenticated user visits `/admin`, they're redirected to `/login`

## Setup Instructions

### Step 1: Initialize the Users Table

Run the setup script to create the users table and default admin user:

```bash
cd backend
node setup-auth.js
```

**Output:**
```
✅ Default admin user created

📝 Default credentials:
   Username: admin
   Password: admin123
   Email: admin@masjid.local

⚠️  CHANGE THIS PASSWORD IN PRODUCTION!
```

### Step 2: Start the Server

```bash
npm start
```

### Step 3: Login

1. Open browser to `http://localhost:3000`
2. You'll see either the login page or landing page
3. Click "Login" or go to `/login`
4. Enter credentials:
   - Username: `admin`
   - Password: `admin123`
5. You'll be redirected to `/admin`

## API Endpoints

### Authentication Routes

- **POST** `/api/auth/login` - Login with username and password
  ```json
  {
    "username": "admin",
    "password": "admin123"
  }
  ```

- **POST** `/api/auth/logout` - Logout (destroys session)

- **GET** `/api/auth/check` - Check if authenticated
  ```json
  {
    "authenticated": true,
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@masjid.local"
    }
  }
  ```

- **GET** `/api/auth/me` - Get current user info (requires authentication)

## Using Logout in Admin Page

Add a logout button to your admin page (`admin.html`):

```html
<!-- Include the helper script -->
<script src="auth-helper.js"></script>

<!-- Add logout button -->
<button onclick="logout()" class="btn btn-danger">Logout</button>
```

## JavaScript Helper Functions

Include `auth-helper.js` in your admin page to use these functions:

```javascript
// Logout user
logout(); // Redirects to /login after logout

// Check authentication status
const auth = await checkAuthentication();
// Returns: { authenticated: boolean, user: { id, username, email } }

// Get current user
const user = await getCurrentUser();
// Returns: { id, username, email } or null if not authenticated
```

## Example: Add User Display

In `admin.html`:

```html
<script src="auth-helper.js"></script>

<div id="userInfo"></div>

<script>
  // Display current user
  getCurrentUser().then(user => {
    if (user) {
      document.getElementById('userInfo').innerHTML = `
        Welcome, <strong>${user.username}</strong>! 
        <button onclick="logout()">Logout</button>
      `;
    }
  });
</script>
```

## Database Schema

The `users` table structure:

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL (bcrypt hash),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_email (email)
);
```

## Security Features

✅ **Passwords hashed with bcrypt** - Never stored as plain text  
✅ **Session-based authentication** - Secure cookies (HttpOnly)  
✅ **Protected routes** - Admin page requires login  
✅ **Auto-redirect** - Unauthenticated users sent to login  
✅ **Session timeout** - 24-hour max session duration  

## Production Security Notes

⚠️ **Important:** Before deploying to production:

1. **Change SESSION_SECRET**
   ```bash
   export SESSION_SECRET="your-very-secure-random-string-here"
   ```

2. **Change default admin password**
   - Login with default credentials
   - Create a password change endpoint or update manually in database

3. **Enable HTTPS**
   - Set `NODE_ENV=production` for secure cookies

4. **Create additional users** (optional)
   ```javascript
   // Use the login system or create an admin panel for user management
   ```

## Troubleshooting

### Error: "Cannot POST /api/auth/login"
- Make sure you did `npm start` (not the old server)
- Check that auth routes are imported in server.js

### Error: "No users table"
- Run `node setup-auth.js` to create the users table

### Login appears to work but won't redirect
- Check browser console for errors
- Verify cookies are enabled
- Check if session middleware is working

### Sessions not persisting
- Make sure session config is set up correctly
- Check that express-session is installed

## File Structure Reference

```
backend/
├── config/
│   └── session.js                # Session configuration
├── middleware/
│   └── auth.js                   # Authentication middleware (requireLogin)
├── controllers/
│   └── authController.js         # Login/logout handlers
├── routes/
│   └── auth.js                   # Auth endpoints
├── setup-auth.js                 # Create users table & default user
├── setup-auth.sql                # SQL script alternative
└── public/
    ├── login.html                # Login page (updated)
    └── auth-helper.js            # Client-side helper functions
```

## Next Steps

1. ✅ Setup users table: `node setup-auth.js`
2. ✅ Start server: `npm start`
3. ✅ Test login with default credentials
4. ✅ Add logout button to admin page
5. ✅ Create user management admin panel (optional)
6. ✅ Change default password
7. ✅ Deploy with HTTPS in production

---

Need help? Check the API endpoints in `API_REFERENCE.md`
