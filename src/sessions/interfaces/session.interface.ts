import { SessionStatus } from '../schemas/conversation-session.schema';
import { EventType } from '../schemas/conversation-event.schema';

export interface SessionResponse {
  sessionId: string;
  status: SessionStatus;
  language: string;
  startedAt: Date;
  endedAt: Date | null;
  metadata: Record<string, any>;
  events: EventResponse[];
  totalEvents: number;
}

export interface EventResponse {
  eventId: string;
  sessionId: string;
  type: EventType;
  payload: Record<string, any>;
  timestamp: Date;
}
