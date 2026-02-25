# 🚀 Quick Start: Login Authentication

## What Was Added?

I've implemented a complete login/authentication system for your app:

✅ **Login page** - Required before accessing admin panel  
✅ **User table** - Stores credentials with bcrypt-hashed passwords  
✅ **Session management** - Secure session-based authentication  
✅ **Protected routes** - `/admin` requires login  
✅ **Auto-redirects** - Unauthenticated users sent to login  

## How to Set Up (3 Steps)

### Step 1: Initialize Authentication

```bash
cd backend
npm run setup-auth
```

**What it does:**
- Creates `users` table in your database
- Creates default admin account

**Output:**
```
✅ Default admin user created

📝 Default credentials:
   Username: admin
   Password: admin123
   Email: admin@masjid.local
```

### Step 2: Start the Server

```bash
npm start
```

The server will start with **authentication enabled**.

### Step 3: Access the App

1. Open `http://localhost:3000` (or your IP)
2. You'll see the **login page** (or redirect to login if not authenticated)
3. Enter:
   - Username: `admin`
   - Password: `admin123`
4. Click **Login**
5. You'll be redirected to `/admin` after successful login

## Page Access Rules

| URL | Status | Notes |
|-----|--------|-------|
| `/` | Public | Landing/display page (accessible to everyone) |
| `/login` | Public | Login page (if already logged in, redirects to /admin) |
| `/admin` | Private | Admin panel (**requires login**) |

## Add Logout Button to Admin

To add a logout button, include this in your `admin.html`:

```html
<!-- Add at the end of admin.html before closing body tag -->
<script src="auth-helper.js"></script>

<!-- Add this button where you want logout -->
<button onclick="logout()" class="btn btn-danger">Logout</button>

<!-- Or show current user: -->
<script>
  getCurrentUser().then(user => {
    if (user) {
      console.log('Logged in as:', user.username);
      document.getElementById('username-display').textContent = user.username;
    }
  });
</script>
<p>Welcome, <span id="username-display"></span>!</p>
```

## File Structure

New files created:

```
backend/
├── config/
│   └── session.js                    # Session config
├── middleware/
│   └── auth.js                       # Auth middleware
├── controllers/
│   └── authController.js             # Login logic
├── routes/
│   └── auth.js                       # Auth endpoints
├── setup-auth.js                     # Create users & default admin
├── setup-complete.js                 # Easy setup runner
├── public/
│   ├── login.html                    # Login page (updated)
│   └── auth-helper.js                # JS helper functions
├── AUTH_GUIDE.md                     # Detailed guide
└── server.js                         # Updated with auth
```

## API Endpoints

```
POST   /api/auth/login   - Login (body: {username, password})
POST   /api/auth/logout  - Logout
GET    /api/auth/check   - Check if authenticated
GET    /api/auth/me      - Get current user info
```

## JavaScript Functions (use in admin.html)

```javascript
// In your admin.html, include: <script src="auth-helper.js"></script>

// Logout and redirect to login
logout();

// Check if user is authenticated
const auth = await checkAuthentication();
// Returns: { authenticated: true/false, user: {...} }

// Get current user details
const user = await getCurrentUser();
// Returns: { id: 1, username: 'admin', email: '...' }
```

## Default Credentials

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin123` |
| Email | `admin@masjid.local` |

⚠️ **CHANGE THIS PASSWORD** after first login!

## What If Something Goes Wrong?

### Error: "Cannot POST /api/auth/login"
```bash
# Make sure you're running the current server
npm start
# (not an old version)
```

### Error: "No such table: users"
```bash
# Create the users table:
npm run setup-auth
```

### Want to reset everything?
```bash
# Delete users table and recreate:
node setup-auth.js
```

### Forgot admin password?
Reset by running:
```bash
node setup-auth.js
# This will show the default admin credentials
```

## How It Works (Behind the Scenes)

1. **Browser requests `/admin`**
2. **Server checks if user has valid session**
3. **If no session → redirect to `/login`**
4. **User enters credentials on login page**
5. **JS sends POST to `/api/auth/login`**
6. **Server checks database, compares password with bcrypt**
7. **If valid → creates session cookie**
8. **Browser redirects to `/admin`**
9. **User can now access admin panel**

## Security Features

✅ Passwords hashed with bcrypt (not plain text)  
✅ Sessions stored server-side (secure)  
✅ httpOnly cookies (can't be accessed by JavaScript)  
✅ Session timeout (24 hours)  
✅ Auto-logout after timeout  

## Next: Add More Users

To add additional admin users, create a management page or use PHP/SQL directly:

```sql
-- Add new user manually (replace password hash)
INSERT INTO users (username, email, password) VALUES (
  'manager',
  'manager@masjid.local',
  BCRYPT_HASH_OF_PASSWORD_HERE
);
```

Or create an admin user management panel in your system.

## Documentation Files

- **AUTH_GUIDE.md** - Complete authentication documentation
- **API_REFERENCE.md** - All API endpoints
- **MIGRATION_GUIDE.md** - How the modular structure works

---

**Ready?** Run:
```bash
npm run setup-auth && npm start
```

Then visit `http://localhost:3000/login` 🔐
