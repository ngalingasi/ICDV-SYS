const express    = require('express');
const router     = express.Router();
const auth       = require('../../middlewares/auth');
const logistics  = require('../../controllers/logistics.controller');

// ── Companies ──────────────────────────────────────────────────────────────────
router.route('/companies')
  .get(auth(),                    logistics.listCompanies)
  .post(auth('manageInventory'),  logistics.createCompany);
router.route('/companies/:id')
  .get(auth(),                    logistics.getCompany)
  .put(auth('manageInventory'),   logistics.updateCompany)
  .delete(auth('manageInventory'),logistics.deleteCompany);

// ── Transactions ───────────────────────────────────────────────────────────────
router.route('/transactions')
  .get(auth(),                    logistics.listTransactions)
  .post(auth('manageInventory'),  logistics.createTransaction);
router.route('/transactions/:id')
  .get(auth(),                    logistics.getTransaction)
  .put(auth('manageInventory'),   logistics.updateTransaction);

// ── Status transitions ─────────────────────────────────────────────────────────
router.post('/transactions/:id/schedule-pickup', auth('manageInventory'), logistics.schedulePickup);
router.post('/transactions/:id/picked-up',       auth('manageInventory'), logistics.markPickedUp);
router.post('/transactions/:id/in-transit',      auth('manageInventory'), logistics.markInTransit);
router.post('/transactions/:id/delayed',         auth('manageInventory'), logistics.markDelayed);
router.post('/transactions/:id/arrived',         auth('manageInventory'), logistics.markArrived);
router.post('/transactions/:id/delivered',       auth('manageInventory'), logistics.markDelivered);
router.post('/transactions/:id/cancel',          auth('manageInventory'), logistics.cancelShipment);
router.post('/transactions/:id/note',            auth(),                  logistics.addNote);

module.exports = router;
