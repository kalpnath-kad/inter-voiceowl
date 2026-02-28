import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SessionsModule } from './sessions/sessions.module';
import { MongoDatabaseModule } from './database/mongo.module';

@Module({
  imports: [
    // Load environment variables from .env file
    ConfigModule.forRoot({
      isGlobal: true, // Make ConfigModule available globally
      envFilePath: '.env', // Path to .env file (default is .env)
      expandVariables: true, // Enable variable expansion in .env file
    }),
    MongoDatabaseModule,
    SessionsModule,
  ],
})
export class AppModule {}
