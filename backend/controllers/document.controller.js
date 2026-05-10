const httpStatus = require('http-status');
const path = require('path');
const catchAsync = require('../utils/catchAsync');
const documentModel = require('../models/document.model');
const ApiError = require('../utils/ApiError');

const uploadDocument = catchAsync(async (req, res) => {
  if (!req.file) throw new ApiError(httpStatus.BAD_REQUEST, 'No file uploaded');
  const doc = await documentModel.createDocument(req.body, req.file, req.user.user_id);
  res.status(httpStatus.CREATED).send(doc);
});

const uploadNewVersion = catchAsync(async (req, res) => {
  if (!req.file) throw new ApiError(httpStatus.BAD_REQUEST, 'No file uploaded');
  const doc = await documentModel.addDocumentVersion(req.params.documentId, req.file, req.user.user_id);
  res.send(doc);
});

const getDocumentsByProject = catchAsync(async (req, res) => {
  const docs = await documentModel.getDocumentsByProject(req.params.projectId);
  res.send(docs);
});

const getDocument = catchAsync(async (req, res) => {
  const doc = await documentModel.getDocumentById(req.params.documentId);
  res.send(doc);
});

const downloadDocument = catchAsync(async (req, res) => {
  const doc = await documentModel.getDocumentById(req.params.documentId);
  const version = doc.versions.find((v) => v.version_number === Number(req.params.version)) || doc.versions[0];
  if (!version) throw new ApiError(httpStatus.NOT_FOUND, 'File version not found');
  res.download(version.file_path, path.basename(version.file_path));
});

const deleteDocument = catchAsync(async (req, res) => {
  await documentModel.deleteDocument(req.params.documentId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = { uploadDocument, uploadNewVersion, getDocumentsByProject, getDocument, downloadDocument, deleteDocument };
