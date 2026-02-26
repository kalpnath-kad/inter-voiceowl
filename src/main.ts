import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

const logger = new Logger('Bootstrap');

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error(`Uncaught Exception: ${error.message}`, error.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  const errorMessage = reason instanceof Error ? reason.message : String(reason);
  const errorStack = reason instanceof Error ? reason.stack : undefined;
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${errorMessage}`, errorStack);
  process.exit(1);
});

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });
    
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        exceptionFactory: (errors) => {
          logger.warn(`Validation failed: ${JSON.stringify(errors)}`);
          return errors;
        },
      }),
    );

    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new LoggingInterceptor());

    // Swagger configuration
    const config = new DocumentBuilder()
      .setTitle('VoiceOwl Conversation Session API')
      .setDescription('API for managing conversation sessions and events in a Voice AI platform')
      .setVersion('1.0')
      .addTag('sessions', 'Conversation session management')
      .build();
    
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    const port = process.env.PORT || 3000;
    await app.listen(port);
    
    logger.log(`Application is running on: http://localhost:${port}`);
    logger.log(`Swagger documentation available at: http://localhost:${port}/api`);

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      logger.log(`Received ${signal}, starting graceful shutdown...`);
      
      try {
        await app.close();
        logger.log('Application closed successfully');
        process.exit(0);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.error(`Error during shutdown: ${errorMessage}`, errorStack);
        process.exit(1);
      }
    };

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle SIGTERM (termination signal)
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error(`Failed to start application: ${errorMessage}`, errorStack);
    process.exit(1);
  }
}

bootstrap();
