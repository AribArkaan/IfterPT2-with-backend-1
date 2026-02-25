const express = require('express');
const router = express.Router();
const prayerTimesController = require('../controllers/prayerTimesController');

// Prayer times routes
router.get('/', prayerTimesController.getAllPrayerTimes);
router.get('/:id', prayerTimesController.getPrayerTime);
router.put('/:id', prayerTimesController.updatePrayerTime);
router.post('/bulk', prayerTimesController.updateBulkPrayerTimes);

// Imsak time route
router.get('/imsak/time', prayerTimesController.getImsakTime);

// Ramadhan mode routes
router.get('/ramadhan/mode', prayerTimesController.getRamadhanMode);
router.put('/ramadhan/mode', prayerTimesController.updateRamadhanMode);

module.exports = router;
