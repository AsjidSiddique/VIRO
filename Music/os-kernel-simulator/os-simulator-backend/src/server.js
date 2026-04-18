require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    logger.info(`🚀 OS Kernel Simulator API running on port ${PORT}`);
    logger.info(`🌐 Environment: ${process.env.NODE_ENV}`);
  });
}).catch((err) => {
  logger.error('Failed to connect to database:', err);
  process.exit(1);
});
