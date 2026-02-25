const { pool } = require('../config/database');
const { handleError, handleSuccess } = require('../utils/helpers');
const { broadcast } = require('../utils/broadcast');

exports.getFinances = (req, res) => {
  const { start_date, end_date, type } = req.query;
  let sql = 'SELECT id, type, category, amount, description, transaction_date, created_at FROM finances WHERE 1=1';
  const params = [];

  if (start_date) {
    sql += ' AND transaction_date >= ?';
    params.push(start_date);
  }

  if (end_date) {
    sql += ' AND transaction_date <= ?';
    params.push(end_date);
  }

  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }

  sql += ' ORDER BY transaction_date DESC, created_at DESC';

  pool.query(sql, params, (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch finances');
    handleSuccess(res, results);
  });
};

exports.getFinanceById = (req, res) => {
  const sql = 'SELECT id, type, category, amount, description, transaction_date FROM finances WHERE id = ?';

  pool.query(sql, [req.params.id], (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch finance record');
    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'Finance record not found' });
    }
    handleSuccess(res, results[0]);
  });
};

exports.createFinance = (req, res) => {
  const { type, category, amount, description, transaction_date } = req.body;

  if (!type || !category || !amount || !transaction_date) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const sql = `
    INSERT INTO finances (type, category, amount, description, transaction_date) 
    VALUES (?, ?, ?, ?, ?)
  `;

  pool.query(sql, [type, category, amount, description, transaction_date], (err, result) => {
    if (err) return handleError(res, err, 'Failed to add finance record');

    updateFinanceSummary(transaction_date);
    broadcast('finances_updated', { id: result.insertId });
    handleSuccess(res, { id: result.insertId }, 'Finance record added successfully');
  });
};

exports.updateFinance = (req, res) => {
  const { type, category, amount, description, transaction_date } = req.body;
  const sql = `
    UPDATE finances 
    SET type = ?, category = ?, amount = ?, description = ?, transaction_date = ? 
    WHERE id = ?
  `;

  pool.query(sql, [type, category, amount, description, transaction_date, req.params.id], (err, result) => {
    if (err) return handleError(res, err, 'Failed to update finance record');
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Finance record not found' });
    }

    updateFinanceSummary(transaction_date);
    broadcast('finances_updated', { id: req.params.id });
    handleSuccess(res, { id: req.params.id }, 'Finance record updated successfully');
  });
};

exports.deleteFinance = (req, res) => {
  pool.query('SELECT transaction_date FROM finances WHERE id = ?', [req.params.id], (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch finance record');
    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'Finance record not found' });
    }

    const transactionDate = results[0].transaction_date;

    pool.query('DELETE FROM finances WHERE id = ?', [req.params.id], (err) => {
      if (err) return handleError(res, err, 'Failed to delete finance record');

      updateFinanceSummary(transactionDate);
      broadcast('finances_updated', { id: req.params.id, deleted: true });
      handleSuccess(res, null, 'Finance record deleted successfully');
    });
  });
};

exports.getFinanceSummary = (req, res) => {
  const startDate = req.query.start_date || new Date().toISOString().split('T')[0];

  const summarySQL = `
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'masuk' THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN type = 'keluar' THEN amount ELSE 0 END), 0) as total_expense,
      COALESCE(SUM(CASE WHEN type = 'masuk' THEN amount ELSE -amount END), 0) as balance
    FROM finances 
    WHERE DATE(transaction_date) >= DATE(?)
  `;

  pool.query(summarySQL, [startDate], (err, results) => {
    if (err) {
      console.error('❌ Error calculating finance summary:', err.message);
      return res.status(500).json({ error: "Database error" });
    }

    const summary = results[0] || { total_income: 0, total_expense: 0, balance: 0 };
    res.status(200).json(summary);
  });
};

function updateFinanceSummary(date) {
  const summarySQL = `
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'masuk' THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN type = 'keluar' THEN amount ELSE 0 END), 0) as total_expense,
      COALESCE(SUM(CASE WHEN type = 'masuk' THEN amount ELSE -amount END), 0) as balance
    FROM finances 
    WHERE DATE(transaction_date) = DATE(?)
  `;

  pool.query(summarySQL, [date], (err, results) => {
    if (err) {
      console.error('Error calculating finance summary:', err);
      return;
    }

    const summary = results[0] || { total_income: 0, total_expense: 0, balance: 0 };

    const insertSQL = `
      INSERT INTO finance_summary (date, total_income, total_expense, balance) 
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        total_income = VALUES(total_income),
        total_expense = VALUES(total_expense),
        balance = VALUES(balance),
        updated_at = CURRENT_TIMESTAMP
    `;

    pool.query(insertSQL, [date, summary.total_income, summary.total_expense, summary.balance], (err) => {
      if (err) {
        console.error('Error updating finance summary:', err);
      } else {
        broadcast('finance_summary_updated', { date });
      }
    });
  });
}
