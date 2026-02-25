const { pool } = require('../config/database');
const { handleError, handleSuccess } = require('../utils/helpers');
const { broadcast } = require('../utils/broadcast');

exports.getEvents = (req, res) => {
  const includeExpired = req.query.include_expired === 'true';

  let sql = 'SELECT id, title, description, target_date, is_active, created_at, updated_at FROM events';

  if (!includeExpired) {
    sql += ' WHERE DATE(target_date) >= CURDATE()';
  }

  sql += ' ORDER BY target_date ASC';

  pool.query(sql, (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch events');
    handleSuccess(res, results);
  });
};

exports.getEventById = (req, res) => {
  const sql = 'SELECT id, title, description, target_date, is_active FROM events WHERE id = ?';
  pool.query(sql, [req.params.id], (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch event');
    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    handleSuccess(res, results[0]);
  });
};

exports.createEvent = (req, res) => {
  const { title, description, target_date, is_active } = req.body;

  if (!title || !target_date) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const sql = `
    INSERT INTO events (title, description, target_date, is_active) 
    VALUES (?, ?, ?, ?)
  `;

  pool.query(sql, [title, description, target_date, is_active ? 1 : 0], (err, result) => {
    if (err) return handleError(res, err, 'Failed to add event');
    broadcast('events_updated', { id: result.insertId });
    handleSuccess(res, { id: result.insertId }, 'Event added successfully');
  });
};

exports.updateEvent = (req, res) => {
  const { title, description, target_date, is_active } = req.body;
  const sql = `
    UPDATE events 
    SET title = ?, description = ?, target_date = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  pool.query(sql, [title, description, target_date, is_active ? 1 : 0, req.params.id], (err, result) => {
    if (err) return handleError(res, err, 'Failed to update event');
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    broadcast('events_updated', { id: req.params.id });
    handleSuccess(res, { id: req.params.id }, 'Event updated successfully');
  });
};

exports.deleteEvent = (req, res) => {
  const sql = 'DELETE FROM events WHERE id = ?';

  pool.query(sql, [req.params.id], (err, result) => {
    if (err) return handleError(res, err, 'Failed to delete event');
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    broadcast('events_updated', { id: req.params.id, deleted: true });
    handleSuccess(res, null, 'Event deleted successfully');
  });
};

exports.deleteExpiredEvents = (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sql = 'DELETE FROM events WHERE DATE(target_date) < DATE(?)';

  pool.query(sql, [today], (err, result) => {
    if (err) {
      return handleError(res, err, 'Failed to delete expired events');
    }

    if (result.affectedRows > 0) {
      console.log(`🗑️  Deleted ${result.affectedRows} expired event(s)`);
      broadcast('events_updated', {
        type: 'auto_deleted',
        count: result.affectedRows,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: `Deleted ${result.affectedRows} expired event(s)`,
      deletedCount: result.affectedRows
    });
  });
};
