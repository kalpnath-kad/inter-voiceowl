import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SessionStatus } from '../schemas/conversation-session.schema';

export class CreateSessionDto {
  @ApiProperty({
    description: 'Unique session identifier',
    example: 'session-123',
  })
  @IsString()
  sessionId: string;

  @ApiPropertyOptional({
    description: 'Session status',
    enum: SessionStatus,
    default: SessionStatus.INITIATED,
    example: SessionStatus.INITIATED,
  })
  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  @ApiProperty({
    description: 'Language code (e.g., en, fr)',
    example: 'en',
  })
  @IsString()
  language: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the session',
    example: { source: 'web', userId: 'user-456' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
