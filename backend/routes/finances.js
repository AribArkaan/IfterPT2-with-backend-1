const express = require('express');
const router = express.Router();
const financesController = require('../controllers/financesController');

router.get('/', financesController.getFinances);
router.get('/summary', financesController.getFinanceSummary);
router.get('/:id', financesController.getFinanceById);
router.post('/', financesController.createFinance);
router.put('/:id', financesController.updateFinance);
router.delete('/:id', financesController.deleteFinance);

module.exports = router;
