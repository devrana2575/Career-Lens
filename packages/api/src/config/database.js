import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import env from '../config/env.js';

let connection = null;

/** Connects to MongoDB once per process (idempotent). */
export async function connectToDatabase() {
  if (connection) return connection;

  mongoose.set('strictQuery', true);

  mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'MongoDB connection error');
  });
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  connection = await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });

  logger.info('Connected to MongoDB');
  return connection;
}

export default mongoose;