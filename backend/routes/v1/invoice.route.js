'use strict';

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const auth    = require('../../middlewares/auth');
const tenant  = require('../../middlewares/tenant');
const ctrl    = require('../../controllers/invoice.controller');

const router = express.Router();

// Multer for evidence uploads — reuse existing uploads folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(process.cwd(), 'uploads')),
  filename:    (req, file, cb) => {
    const ts  = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `evidence_${ts}${ext}`);
  },
});
const upload = multer({
  storage,
  limits:    { fileSize: 10 * 1024 * 1024 },  // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only PDF and image files are allowed'));
  },
});

// ── Operator config (super_admin only) ────────────────────────────────────────
router.route('/operator-config')
  .get(auth('manageLookups'),  tenant(), ctrl.getOperatorConfig)
  .patch(auth('manageLookups'), tenant(), ctrl.updateOperatorConfig);

// ── Invoice items catalog (super_admin only) ──────────────────────────────────
router.route('/items')
  .post(auth('manageInvoices'), tenant(), ctrl.createInvoiceItem)
  .get(auth('viewInvoices'),   tenant(), ctrl.getInvoiceItems);

router.route('/items/:itemId')
  .get(auth('viewInvoices'),    tenant(), ctrl.getInvoiceItem)
  .patch(auth('manageInvoices'),tenant(), ctrl.updateInvoiceItem)
  .delete(auth('manageInvoices'),tenant(), ctrl.deleteInvoiceItem);

// ── Manifest helpers ──────────────────────────────────────────────────────────
router.get('/manifests/:manifestId/vehicle-count',
  auth('viewInvoices'), tenant(), ctrl.getManifestVehicleCount);

// ── Manifest Close Operation (super_admin only) ───────────────────────────────
router.post('/manifests/:manifestId/close',
  auth('manageInvoices'), tenant(), ctrl.closeManifestOperation);

// ── Invoices (super_admin: full CRUD | ICDV: read-only via billing) ───────────
router.route('/')
  .post(auth('manageInvoices'), tenant(), ctrl.createInvoice)
  .get(auth('viewInvoices'),    tenant(), ctrl.getInvoices);

router.route('/:invoiceId')
  .get(auth('viewInvoices'),    tenant(), ctrl.getInvoice)
  .patch(auth('manageInvoices'),tenant(), ctrl.updateInvoice);

// Approve / Cancel (super_admin only)
router.post('/:invoiceId/approve',
  auth('manageInvoices'), tenant(), ctrl.approveInvoice);

router.post('/:invoiceId/cancel',
  auth('manageInvoices'), tenant(), ctrl.cancelInvoice);

// Print data
router.get('/:invoiceId/print',
  auth('viewInvoices'), tenant(), ctrl.getInvoicePrintData);

// ── Billing actions (ICDV admin / cashier) ────────────────────────────────────
router.post('/:invoiceId/mark-paid',
  auth('markInvoicePaid'), tenant(), ctrl.markAsPaid);

router.post('/:invoiceId/evidence',
  auth('viewInvoices'), tenant(),
  upload.single('evidence'),
  ctrl.uploadEvidence);

module.exports = router;
