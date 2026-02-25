const { pool } = require('../config/database');
const { handleError, handleSuccess } = require('../utils/helpers');
const { broadcast } = require('../utils/broadcast');

exports.getIqomahTimes = (req, res) => {
  const sql = 'SELECT id, prayer_name, minutes, updated_at FROM iqomah_times ORDER BY id';

  pool.query(sql, (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch iqomah times');
    handleSuccess(res, results);
  });
};

exports.updateIqomahTime = (req, res) => {
  const { minutes } = req.body;
  const sql = 'UPDATE iqomah_times SET minutes = ? WHERE id = ?';

  pool.query(sql, [minutes, req.params.id], (err, result) => {
    if (err) return handleError(res, err, 'Failed to update iqomah time');

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Iqomah time not found' });
    }

    broadcast('iqomah_times_updated', { id: req.params.id, minutes });
    handleSuccess(res, { id: req.params.id, minutes }, 'Iqomah time updated successfully');
  });
};

exports.getIqomahSettings = (req, res) => {
  const sql = 'SELECT setting_key, setting_value FROM settings WHERE setting_key IN ("iqomah_default", "iqomah_duration", "adzan_redirect_minutes")';

  pool.query(sql, (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch iqomah settings');

    const settings = {};
    results.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });

    handleSuccess(res, settings);
  });
};
