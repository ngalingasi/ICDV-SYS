const express   = require('express');
const router    = express.Router();
const erpSecret = require('../../middlewares/erpSecret');
const ctrl      = require('../../controllers/erp.controller');

router.use(erpSecret);

router.post('/lookup-user',     ctrl.lookupUser);
router.post('/me',              ctrl.getMe);
router.get('/health',           ctrl.health);
router.get('/integration-logs', ctrl.getLogs);

module.exports = router;
