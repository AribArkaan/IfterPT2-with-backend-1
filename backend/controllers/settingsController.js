const { pool } = require('../config/database');
const { handleError, handleSuccess } = require('../utils/helpers');
const { broadcast } = require('../utils/broadcast');

// Get all settings
exports.getAllSettings = (req, res) => {
  const sql = 'SELECT setting_key, setting_value, updated_at FROM settings ORDER BY setting_key';

  pool.query(sql, (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch settings');
    handleSuccess(res, results);
  });
};

// Get specific setting
exports.getSetting = (req, res) => {
  const sql = 'SELECT setting_key, setting_value, updated_at FROM settings WHERE setting_key = ?';

  pool.query(sql, [req.params.key], (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch setting');
    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'Setting not found' });
    }
    handleSuccess(res, results[0]);
  });
};

// Update single setting
exports.updateSetting = (req, res) => {
  const { key } = req.params;
  const { setting_value } = req.body;

  if (setting_value === undefined) {
    return res.status(400).json({
      success: false,
      error: "setting_value is required in request body"
    });
  }

  const query = `
    INSERT INTO settings (setting_key, setting_value) 
    VALUES (?, ?) 
    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
  `;

  pool.query(query, [key, setting_value], (err) => {
    if (err) {
      console.error(`❌ Error updating setting '${key}':`, err.message);
      return res.status(500).json({
        success: false,
        error: "Failed to update setting in database",
        details: err.message
      });
    }

    res.status(200).json({
      success: true,
      message: `Setting '${key}' updated successfully`,
      data: {
        setting_key: key,
        setting_value: setting_value
      }
    });
  });
};

// Get finance display setting
exports.getFinanceDisplay = (req, res) => {
  const sql = 'SELECT setting_value FROM settings WHERE setting_key = "finance_display"';

  pool.query(sql, (err, results) => {
    if (err) {
      console.error('❌ Error fetching finance display:', err);
      return handleError(res, err, 'Failed to fetch finance display setting');
    }
    const value = results.length > 0 ? results[0].setting_value : '1';
    handleSuccess(res, { finance_display: value === '1' });
  });
};

// Update finance display setting
exports.updateFinanceDisplay = (req, res) => {
  const incomingValue = req.body.setting_value !== undefined ? req.body.setting_value : req.body.enabled;

  if (incomingValue === undefined || incomingValue === null) {
    return res.status(400).json({ success: false, error: 'Missing setting_value field' });
  }

  const value = (incomingValue === true || incomingValue === '1' || incomingValue === 1) ? '1' : '0';

  const sql = `
    INSERT INTO settings (setting_key, setting_value) 
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE setting_value = ?
  `;

  pool.query(sql, ['finance_display', value, value], (err, result) => {
    if (err) {
      console.error('❌ Error updating finance display:', err);
      return res.status(500).json({ success: false, error: 'Failed to update setting', details: err.message });
    }

    broadcast('settings_updated', {
      key: 'finance_display',
      value: value
    });

    handleSuccess(res, { finance_display: value === '1' }, 'Setting updated successfully');
  });
};

// Update bulk settings
exports.updateBulkSettings = (req, res) => {
  const { settings } = req.body;

  if (!Array.isArray(settings) || settings.length === 0) {
    return res.status(400).json({ success: false, error: 'Invalid settings data' });
  }

  const sql = `
    INSERT INTO settings (setting_key, setting_value) 
    VALUES ? 
    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
  `;

  const values = settings.map(s => [s.key, s.value]);

  pool.query(sql, [values], (err) => {
    if (err) return handleError(res, err, 'Failed to update settings');
    broadcast('settings_updated', settings);
    handleSuccess(res, settings, 'Settings updated successfully');
  });
};
