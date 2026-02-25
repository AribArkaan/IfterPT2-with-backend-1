const { pool } = require('../config/database');
const { handleError, handleSuccess, checkIfRamadhan } = require('../utils/helpers');
const { broadcast } = require('../utils/broadcast');

exports.getAllPrayerTimes = (req, res) => {
  const sql = 'SELECT id, prayer_name, time, ihtiyat, updated_at FROM prayer_times ORDER BY id';

  pool.query(sql, (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch prayer times');
    handleSuccess(res, results);
  });
};

exports.getPrayerTime = (req, res) => {
  const sql = 'SELECT id, prayer_name, time, ihtiyat, updated_at FROM prayer_times WHERE id = ?';

  pool.query(sql, [req.params.id], (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch prayer time');
    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'Prayer time not found' });
    }
    handleSuccess(res, results[0]);
  });
};

exports.updatePrayerTime = (req, res) => {
  const { prayer_name, time, ihtiyat } = req.body;
  const sql = 'UPDATE prayer_times SET prayer_name = ?, time = ?, ihtiyat = ? WHERE id = ?';

  pool.query(sql, [prayer_name, time, ihtiyat, req.params.id], (err, result) => {
    if (err) return handleError(res, err, 'Failed to update prayer time');
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Prayer time not found' });
    }
    broadcast('prayer_times_updated', { id: req.params.id, prayer_name, time, ihtiyat });
    handleSuccess(res, { id: req.params.id, prayer_name, time, ihtiyat }, 'Prayer time updated successfully');
  });
};

exports.updateBulkPrayerTimes = (req, res) => {
  const { prayers } = req.body;

  if (!Array.isArray(prayers) || prayers.length === 0) {
    return res.status(400).json({ success: false, error: 'Invalid prayer times data' });
  }

  pool.getConnection((err, connection) => {
    if (err) return handleError(res, err, 'Database connection failed');

    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        return handleError(res, err, 'Failed to start transaction');
      }

      let completed = 0;
      let hasError = false;

      prayers.forEach((prayer) => {
        const sql = 'UPDATE prayer_times SET time = ?, ihtiyat = ? WHERE prayer_name = ?';
        connection.query(sql, [prayer.time, prayer.ihtiyat, prayer.prayer_name], (err) => {
          if (err && !hasError) {
            hasError = true;
            connection.rollback(() => {
              connection.release();
              handleError(res, err, 'Failed to update prayer times');
            });
            return;
          }

          completed++;
          if (completed === prayers.length && !hasError) {
            connection.commit((err) => {
              if (err) {
                connection.rollback(() => {
                  connection.release();
                  handleError(res, err, 'Failed to commit transaction');
                });
                return;
              }

              connection.release();
              broadcast('prayer_times_updated', prayers);
              handleSuccess(res, prayers, 'Prayer times updated successfully');
            });
          }
        });
      });
    });
  });
};

exports.getImsakTime = (req, res) => {
  const sql = `
    SELECT 
      time as subuh_time,
      SUBSTRING_INDEX(time, ':', 1) as subuh_hour,
      SUBSTRING_INDEX(time, ':', -1) as subuh_minute
    FROM prayer_times 
    WHERE prayer_name = 'Subuh'
    LIMIT 1
  `;

  pool.query(sql, (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch subuh time');

    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'Subuh time not found' });
    }

    const subuhTime = results[0].subuh_time;
    const [hours, minutes] = subuhTime.split(':').map(Number);

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    date.setMinutes(date.getMinutes() - 10);

    const imsakHour = String(date.getHours()).padStart(2, '0');
    const imsakMinute = String(date.getMinutes()).padStart(2, '0');
    const imsakTime = `${imsakHour}:${imsakMinute}`;

    const isRamadhan = checkIfRamadhan();

    res.json({
      success: true,
      data: {
        imsak_time: imsakTime,
        subuh_time: subuhTime,
        is_active: isRamadhan,
        display_message: isRamadhan ? `Imsak ${imsakTime} (10 menit sebelum Subuh)` : null
      }
    });
  });
};

exports.getRamadhanMode = (req, res) => {
  const sql = 'SELECT setting_value FROM settings WHERE setting_key = "ramadhan_mode"';

  pool.query(sql, (err, results) => {
    if (err) {
      console.error('Error checking ramadhan mode:', err);
      return res.json({ isRamadhan: false });
    }

    const isRamadhan = results.length > 0 ? results[0].setting_value === '1' : false;
    res.json({ isRamadhan });
  });
};

exports.updateRamadhanMode = (req, res) => {
  const { enabled } = req.body;
  const value = enabled ? '1' : '0';

  const sql = `
    INSERT INTO settings (setting_key, setting_value) 
    VALUES ('ramadhan_mode', ?)
    ON DUPLICATE KEY UPDATE setting_value = ?
  `;

  pool.query(sql, [value, value], (err) => {
    if (err) return handleError(res, err, 'Failed to update ramadhan mode');

    broadcast('ramadhan_mode_updated', { enabled });
    handleSuccess(res, { enabled }, 'Ramadhan mode updated');
  });
};
