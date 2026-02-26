import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SessionStatus } from '../schemas/conversation-session.schema';
import { EventType } from '../schemas/conversation-event.schema';

export class EventResponseDto {
  @ApiProperty({ example: 'event-456' })
  eventId: string;

  @ApiProperty({ example: 'session-123' })
  sessionId: string;

  @ApiProperty({ enum: EventType, example: EventType.USER_SPEECH })
  type: EventType;

  @ApiProperty({ example: { text: 'Hello', confidence: 0.95 } })
  payload: Record<string, any>;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  timestamp: Date;
}

export class SessionResponseDto {
  @ApiProperty({ example: 'session-123' })
  sessionId: string;

  @ApiProperty({ enum: SessionStatus, example: SessionStatus.ACTIVE })
  status: SessionStatus;

  @ApiProperty({ example: 'en' })
  language: string;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  startedAt: Date;

  @ApiPropertyOptional({ example: '2024-01-01T01:00:00Z', nullable: true })
  endedAt: Date | null;

  @ApiProperty({ example: { source: 'web', userId: 'user-456' } })
  metadata: Record<string, any>;

  @ApiProperty({ type: [EventResponseDto] })
  events: EventResponseDto[];

  @ApiProperty({ example: 10 })
  totalEvents: number;
}
