const { pool } = require('../config/database');
const { handleError, handleSuccess } = require('../utils/helpers');
const { broadcast } = require('../utils/broadcast');

exports.getContent = (req, res) => {
  const sql = 'SELECT id, title, content_text, content_type, image_url, video_url, display_order, is_active, created_at, updated_at FROM content ORDER BY display_order, id';

  pool.query(sql, (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch content');
    handleSuccess(res, results);
  });
};

exports.getContentById = (req, res) => {
  const sql = 'SELECT id, title, content_text, content_type, image_url, video_url, display_order, is_active, created_at, updated_at FROM content WHERE id = ?';

  pool.query(sql, [req.params.id], (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch content');
    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'Content not found' });
    }
    handleSuccess(res, results[0]);
  });
};

exports.createContent = (req, res) => {
  const { title, content_text, content_type, image_url, video_url, display_order, is_active } = req.body;

  if (!title) {
    return res.status(400).json({ success: false, error: 'Title is required' });
  }

  const sql = `
    INSERT INTO content (title, content_text, content_type, image_url, video_url, display_order, is_active) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  pool.query(sql, [title, content_text || null, content_type || 'text', image_url || null, video_url || null, display_order || 0, is_active ? 1 : 0], (err, result) => {
    if (err) return handleError(res, err, 'Failed to add content');
    broadcast('content_updated', { id: result.insertId });
    handleSuccess(res, { id: result.insertId }, 'Content added successfully');
  });
};

exports.updateContent = (req, res) => {
  const { title, content_text, content_type, image_url, video_url, display_order, is_active } = req.body;
  const sql = `
    UPDATE content 
    SET title = ?, content_text = ?, content_type = ?, image_url = ?, video_url = ?, display_order = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  pool.query(sql, [title, content_text || null, content_type || 'text', image_url || null, video_url || null, display_order || 0, is_active ? 1 : 0, req.params.id], (err, result) => {
    if (err) return handleError(res, err, 'Failed to update content');
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Content not found' });
    }
    broadcast('content_updated', { id: req.params.id });
    handleSuccess(res, { id: req.params.id }, 'Content updated successfully');
  });
};

exports.deleteContent = (req, res) => {
  const sql = 'DELETE FROM content WHERE id = ?';

  pool.query(sql, [req.params.id], (err, result) => {
    if (err) return handleError(res, err, 'Failed to delete content');
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Content not found' });
    }
    broadcast('content_updated', { id: req.params.id, deleted: true });
    handleSuccess(res, null, 'Content deleted successfully');
  });
};
