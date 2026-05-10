const express = require('express');
const router = express.Router();
const auth = require('../../middlewares/auth');
const objectiveController = require('../../controllers/objective.controller');
const targetController = require('../../controllers/target.controller');

router.route('/:objectiveId')
  .get(auth('getProjects'), objectiveController.getObjective)
  .patch(auth('manageProjects'), objectiveController.updateObjective)
  .delete(auth('manageProjects'), objectiveController.deleteObjective);

// Targets nested under objective
router.route('/:objectiveId/targets')
  .post(auth('manageProjects'), targetController.createTarget)
  .get(auth('getProjects'), targetController.getTargetsByObjective);

module.exports = router;
