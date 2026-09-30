const httpStatus = require('http-status');
const config = require('../config/config');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const { captureError } = require('../config/traceAndFound');

const errorConverter = (err, req, res, next) => {
  let error = err;
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
    const message = error.message || httpStatus[statusCode];
    error = new ApiError(statusCode, message, false, err.stack);
  }
  next(error);
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;
  if (config.env === 'production' && !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = httpStatus[httpStatus.INTERNAL_SERVER_ERROR];
  }

  res.locals.errorMessage = err.message;

  // Send to TraceAndFound — only real bugs, not expected business-logic
  // errors (e.g. "vehicle not found" 404s thrown deliberately by a
  // controller, which are isOperational=true and just normal control flow).
  // Centralized here means every controller in the app is covered already,
  // with nothing to change per-controller.
  if (!err.isOperational || err.statusCode >= 500) {
    captureError(err, req.icdvId ?? null, {
      module: (req.originalUrl.split('?')[0].match(/^\/api\/([^/]+)/) || [])[1] || 'unknown',
      operation: `${req.method} ${req.originalUrl}`,
      request: req.body,
      response: { status: statusCode, message },
    });
  }

  const response = {
    code: statusCode,
    message,
    ...(config.env === 'development' && { stack: err.stack }),
  };

  if (config.env === 'development') {
    logger.error(err);
  }

  res.status(statusCode).send(response);
};

module.exports = { errorConverter, errorHandler };
