const express             = require('express');
const router              = express.Router();
const auth                = require('../../middlewares/auth');
const financialController = require('../../controllers/financial.controller');

router.get('/summary', auth(), financialController.getSummary);

module.exports = router;
