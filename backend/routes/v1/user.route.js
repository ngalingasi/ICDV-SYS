const express  = require('express');
const router   = express.Router();
const Joi      = require('joi');
const validate = require('../../middlewares/validate');
const auth     = require('../../middlewares/auth');
const tenant   = require('../../middlewares/tenant');
const userController = require('../../controllers/user.controller');

// All valid role values — kept in sync with config/roles.js and migration 008
const VALID_ROLES = [
  // Existing roles
  'operator',
  'supervisor',
  'admin',
  'super_admin',
  // New operational roles (migration 008)
  'discharge_officer',
  'backoffice_officer',
  'transfer_officer',
  'yard_officer',
  // Fuel management role (migration 011)
  'fuel_officer',
  'cashier',
];

const createUserSchema = {
  body: Joi.object().keys({
    full_name: Joi.string().required(),
    username:  Joi.string().alphanum().min(3).required(),
    email:     Joi.string().email().optional().allow('', null),
    mobile:    Joi.string().optional().allow('', null),
    gender:    Joi.string().valid('male', 'female').optional(),
    role:      Joi.string().valid(...VALID_ROLES).optional(),
    status:    Joi.string().valid('active', 'inactive').optional(),
    password:  Joi.string().min(8).optional(),
    icdv_id:   Joi.number().integer().optional().allow(null),
  }),
};

const updateUserSchema = {
  params: Joi.object().keys({ userId: Joi.number().integer().required() }),
  body: Joi.object().keys({
    full_name:            Joi.string().optional(),
    email:                Joi.string().email().optional().allow('', null),
    mobile:               Joi.string().optional().allow('', null),
    gender:               Joi.string().valid('male', 'female').optional(),
    role:                 Joi.string().valid(...VALID_ROLES).optional(),
    status:               Joi.string().valid('active', 'inactive').optional(),
    must_change_password: Joi.number().valid(0, 1).optional(),
  }).min(1),
};

// Static routes before /:userId
router.get('/meta/skills', auth(), userController.getSkills);

router.route('/')
  .post(auth('manageUsers'), tenant(), validate(createUserSchema), userController.createUser)
  .get( auth('getUsers'),    tenant(), userController.getUsers);

router.route('/:userId')
  .get(   auth('getUsers'),    tenant(), userController.getUser)
  .patch( auth('manageUsers'), tenant(), validate(updateUserSchema), userController.updateUser)
  .delete(auth('manageUsers'), tenant(), userController.deleteUser);

router.put('/:userId/skills', auth('manageUsers'), userController.updateSkills);

module.exports = router;
