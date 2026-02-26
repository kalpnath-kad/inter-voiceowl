import { IsString, IsEnum, IsObject, IsDate, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventType } from '../schemas/conversation-event.schema';

export class CreateEventDto {
  @ApiProperty({
    description: 'Unique event identifier within the session',
    example: 'event-456',
  })
  @IsString()
  eventId: string;

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

  @ApiPropertyOptional({
    description: 'Event timestamp (defaults to current time if not provided)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  timestamp?: Date;
}
