const { pool } = require('../config/database');
const { handleError, handleSuccess } = require('../utils/helpers');
const { broadcast } = require('../utils/broadcast');

exports.getRunningText = (req, res) => {
  const sql = 'SELECT id, text, font_family, font_size, speed, is_active, created_at FROM running_text ORDER BY id';

  pool.query(sql, (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch running texts');
    handleSuccess(res, results);
  });
};

exports.getRunningTextById = (req, res) => {
  const sql = 'SELECT id, text, font_family, font_size, speed, is_active FROM running_text WHERE id = ?';
  pool.query(sql, [req.params.id], (err, results) => {
    if (err) return handleError(res, err, 'Database error');
    if (results.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
    handleSuccess(res, results[0]);
  });
};

exports.createRunningText = (req, res) => {
  const { text, font_family, font_size, speed, is_active } = req.body;

  if (!text || !font_family) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const sql = `
    INSERT INTO running_text (text, font_family, font_size, speed, is_active) 
    VALUES (?, ?, ?, ?, ?)
  `;

  pool.query(sql, [text, font_family, font_size || 16, speed || 30, is_active ? 1 : 0], (err, result) => {
    if (err) return handleError(res, err, 'Failed to add running text');
    broadcast('running_text_updated', { id: result.insertId });
    handleSuccess(res, { id: result.insertId }, 'Running text added successfully');
  });
};

exports.updateRunningText = (req, res) => {
  const { text, font_family, font_size, speed, is_active } = req.body;
  const sql = `
    UPDATE running_text 
    SET text = ?, font_family = ?, font_size = ?, speed = ?, is_active = ? 
    WHERE id = ?
  `;

  pool.query(sql, [text, font_family, font_size, speed, is_active ? 1 : 0, req.params.id], (err, result) => {
    if (err) return handleError(res, err, 'Failed to update running text');
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Running text not found' });
    }
    broadcast('running_text_updated', { id: req.params.id });
    handleSuccess(res, { id: req.params.id }, 'Running text updated successfully');
  });
};

exports.deleteRunningText = (req, res) => {
  const sql = 'DELETE FROM running_text WHERE id = ?';

  pool.query(sql, [req.params.id], (err, result) => {
    if (err) return handleError(res, err, 'Failed to delete running text');
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Running text not found' });
    }
    broadcast('running_text_updated', { id: req.params.id, deleted: true });
    handleSuccess(res, null, 'Running text deleted successfully');
  });
};
