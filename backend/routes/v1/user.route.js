const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validate = require('../../middlewares/validate');
const auth = require('../../middlewares/auth');
const userController = require('../../controllers/user.controller');

const createUserSchema = {
  body: Joi.object().keys({
    full_name: Joi.string().required(),
    username:  Joi.string().alphanum().min(3).required(),
    email:     Joi.string().email().optional().allow('', null),
    mobile:    Joi.string().optional().allow('', null),
    gender:    Joi.string().valid('male', 'female').optional(),
    role:      Joi.string().valid('user', 'manager', 'admin').optional(),
    status:    Joi.string().valid('active', 'inactive').optional(),
    password:  Joi.string().min(8).optional(),
  }),
};

const updateUserSchema = {
  params: Joi.object().keys({
    userId: Joi.number().integer().required(),
  }),
  body: Joi.object().keys({
    full_name:            Joi.string().optional(),
    email:                Joi.string().email().optional().allow('', null),
    mobile:               Joi.string().optional().allow('', null),
    gender:               Joi.string().valid('male', 'female').optional(),
    role:                 Joi.string().valid('user', 'manager', 'admin').optional(),
    status:               Joi.string().valid('active', 'inactive').optional(),
    must_change_password: Joi.number().valid(0, 1).optional(),
  }).min(1),
};

// IMPORTANT: Static routes MUST come before /:userId to avoid param conflicts
router.get('/meta/skills', auth(), userController.getSkills);

router.route('/')
  .post(auth('manageUsers'), validate(createUserSchema), userController.createUser)
  .get(auth('getUsers'), userController.getUsers);

router.route('/:userId')
  .get(auth('getUsers'), userController.getUser)
  .patch(auth('manageUsers'), validate(updateUserSchema), userController.updateUser)
  .delete(auth('manageUsers'), userController.deleteUser);

router.put('/:userId/skills', auth('manageUsers'), userController.updateSkills);

module.exports = router;
