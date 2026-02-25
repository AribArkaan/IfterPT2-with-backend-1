const { pool } = require('../config/database');
const { handleError, handleSuccess } = require('../utils/helpers');
const { broadcast } = require('../utils/broadcast');

exports.getIqomahRunningText = (req, res) => {
  const sql = 'SELECT id, text, font_family, font_size, speed, is_active, display_order, created_at FROM iqomah_running_text ORDER BY display_order, id';

  pool.query(sql, (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch iqomah running texts');
    handleSuccess(res, results);
  });
};

exports.getIqomahRunningTextById = (req, res) => {
  const sql = 'SELECT id, text, font_family, font_size, speed, is_active, display_order FROM iqomah_running_text WHERE id = ?';

  pool.query(sql, [req.params.id], (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch iqomah running text');
    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'Iqomah running text not found' });
    }
    handleSuccess(res, results[0]);
  });
};

exports.createIqomahRunningText = (req, res) => {
  const { text, font_family, font_size, speed, is_active, display_order } = req.body;

  if (!text || !font_family) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const sql = `
    INSERT INTO iqomah_running_text (text, font_family, font_size, speed, is_active, display_order) 
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  pool.query(sql, [text, font_family, font_size || 16, speed || 30, is_active ? 1 : 0, display_order || 0], (err, result) => {
    if (err) return handleError(res, err, 'Failed to add iqomah running text');
    broadcast('iqomah_running_text_updated', { id: result.insertId });
    handleSuccess(res, { id: result.insertId }, 'Iqomah running text added successfully');
  });
};

exports.updateIqomahRunningText = (req, res) => {
  const { text, font_family, font_size, speed, is_active, display_order } = req.body;
  const sql = `
    UPDATE iqomah_running_text 
    SET text = ?, font_family = ?, font_size = ?, speed = ?, is_active = ?, display_order = ? 
    WHERE id = ?
  `;

  pool.query(sql, [text, font_family, font_size, speed, is_active ? 1 : 0, display_order || 0, req.params.id], (err, result) => {
    if (err) return handleError(res, err, 'Failed to update iqomah running text');
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Iqomah running text not found' });
    }
    broadcast('iqomah_running_text_updated', { id: req.params.id });
    handleSuccess(res, { id: req.params.id }, 'Iqomah running text updated successfully');
  });
};

exports.deleteIqomahRunningText = (req, res) => {
  const sql = 'DELETE FROM iqomah_running_text WHERE id = ?';

  pool.query(sql, [req.params.id], (err, result) => {
    if (err) return handleError(res, err, 'Failed to delete iqomah running text');
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Iqomah running text not found' });
    }
    broadcast('iqomah_running_text_updated', { id: req.params.id, deleted: true });
    handleSuccess(res, null, 'Iqomah running text deleted successfully');
  });
};
