import { createApp } from './app.js';
import { connectToDatabase } from './config/database.js';
import env from './config/env.js';
import logger from './utils/logger.js';

async function main() {
  if (env.nodeEnv !== 'test') {
    await connectToDatabase();
  }

  const app = createApp();
  app.listen(env.port, () => {
    logger.info(
      { url: `http://localhost:${env.port}/api/health` },
      `${env.appName} API listening`,
    );
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start API');
  process.exit(1);
});