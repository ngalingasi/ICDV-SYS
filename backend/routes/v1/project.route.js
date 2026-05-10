const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validate = require('../../middlewares/validate');
const auth = require('../../middlewares/auth');
const projectController = require('../../controllers/project.controller');
const objectiveController = require('../../controllers/objective.controller');
const documentController = require('../../controllers/document.controller');
const upload = require('../../middlewares/upload');

const coordinatorSchema = Joi.object({
  full_name:    Joi.string().required(),
  email:        Joi.string().email().optional().allow('', null),
  phone_number: Joi.string().optional().allow('', null),
  address:      Joi.string().optional().allow('', null),
});

const employmentSchema = Joi.object({
  category:       Joi.string().required(),
  type:           Joi.string().required(),
  foreign_count:  Joi.number().integer().min(0).optional().default(0),
  domestic_count: Joi.number().integer().min(0).optional().default(0),
});

const financingSchema = Joi.object({
  fund_source:        Joi.string().optional().allow('', null),
  financial_modality: Joi.string().optional().allow('', null),
  financial_category: Joi.string().optional().allow('', null),
  financier:          Joi.string().optional().allow('', null),
  committed_amount:   Joi.number().optional().allow(null),
  exchange_rate:      Joi.number().optional().allow(null),
  currency:           Joi.string().max(10).optional().allow('', null),
});

const regionSchema = Joi.alternatives().try(
  Joi.number().integer(),
  Joi.object({
    region_id:   Joi.number().integer().required(),
    district:    Joi.string().optional().allow('', null),
    ward:        Joi.string().optional().allow('', null),
    description: Joi.string().optional().allow('', null),
    latitude:    Joi.number().optional().allow(null),
    longitude:   Joi.number().optional().allow(null),
  })
);

const projectSchema = {
  body: Joi.object().keys({
    name:                   Joi.string().required(),
    programme_name:         Joi.string().optional().allow('', null),
    project_nature:         Joi.string().optional().allow('', null),
    sector_id:              Joi.number().integer().optional().allow(null),
    sub_sector:             Joi.string().optional().allow('', null),
    start_date:             Joi.date().optional().allow(null),
    end_date:               Joi.date().optional().allow(null),
    // Financing
    fund_structure:         Joi.string().optional().allow('', null),
    financial_modality:     Joi.string().optional().allow('', null),
    financial_category:     Joi.string().optional().allow('', null),
    financier:              Joi.string().optional().allow('', null),
    committed_amount:       Joi.number().optional().allow(null),
    exchange_rate:          Joi.number().optional().allow(null),
    currency:               Joi.string().max(10).optional().allow('', null),
    funding:                Joi.string().optional().allow('', null),
    estimated_cost:         Joi.number().optional().allow(null),
    project_life_span:      Joi.number().integer().optional().allow(null),
    // Narrative fields
    project_background:     Joi.string().optional().allow('', null),
    project_objectives:     Joi.string().optional().allow('', null),
    project_main_activities:Joi.string().optional().allow('', null),
    project_beneficiaries:  Joi.string().optional().allow('', null),
    project_use_capacity:   Joi.string().optional().allow('', null),
    project_scope:          Joi.string().optional().allow('', null),
    // Admin
    cost_center:            Joi.string().optional().allow('', null),
    project_reference:      Joi.string().optional().allow('', null),
    relevancy_fypds:        Joi.string().optional().allow('', null),
    implementation_modality:Joi.string().optional().allow('', null),
    compensation:           Joi.string().optional().allow('', null),
    has_land:               Joi.number().valid(0, 1).optional(),
    job_created_no:         Joi.string().optional().allow('', null),
    project_manager_id:     Joi.number().integer().optional().allow(null),
    // Relations
    regions:                Joi.array().items(regionSchema).optional(),
    implementers:           Joi.array().items(Joi.object()).optional(),
    coordinators:           Joi.array().items(coordinatorSchema).optional(),
    employment:             Joi.array().items(employmentSchema).optional(),
    financing:              Joi.array().items(financingSchema).optional(),
  }),
};

router.route('/')
  .post(auth('manageProjects'), validate(projectSchema), projectController.createProject)
  .get(auth('getProjects'), projectController.getProjects);

router.route('/:projectId')
  .get(auth('getProjects'), projectController.getProject)
  .patch(auth('manageProjects'), projectController.updateProject)
  .delete(auth('manageProjects'), projectController.deleteProject);

// Objectives nested
router.route('/:projectId/objectives')
  .post(auth('manageProjects'), objectiveController.createObjective)
  .get(auth('getProjects'), objectiveController.getObjectivesByProject);

// Documents nested
router.route('/:projectId/documents')
  .post(auth('manageProjects'), upload.single('file'), documentController.uploadDocument)
  .get(auth('getProjects'), documentController.getDocumentsByProject);

module.exports = router;
