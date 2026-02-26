import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventType } from '../schemas/conversation-event.schema';
import { IsUuid } from '../../common/validators/uuid.validator';

export class CreateEventDto {
  @ApiPropertyOptional({
    description: 'Event identifier (UUID format). If not provided, a UUID will be auto-generated',
    example: '550e8400-e29b-41d4-a716-446655440000',
    pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  })
  @IsOptional()
  @IsString()
  @IsUuid()
  eventId?: string;

  @ApiProperty({
    description: 'Type of event',
    enum: EventType,
    example: EventType.USER_SPEECH,
  })
  @IsEnum(EventType)
  type: EventType;

  @ApiProperty({
    description: 'Event payload data',
    example: { text: 'Hello, how can I help you?', confidence: 0.95 },
  })
  @IsObject()
  payload: Record<string, any>;
}
