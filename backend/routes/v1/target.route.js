const express = require('express');
const router = express.Router();
const auth = require('../../middlewares/auth');
const targetController = require('../../controllers/target.controller');

router.route('/:targetId')
  .get(auth('getProjects'), targetController.getTarget)
  .patch(auth('manageProjects'), targetController.updateTarget)
  .delete(auth('manageProjects'), targetController.deleteTarget);

module.exports = router;
