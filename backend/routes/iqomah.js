const express = require('express');
const router = express.Router();
const iqomahController = require('../controllers/iqomahController');

router.get('/times', iqomahController.getIqomahTimes);
router.put('/times/:id', iqomahController.updateIqomahTime);
router.get('/settings', iqomahController.getIqomahSettings);

module.exports = router;
