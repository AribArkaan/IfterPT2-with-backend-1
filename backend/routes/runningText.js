const express = require('express');
const router = express.Router();
const runningTextController = require('../controllers/runningTextController');

router.get('/', runningTextController.getRunningText);
router.get('/:id', runningTextController.getRunningTextById);
router.post('/', runningTextController.createRunningText);
router.put('/:id', runningTextController.updateRunningText);
router.delete('/:id', runningTextController.deleteRunningText);

module.exports = router;
