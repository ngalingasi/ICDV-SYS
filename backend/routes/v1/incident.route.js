const express = require('express');
const auth    = require('../../middlewares/auth');
const tenant  = require('../../middlewares/tenant');
const upload  = require('../../middlewares/upload');
const ctrl    = require('../../controllers/incident.controller');

const router = express.Router();

// ── Incident Types (admin manages, all can read) ──────────────────────────────
router.get( '/types',          auth(),                     ctrl.getTypes);
router.post('/types',          auth('manageLookups'),       ctrl.createType);
router.patch('/types/:typeId', auth('manageLookups'),       ctrl.updateType);

// ── Vehicle lookup for incident form ─────────────────────────────────────────
router.get('/lookup',          auth(), tenant(), ctrl.lookup);

// ── Incident CRUD ─────────────────────────────────────────────────────────────
// Anyone authenticated can report (up to 3 attachments)
router.get( '/',               auth(), tenant(), ctrl.list);
router.post('/',               auth(), tenant(), upload.array('attachments', 3), ctrl.create);
router.get( '/:incidentId',    auth(), tenant(), ctrl.getOne);

// Status transitions — supervisor/admin only
router.patch('/:incidentId/acknowledge', auth('manageIncidents'), tenant(), ctrl.acknowledge);
router.patch('/:incidentId/resolve',     auth('manageIncidents'), tenant(), ctrl.resolve);

// ── Vehicle-specific history ──────────────────────────────────────────────────
router.get('/vehicle/:vehicleId', auth(), tenant(), ctrl.vehicleIncidents);

module.exports = router;
