import mongoose from 'mongoose';
import { Module, OnApplicationShutdown, Logger } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

const DEFAULT_MAX_TIME_MS = 30000;
const logger = new Logger('MongoDatabaseModule');

/**
 * Mongoose plugin that applies maxTimeMS to all find/findOne/update/delete and aggregate operations.
 * Set options.maxTimeMS (ms). Use 0 to skip applying (no limit).
 * Per-query override: chain .maxTimeMS(ms) on a query, or .option({ maxTimeMS: ms }) on an aggregate,
 * and the plugin will not overwrite it.
 */
function maxTimeMSPlugin(
  schema: mongoose.Schema,
  options: { maxTimeMS: number },
): void {
  const { maxTimeMS } = options;
  if (!maxTimeMS || maxTimeMS <= 0) return;

  const queryMiddleware = function (this: mongoose.Query<unknown, unknown>) {
    if (this.getOptions().maxTimeMS == null) {
      this.setOptions({ maxTimeMS });
    }
  };

  schema.pre(
    [
      'find',
      'findOne',
      'findOneAndUpdate',
      'findOneAndReplace',
      'updateOne',
      'updateMany',
      'countDocuments',
      'deleteOne',
      'deleteMany',
    ],
    queryMiddleware,
  );

  schema.pre('aggregate', function (this: mongoose.Aggregate<unknown>) {
    if (this.options?.maxTimeMS == null) {
      this.option({ maxTimeMS });
    }
  });
}

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: async () => {
        const maxTimeMS = parseInt(
          process.env.MONGODB_MAX_TIME_MS || String(DEFAULT_MAX_TIME_MS),
          10,
        );

        // Apply maxTimeMS plugin globally to all schemas
        if (maxTimeMS > 0) {
          mongoose.plugin(maxTimeMSPlugin, { maxTimeMS });
          logger.log(`MongoDB query timeout (maxTimeMS): ${maxTimeMS}ms`);
        }

        // Enable debug mode in non-production environments
        if (process.env.NODE_ENV !== 'production') {
          mongoose.set('debug', true);
        }

        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/voiceowl';

        return {
          uri: mongoUri,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          connectionFactory(connection) {
            connection.on('connecting', () => {
              logger.log('Connecting to MongoDB...');
            });
            connection.on('connected', () => {
              logger.log('Connected to MongoDB');
            });
            connection.on('reconnecting', () => {
              logger.log('Reconnecting to MongoDB...');
            });
            connection.on('reconnected', () => {
              logger.log('Reconnected to MongoDB');
            });
            connection.on('disconnecting', () => {
              logger.log('Disconnecting from MongoDB...');
            });
            connection.on('disconnected', () => {
              logger.warn('Disconnected from MongoDB');
            });
            connection.on('close', () => {
              logger.log('Closed MongoDB connection');
            });
            connection.on('error', (error: Error) => {
              logger.error(`MongoDB connection error: ${error.message}`, error.stack);
            });
            return connection;
          },
        };
      },
    }),
  ],
})
export class MongoDatabaseModule implements OnApplicationShutdown {
  async onApplicationShutdown(signal?: string): Promise<void> {
    logger.log(`Application is shutting down (signal: ${signal})...`);
    try {
      await mongoose.disconnect();
      logger.log('MongoDB connection closed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error(`Error closing MongoDB connection: ${errorMessage}`, errorStack);
    }
  }
}
