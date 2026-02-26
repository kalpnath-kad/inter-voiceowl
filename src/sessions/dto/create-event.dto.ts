import { IsEnum, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EventType } from '../schemas/conversation-event.schema';

export class CreateEventDto {
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
