const httpStatus = require('http-status');
const { query } = require('../config/database');
const ApiError = require('../utils/ApiError');

// ─── Sectors ──────────────────────────────────────────────
const createSector = async (body, creatorId) => {
  const { name, parent_sector_id } = body;
  const result = await query(
    'INSERT INTO sectors (name, parent_sector_id, created_by) VALUES (?,?,?)',
    [name, parent_sector_id || null, creatorId]
  );
  return getSectorById(result.insertId);
};

const getSectors = async () => {
  return query('SELECT * FROM sectors ORDER BY name');
};

const getSectorById = async (id) => {
  const rows = await query('SELECT * FROM sectors WHERE sector_id = ?', [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Sector not found');
  return rows[0];
};

const updateSector = async (id, body) => {
  const { name, parent_sector_id } = body;
  await query('UPDATE sectors SET name = ?, parent_sector_id = ? WHERE sector_id = ?', [name, parent_sector_id || null, id]);
  return getSectorById(id);
};

const deleteSector = async (id) => {
  await query('DELETE FROM sectors WHERE sector_id = ?', [id]);
};

// ─── Regions ──────────────────────────────────────────────
const createRegion = async (body, creatorId) => {
  const { region_name } = body;
  const result = await query('INSERT INTO regions (region_name, created_by) VALUES (?,?)', [region_name, creatorId]);
  return getRegionById(result.insertId);
};

const getRegions = async () => {
  return query('SELECT * FROM regions ORDER BY region_name');
};

const getRegionById = async (id) => {
  const rows = await query('SELECT * FROM regions WHERE region_id = ?', [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Region not found');
  return rows[0];
};

const updateRegion = async (id, body) => {
  await query('UPDATE regions SET region_name = ? WHERE region_id = ?', [body.region_name, id]);
  return getRegionById(id);
};

const deleteRegion = async (id) => {
  await query('DELETE FROM regions WHERE region_id = ?', [id]);
};

// ─── Implementers ─────────────────────────────────────────
const createImplementer = async (body, creatorId) => {
  const { name, description } = body;
  const result = await query(
    'INSERT INTO implementers (name, description, created_by) VALUES (?,?,?)',
    [name, description, creatorId]
  );
  return getImplementerById(result.insertId);
};

const getImplementers = async () => {
  return query('SELECT * FROM implementers ORDER BY name');
};

const getImplementerById = async (id) => {
  const rows = await query('SELECT * FROM implementers WHERE implementer_id = ?', [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Implementer not found');
  return rows[0];
};

const updateImplementer = async (id, body) => {
  const { name, description } = body;
  await query('UPDATE implementers SET name = ?, description = ? WHERE implementer_id = ?', [name, description, id]);
  return getImplementerById(id);
};

const deleteImplementer = async (id) => {
  await query('DELETE FROM implementers WHERE implementer_id = ?', [id]);
};

module.exports = {
  createSector, getSectors, getSectorById, updateSector, deleteSector,
  createRegion, getRegions, getRegionById, updateRegion, deleteRegion,
  createImplementer, getImplementers, getImplementerById, updateImplementer, deleteImplementer,
};
