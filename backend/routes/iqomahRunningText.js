const express = require('express');
const router = express.Router();
const iqomahRunningTextController = require('../controllers/iqomahRunningTextController');

router.get('/', iqomahRunningTextController.getIqomahRunningText);
router.get('/:id', iqomahRunningTextController.getIqomahRunningTextById);
router.post('/', iqomahRunningTextController.createIqomahRunningText);
router.put('/:id', iqomahRunningTextController.updateIqomahRunningText);
router.delete('/:id', iqomahRunningTextController.deleteIqomahRunningText);

module.exports = router;
