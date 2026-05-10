const app = require('./app');
const config = require('./config/config');
const logger = require('./config/logger');
const { testConnection } = require('./config/database');

let server;

const start = async () => {
  try {
    await testConnection();
    server = app.listen(config.port, () => {
      logger.info(`Server listening on port ${config.port} [${config.env}]`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
};

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error) => {
  // EADDRINUSE — port already in use, likely a stale process
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${config.port} is already in use. Run: lsof -ti:${config.port} | xargs kill -9`);
    process.exit(1);
  }
  logger.error(error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) server.close();
});

start();
