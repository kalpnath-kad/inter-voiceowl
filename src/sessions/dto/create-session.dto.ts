import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SessionStatus } from '../schemas/conversation-session.schema';
import { IsUuid } from '../../common/validators/uuid.validator';

export class CreateSessionDto {
  @ApiProperty({
    description: 'Unique session identifier (UUID format)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  })
  @IsString()
  @IsUuid()
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
