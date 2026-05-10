const httpStatus = require('http-status');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');
const ApiError = require('../utils/ApiError');

/**
 * Create a document record and save the first version
 */
const createDocument = async ({ project_id, activity_id, name }, file, creatorId) => {
  const docResult = await query(
    'INSERT INTO documents (project_id, activity_id, name, created_by) VALUES (?,?,?,?)',
    [project_id || null, activity_id || null, name, creatorId]
  );
  const docId = docResult.insertId;

  await query(
    'INSERT INTO document_versions (document_id, file_path, mime_type, size, version_number, uploaded_by) VALUES (?,?,?,?,1,?)',
    [docId, file.path, file.mimetype, file.size, creatorId]
  );

  return getDocumentById(docId);
};

/**
 * Upload a new version of an existing document
 */
const addDocumentVersion = async (docId, file, uploaderId) => {
  const existing = await getDocumentById(docId);
  const maxRow = await query(
    'SELECT COALESCE(MAX(version_number),0)+1 AS next_ver FROM document_versions WHERE document_id = ?',
    [docId]
  );
  await query(
    'INSERT INTO document_versions (document_id, file_path, mime_type, size, version_number, uploaded_by) VALUES (?,?,?,?,?,?)',
    [docId, file.path, file.mimetype, file.size, maxRow[0].next_ver, uploaderId]
  );
  return getDocumentById(docId);
};

/**
 * Get documents for a project
 */
const getDocumentsByProject = async (projectId) => {
  return query(
    `SELECT d.*, dv.file_path, dv.mime_type, dv.size, dv.version_number, dv.uploaded_at
     FROM documents d
     JOIN document_versions dv ON dv.document_id = d.document_id
       AND dv.version_number = (SELECT MAX(version_number) FROM document_versions WHERE document_id = d.document_id)
     WHERE d.project_id = ? ORDER BY d.created_at DESC`,
    [projectId]
  );
};

/**
 * Get a single document with all versions
 */
const getDocumentById = async (id) => {
  const rows = await query('SELECT * FROM documents WHERE document_id = ?', [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
  const doc = rows[0];
  doc.versions = await query(
    `SELECT dv.*, u.full_name AS uploaded_by_name
     FROM document_versions dv
     LEFT JOIN users u ON u.user_id = dv.uploaded_by
     WHERE dv.document_id = ? ORDER BY dv.version_number DESC`,
    [id]
  );
  return doc;
};

/**
 * Delete a document and all its files
 */
const deleteDocument = async (id) => {
  const doc = await getDocumentById(id);
  // Remove physical files
  for (const v of doc.versions) {
    if (v.file_path && fs.existsSync(v.file_path)) {
      fs.unlinkSync(v.file_path);
    }
  }
  await query('DELETE FROM documents WHERE document_id = ?', [id]);
};

module.exports = { createDocument, addDocumentVersion, getDocumentsByProject, getDocumentById, deleteDocument };

const getDocumentsByActivity = async (activityId) => {
  return query(
    `SELECT d.*, dv.file_path, dv.mime_type, dv.size, dv.version_number,
            u.full_name AS uploaded_by_name
     FROM documents d
     JOIN document_versions dv ON dv.document_id = d.document_id
       AND dv.version_number = (
         SELECT MAX(v2.version_number) FROM document_versions v2 WHERE v2.document_id = d.document_id
       )
     LEFT JOIN users u ON u.user_id = dv.uploaded_by
     WHERE d.activity_id = ?
     ORDER BY d.created_at DESC`,
    [activityId]
  );
};

module.exports = Object.assign(module.exports || {}, { getDocumentsByActivity });
