import { Module } from '@nestjs/common';
import { SessionsModule } from './sessions/sessions.module';
import { MongoDatabaseModule } from './database/mongo.module';

@Module({
  imports: [MongoDatabaseModule, SessionsModule],
})
export class AppModule {}
