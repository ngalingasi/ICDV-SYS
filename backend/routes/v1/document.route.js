const express = require('express');
const router = express.Router();
const auth = require('../../middlewares/auth');
const documentController = require('../../controllers/document.controller');
const upload = require('../../middlewares/upload');

router.route('/:documentId')
  .get(auth(), documentController.getDocument)
  .delete(auth('manageProjects'), documentController.deleteDocument);

router.post('/:documentId/versions', auth('manageProjects'), upload.single('file'), documentController.uploadNewVersion);
router.get('/:documentId/download/:version?', auth(), documentController.downloadDocument);

module.exports = router;
