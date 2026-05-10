const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const validate    = require('../../middlewares/validate');
const upload      = require('../../middlewares/upload');
const auth        = require('../../middlewares/auth');
const inspection  = require('../../controllers/inspection.controller');

const itemSchema = Joi.object({
  item_title:       Joi.string().required(),
  item_description: Joi.string().optional().allow('', null),
  item_order:       Joi.number().integer().min(0).optional(),
  response_type:    Joi.string().valid('pass_fail','yes_no','text','number','photo','file').optional(),
  is_required:      Joi.boolean().optional(),
  requires_comment: Joi.boolean().optional(),
});

const checklistSchema = {
  body: Joi.object().keys({
    checklist_name:  Joi.string().required(),
    inspection_type: Joi.string().valid('FA','GRI').required(),
    description:     Joi.string().optional().allow('', null),
    status:          Joi.string().valid('active','inactive').optional(),
    items:           Joi.array().items(itemSchema).min(1).required(),
  }),
};

const requestSchema = {
  body: Joi.object().keys({
    inspection_type:          Joi.string().valid('FA','GRI').required(),
    project_id:               Joi.number().integer().optional().allow(null),
    purchase_order_id:        Joi.number().integer().optional().allow(null),
    source_type:              Joi.string().valid('ORDER','TRANSFER').optional().default('ORDER'),
    source_id:                Joi.number().integer().optional().allow(null),
    destination_store_id:     Joi.number().integer().optional().allow(null),
    checklist_id:             Joi.number().integer().required(),
    location_name:            Joi.string().required(),
    location_address:         Joi.string().optional().allow('', null),
    location_country:         Joi.string().optional().allow('', null),
    location_region:          Joi.string().optional().allow('', null),
    location_region_id:       Joi.number().integer().optional().allow(null),
    location_city:            Joi.string().optional().allow('', null),
    latitude:                 Joi.number().min(-90).max(90).optional().allow(null),
    longitude:                Joi.number().min(-180).max(180).optional().allow(null),
    inspection_date:          Joi.date().required(),
    inspection_time:          Joi.string().optional().allow('', null),
    requires_evidence_upload:         Joi.boolean().optional(),
    require_evidence_on_acceptance:   Joi.boolean().optional(),
    request_notes:            Joi.string().optional().allow('', null),
    status:                   Joi.string().valid('draft','pending_acceptance').optional(),
    assigned_user_ids:        Joi.array().items(Joi.number().integer()).min(1).required(),
    order_item_ids:           Joi.array().items(Joi.number().integer()).optional(),
  }),
};

// ── Checklists ─────────────────────────────────────────────────────────────
router.route('/checklists')
  .get(auth('getInventory'),     inspection.listChecklists)
  .post(auth('manageInventory'), validate(checklistSchema), inspection.createChecklist);

router.route('/checklists/:id')
  .get(auth('getInventory'),     inspection.getChecklist)
  .put(auth('manageInventory'),  inspection.updateChecklist)
  .delete(auth('manageInventory'), inspection.deleteChecklist);

// ── Inspection Requests ─────────────────────────────────────────────────────
router.route('/requests')
  .get(auth('getInventory'),     inspection.listRequests)
  .post(auth('manageInventory'), validate(requestSchema), inspection.createRequest);

router.route('/requests/:id')
  .get(auth('getInventory'),     inspection.getRequest)
  .put(auth('manageInventory'),  inspection.updateRequest)
  .delete(auth('manageInventory'), inspection.deleteRequest);

router.post('/requests/:id/cancel', auth('manageInventory'), inspection.cancelRequest);

// ── Execution ─────────────────────────────────────────────────────────────────
router.get('/requests/:id/execute',   auth(), inspection.getExecutionData);
router.post('/requests/:id/responses',auth(), upload.single('evidence'), inspection.saveResponses);
router.post('/requests/:id/submit',   auth(), inspection.submitInspection);

// ── Approval ──────────────────────────────────────────────────────────────────
router.post('/requests/:id/approve',  auth('manageInventory'), inspection.approveInspection);
router.post('/requests/:id/reject-approval', auth('manageInventory'), inspection.rejectInspection);

// ── Stock ──────────────────────────────────────────────────────────────────────
router.get('/stock/:storeId',         auth('getInventory'), inspection.getStoreStock);
router.get('/stock-transactions',     auth('getInventory'), inspection.getStockTransactions);

// ── Assignments ─────────────────────────────────────────────────────────────
router.post('/assignments/:assignmentId/accept', auth(), inspection.acceptAssignment);
router.post('/assignments/:assignmentId/reject', auth(), inspection.rejectAssignment);
router.get('/assignments/:assignmentId/evidence',  auth(), inspection.getEvidence);
router.post('/assignments/:assignmentId/evidence', auth(), upload.single('evidence'), inspection.uploadEvidence);

module.exports = router;
