# 🔄 Migration Guide: From Monolithic to Modular

## What Changed?

Your original `server.js` (1167 lines) has been refactored into a clean, modular architecture:

### Before (Monolithic)
```
server.js (1167 lines)
├── Database setup
├── WebSocket setup  
├── Middleware
├── 8+ route handlers inline
├── Controllers mixed with routes
└── Everything in one file ❌
```

### After (Modular)
```
server.js (Clean ~70 lines) ✅
├── config/database.js
├── middleware/errorHandler.js
├── utils/ (helpers, broadcast, fileUpload, eventCleanup)
├── controllers/ (8 feature-specific controllers)
└── routes/ (8 feature-specific route files)
```

## Quick Start

### Option 1: Automatic Migration (Recommended)

```bash
# Backup the old server
mv backend/server.js backend/server.old.js

# Use the new modular version
mv backend/server-new.js backend/server.js

# Start the server
npm start
```

### Option 2: Manual Step-by-Step

1. **Backup original**
   ```bash
   cp backend/server.js backend/server.backup.js
   ```

2. **Copy new files** (if not already created)
   - All files in `config/`, `controllers/`, `routes/`, `utils/`, `middleware/` are already created

3. **Replace server.js**
   ```bash
   cp backend/server-new.js backend/server.js
   ```

4. **Verify dependencies are installed**
   ```bash
   npm install
   ```

5. **Start!**
   ```bash
   npm start
   ```

## What Stays the Same?

✅ **All existing API endpoints work exactly the same**
✅ **Database queries unchanged**
✅ **WebSocket functionality preserved**
✅ **File upload system unchanged**
✅ **Auto-cleanup of expired events (now in separate utility)**

## API Endpoints (No Changes Needed in Frontend)

All your frontend code will work without modification:
- `/api/settings/*`
- `/api/prayer-times/*`
- `/api/content/*`
- `/api/iqomah/*`
- `/api/running-text/*`
- `/api/iqomah-running-text/*`
- `/api/events/*`
- `/api/finances/*`
- `/api/upload`
- `/api/health`
- `ws://localhost:3000` (WebSocket)

## File Structure Reference

### Config
- **config/database.js** - Database connection pool setup

### Utilities  
- **utils/helpers.js** - `handleError()`, `handleSuccess()`, `checkIfRamadhan()`
- **utils/broadcast.js** - WebSocket client management
- **utils/fileUpload.js** - Multer configuration
- **utils/eventCleanup.js** - Periodic event cleanup task

### Middleware
- **middleware/errorHandler.js** - Global error handler

### Controllers (Business Logic)
- **controllers/settingsController.js**
- **controllers/prayerTimesController.js**
- **controllers/iqomahController.js**
- **controllers/runningTextController.js**
- **controllers/iqomahRunningTextController.js**
- **controllers/contentController.js**
- **controllers/eventsController.js**
- **controllers/financesController.js**

### Routes (Endpoint Definitions)
- **routes/settings.js**
- **routes/prayerTimes.js**
- **routes/iqomah.js**
- **routes/runningText.js**
- **routes/iqomahRunningText.js**
- **routes/content.js**
- **routes/events.js**
- **routes/finances.js**
- **routes/upload.js**

## Troubleshooting

### Error: Cannot find module
Make sure you're in the `backend/` directory and all files are created:
```bash
ls config/
ls controllers/
ls routes/
ls utils/
ls middleware/
```

### Error: port 3000 already in use
Kill existing Node process:
```bash
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force
```

Or use a different port:
```bash
$env:PORT = 3001; npm start
```

### API endpoints not working
Check that all routes are imported in `server.js`:
```javascript
app.use('/api/settings', settingsRouter);
app.use('/api/prayer-times', prayerTimesRouter);
// etc...
```

## Adding New Features

### Example: Add a new "Announcements" feature

**1. Create controller** (`controllers/announcementsController.js`):
```javascript
const { pool } = require('../config/database');
const { handleError, handleSuccess } = require('../utils/helpers');
const { broadcast } = require('../utils/broadcast');

exports.getAnnouncements = (req, res) => {
  const sql = 'SELECT * FROM announcements ORDER BY created_at DESC';
  pool.query(sql, (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch announcements');
    handleSuccess(res, results);
  });
};

exports.createAnnouncement = (req, res) => {
  const { title, message } = req.body;
  const sql = 'INSERT INTO announcements (title, message) VALUES (?, ?)';
  pool.query(sql, [title, message], (err, result) => {
    if (err) return handleError(res, err, 'Failed to create announcement');
    broadcast('announcement_created', { id: result.insertId });
    handleSuccess(res, { id: result.insertId }, 'Announcement created');
  });
};
```

**2. Create route** (`routes/announcements.js`):
```javascript
const express = require('express');
const router = express.Router();
const announcementsController = require('../controllers/announcementsController');

router.get('/', announcementsController.getAnnouncements);
router.post('/', announcementsController.createAnnouncement);

module.exports = router;
```

**3. Add to server.js**:
```javascript
const announcementsRouter = require('./routes/announcements');
app.use('/api/announcements', announcementsRouter);
```

Done! 🎉

## Reverting to Original

If you need to go back to the old monolithic version:
```bash
cp backend/server.backup.js backend/server.js
npm start
```

## Performance Notes

✅ **Same performance** - Refactoring doesn't improve/slow performance  
✅ **Better maintainability** - Easier to debug and add features  
✅ **Scalability** - Easier to expand as project grows  
✅ **Code reuse** - Utilities can be used across controllers  

---

**Questions?** Check `API_REFERENCE.md` for complete endpoint documentation.
