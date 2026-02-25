const { pool } = require('../config/database');
const { broadcast } = require('./broadcast');

/**
 * Delete expired events from database
 * Call this periodically to clean up old events
 */
function deleteExpiredEvents() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sql = 'DELETE FROM events WHERE DATE(target_date) < DATE(?)';

  pool.query(sql, [today], (err, result) => {
    if (err) {
      console.error('❌ Error deleting expired events:', err);
      return;
    }

    if (result.affectedRows > 0) {
      console.log(`🗑️  Auto-deleted ${result.affectedRows} expired event(s)`);
      broadcast('events_updated', {
        type: 'auto_deleted',
        count: result.affectedRows,
        timestamp: new Date().toISOString()
      });
    }
  });
}

/**
 * Start periodic cleanup task
 * Runs every 1 hour by default
 */
function startPeriodicCleanup(intervalMs = 60 * 60 * 1000) {
  console.log('🔄 Started periodic event cleanup task');
  
  // Run immediately on startup
  deleteExpiredEvents();
  
  // Then run at specified interval
  setInterval(deleteExpiredEvents, intervalMs);
}

module.exports = {
  deleteExpiredEvents,
  startPeriodicCleanup
};
