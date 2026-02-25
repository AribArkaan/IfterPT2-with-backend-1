# 📚 API Endpoints Reference

## Settings
- GET    `/api/settings` - Get all settings
- GET    `/api/settings/:key` - Get specific setting
- PUT    `/api/settings/:key` - Update setting
- POST   `/api/settings/bulk` - Update multiple settings
- GET    `/api/settings/finance_display` - Get finance display status
- PUT    `/api/settings/finance_display` - Update finance display

## Prayer Times
- GET    `/api/prayer-times` - Get all prayer times
- GET    `/api/prayer-times/:id` - Get specific prayer time
- PUT    `/api/prayer-times/:id` - Update prayer time
- POST   `/api/prayer-times/bulk` - Update multiple prayer times
- GET    `/api/prayer-times/imsak/time` - Get imsak time (10 min before Subuh)
- GET    `/api/prayer-times/ramadhan/mode` - Check ramadhan mode
- PUT    `/api/prayer-times/ramadhan/mode` - Update ramadhan mode

## Iqomah Times
- GET    `/api/iqomah/times` - Get all iqomah times
- PUT    `/api/iqomah/times/:id` - Update iqomah time
- GET    `/api/iqomah/settings` - Get iqomah settings

## Running Text
- GET    `/api/running-text` - Get all running text
- GET    `/api/running-text/:id` - Get specific running text
- POST   `/api/running-text` - Create new running text
- PUT    `/api/running-text/:id` - Update running text
- DELETE `/api/running-text/:id` - Delete running text

## Iqomah Running Text
- GET    `/api/iqomah-running-text` - Get all iqomah running text
- GET    `/api/iqomah-running-text/:id` - Get specific iqomah running text
- POST   `/api/iqomah-running-text` - Create new iqomah running text
- PUT    `/api/iqomah-running-text/:id` - Update iqomah running text
- DELETE `/api/iqomah-running-text/:id` - Delete iqomah running text

## Content
- GET    `/api/content` - Get all content
- GET    `/api/content/:id` - Get specific content
- POST   `/api/content` - Create new content
- PUT    `/api/content/:id` - Update content
- DELETE `/api/content/:id` - Delete content

## Events
- GET    `/api/events` - Get upcoming events (add ?include_expired=true for all)
- GET    `/api/events/:id` - Get specific event
- POST   `/api/events` - Create new event
- PUT    `/api/events/:id` - Update event
- DELETE `/api/events/:id` - Delete event
- POST   `/api/events/cleanup/expired` - Manually delete expired events

## Finances
- GET    `/api/finances` - Get finances (supports ?start_date, ?end_date, ?type filters)
- GET    `/api/finances/:id` - Get specific finance record
- GET    `/api/finances/summary` - Get finance summary (income, expense, balance)
- POST   `/api/finances` - Create new finance record
- PUT    `/api/finances/:id` - Update finance record
- DELETE `/api/finances/:id` - Delete finance record

## File Upload
- POST   `/api/upload` - Upload file (returns file path)

## Health Check
- GET    `/api/health` - Check server and database status

## Static Pages
- GET    `/` - Landing page (index.html)
- GET    `/admin` - Admin page (admin.html)

## WebSocket
- ws://localhost:3000 - Real-time updates for all clients

---

### Project Structure
```
backend/
├── config/database.js              # DB connection
├── middleware/errorHandler.js      # Error handling
├── utils/
│   ├── helpers.js                  # Helper functions
│   ├── broadcast.js                # WebSocket broadcast
│   ├── fileUpload.js               # File upload config
│   └── eventCleanup.js             # Periodic cleanup
├── controllers/
│   ├── settingsController.js
│   ├── prayerTimesController.js
│   ├── contentController.js
│   ├── iqomahController.js
│   ├── iqomahRunningTextController.js
│   ├── runningTextController.js
│   ├── eventsController.js
│   └── financesController.js
├── routes/
│   ├── settings.js
│   ├── prayerTimes.js
│   ├── content.js
│   ├── iqomah.js
│   ├── iqomahRunningText.js
│   ├── runningText.js
│   ├── events.js
│   ├── finances.js
│   └── upload.js
└── server.js (or server-new.js - the clean modular version)
```
