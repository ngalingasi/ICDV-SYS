'use strict';

const httpStatus   = require('http-status');
const catchAsync   = require('../utils/catchAsync');
const invoiceModel = require('../models/invoice.model');
const path         = require('path');

// ── Operator config ───────────────────────────────────────────────────────────
const getOperatorConfig = catchAsync(async (req, res) => {
  res.json(await invoiceModel.getOperatorConfig());
});

const updateOperatorConfig = catchAsync(async (req, res) => {
  res.json(await invoiceModel.updateOperatorConfig(req.body, req.user.user_id));
});

// ── Invoice items catalog ─────────────────────────────────────────────────────
const createInvoiceItem = catchAsync(async (req, res) => {
  const item = await invoiceModel.createInvoiceItem(req.body, req.user.user_id);
  res.status(httpStatus.CREATED).json(item);
});

const getInvoiceItems = catchAsync(async (req, res) => {
  res.json(await invoiceModel.getInvoiceItems({ status: req.query.status }));
});

const getInvoiceItem = catchAsync(async (req, res) => {
  res.json(await invoiceModel.getInvoiceItemById(req.params.itemId));
});

const updateInvoiceItem = catchAsync(async (req, res) => {
  res.json(await invoiceModel.updateInvoiceItem(req.params.itemId, req.body, req.user.user_id));
});

const deleteInvoiceItem = catchAsync(async (req, res) => {
  await invoiceModel.deleteInvoiceItem(req.params.itemId);
  res.status(httpStatus.NO_CONTENT).send();
});

// ── Invoices ──────────────────────────────────────────────────────────────────
const createInvoice = catchAsync(async (req, res) => {
  const inv = await invoiceModel.createInvoice(req.body, req.user.user_id);
  res.status(httpStatus.CREATED).json(inv);
});

const getInvoices = catchAsync(async (req, res) => {
  // ICDV-scoped users (non-super_admin) can only see their own ICDV invoices
  const scopeIcdvId = req.isSuperAdmin ? null : (req.icdvId ?? null);
  res.json(await invoiceModel.getInvoices(req.query, scopeIcdvId));
});

const getInvoice = catchAsync(async (req, res) => {
  const scopeIcdvId = req.isSuperAdmin ? null : (req.icdvId ?? null);
  res.json(await invoiceModel.getInvoiceById(req.params.invoiceId, scopeIcdvId));
});

const updateInvoice = catchAsync(async (req, res) => {
  res.json(await invoiceModel.updateInvoice(req.params.invoiceId, req.body, req.user.user_id));
});

const approveInvoice = catchAsync(async (req, res) => {
  res.json(await invoiceModel.approveInvoice(req.params.invoiceId, req.user.user_id));
});

const cancelInvoice = catchAsync(async (req, res) => {
  res.json(await invoiceModel.cancelInvoice(
    req.params.invoiceId, req.user.user_id, req.body.reason || null
  ));
});

const getInvoicePrintData = catchAsync(async (req, res) => {
  const scopeIcdvId = req.isSuperAdmin ? null : (req.icdvId ?? null);
  res.json(await invoiceModel.getInvoicePrintData(req.params.invoiceId, scopeIcdvId));
});

// ── Billing (ICDV side) ───────────────────────────────────────────────────────
const markAsPaid = catchAsync(async (req, res) => {
  const scopeIcdvId = req.isSuperAdmin ? null : (req.icdvId ?? null);
  res.json(await invoiceModel.markAsPaid(req.params.invoiceId, req.user.user_id, scopeIcdvId));
});

const uploadEvidence = catchAsync(async (req, res) => {
  if (!req.file)
    return res.status(httpStatus.BAD_REQUEST).json({ message: 'No file uploaded' });

  const scopeIcdvId = req.isSuperAdmin ? null : (req.icdvId ?? null);
  const payment = await invoiceModel.addPaymentEvidence(
    req.params.invoiceId,
    {
      filePath: req.file.path,
      fileName: req.file.originalname,
      notes:    req.body.notes || null,
    },
    req.user.user_id,
    scopeIcdvId
  );
  res.status(httpStatus.CREATED).json(payment);
});

// ── Manifest vehicle count (for invoice line item helper) ─────────────────────
const getManifestVehicleCount = catchAsync(async (req, res) => {
  const count = await invoiceModel.getManifestVehicleCount(req.params.manifestId);
  res.json({ manifest_id: Number(req.params.manifestId), total_vehicles: count });
});

// ── Close Manifest Operation ─────────────────────────────────────────────────
const closeManifestOperation = catchAsync(async (req, res) => {
  res.json(await invoiceModel.closeManifestOperation(
    req.params.manifestId, req.user.user_id
  ));
});

module.exports = {
  getOperatorConfig, updateOperatorConfig,
  createInvoiceItem, getInvoiceItems, getInvoiceItem, updateInvoiceItem, deleteInvoiceItem,
  createInvoice, getInvoices, getInvoice, updateInvoice,
  approveInvoice, cancelInvoice, getInvoicePrintData,
  markAsPaid, uploadEvidence,
  getManifestVehicleCount,
  closeManifestOperation,
};
