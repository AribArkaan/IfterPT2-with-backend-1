const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');

// Get all settings
router.get('/', settingsController.getAllSettings);

// Get specific setting
router.get('/:key', settingsController.getSetting);

// Get finance display setting
router.get('/finance_display', settingsController.getFinanceDisplay);

// Update specific setting
router.put('/:key', settingsController.updateSetting);

// Update finance display setting
router.put('/finance_display', settingsController.updateFinanceDisplay);

// Update bulk settings
router.post('/bulk', settingsController.updateBulkSettings);

module.exports = router;
