const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const lookupModel = require('../models/lookup.model');

// ─── Sectors ──────────────────────────────────────────────
const createSector = catchAsync(async (req, res) => {
  const s = await lookupModel.createSector(req.body, req.user.user_id);
  res.status(httpStatus.CREATED).send(s);
});
const getSectors = catchAsync(async (req, res) => res.send(await lookupModel.getSectors()));
const getSector = catchAsync(async (req, res) => res.send(await lookupModel.getSectorById(req.params.sectorId)));
const updateSector = catchAsync(async (req, res) => res.send(await lookupModel.updateSector(req.params.sectorId, req.body)));
const deleteSector = catchAsync(async (req, res) => { await lookupModel.deleteSector(req.params.sectorId); res.status(httpStatus.NO_CONTENT).send(); });

// ─── Regions ──────────────────────────────────────────────
const createRegion = catchAsync(async (req, res) => {
  const r = await lookupModel.createRegion(req.body, req.user.user_id);
  res.status(httpStatus.CREATED).send(r);
});
const getRegions = catchAsync(async (req, res) => res.send(await lookupModel.getRegions()));
const getRegion = catchAsync(async (req, res) => res.send(await lookupModel.getRegionById(req.params.regionId)));
const updateRegion = catchAsync(async (req, res) => res.send(await lookupModel.updateRegion(req.params.regionId, req.body)));
const deleteRegion = catchAsync(async (req, res) => { await lookupModel.deleteRegion(req.params.regionId); res.status(httpStatus.NO_CONTENT).send(); });

// ─── Implementers ─────────────────────────────────────────
const createImplementer = catchAsync(async (req, res) => {
  const i = await lookupModel.createImplementer(req.body, req.user.user_id);
  res.status(httpStatus.CREATED).send(i);
});
const getImplementers = catchAsync(async (req, res) => res.send(await lookupModel.getImplementers()));
const getImplementer = catchAsync(async (req, res) => res.send(await lookupModel.getImplementerById(req.params.implementerId)));
const updateImplementer = catchAsync(async (req, res) => res.send(await lookupModel.updateImplementer(req.params.implementerId, req.body)));
const deleteImplementer = catchAsync(async (req, res) => { await lookupModel.deleteImplementer(req.params.implementerId); res.status(httpStatus.NO_CONTENT).send(); });

// ── Transfer Rate (global system setting) ─────────────────────────────────────
const getTransferRate = catchAsync(async (req, res) => {
  const row = await lookupModel.getSetting('transfer_rate');
  res.json({ setting_key: 'transfer_rate', setting_value: row?.setting_value ?? '0', rate: parseFloat(row?.setting_value ?? '0') });
});

const updateTransferRate = catchAsync(async (req, res) => {
  const { rate } = req.body;
  if (rate === undefined || isNaN(parseFloat(rate)) || parseFloat(rate) < 0)
    return res.status(400).json({ message: 'rate must be a non-negative number' });
  const row = await lookupModel.upsertSetting('transfer_rate', parseFloat(rate), req.user.user_id);
  res.json({ setting_key: 'transfer_rate', setting_value: row.setting_value, rate: parseFloat(row.setting_value) });
});

module.exports = {
  createSector, getSectors, getSector, updateSector, deleteSector,
  createRegion, getRegions, getRegion, updateRegion, deleteRegion,
  createImplementer, getImplementers, getImplementer, updateImplementer, deleteImplementer,
  getTransferRate, updateTransferRate,
};
