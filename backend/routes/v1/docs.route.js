const express = require('express');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const router = express.Router();

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'TPFCS Project Management API',
    version: '1.0.0',
    description: 'API documentation for the TPFCS Project Management System',
  },
  servers: [{ url: '/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

const specs = swaggerJsdoc({
  swaggerDefinition,
  apis: ['src/routes/v1/*.js', 'src/docs/*.yml'],
});

router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(specs, { explorer: true }));

module.exports = router;
