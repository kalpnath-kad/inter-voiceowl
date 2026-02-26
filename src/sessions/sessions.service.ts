import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { SessionRepository } from './repositories/session.repository';
import { CreateSessionDto } from './dto/create-session.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { QuerySessionDto } from './dto/query-session.dto';
import { SessionResponse, EventResponse } from './interfaces/session.interface';
import { SessionStatus } from './schemas/conversation-session.schema';

@Injectable()
export class SessionsService {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async createOrUpsertSession(dto: CreateSessionDto): Promise<SessionResponse> {
    // Use atomic upsert operation to handle concurrent requests safely
    // If session exists, return it; otherwise create it
    const session = await this.sessionRepository.findOneAndUpsert(dto.sessionId, {
      sessionId: dto.sessionId,
      status: dto.status || SessionStatus.INITIATED,
      language: dto.language,
      startedAt: new Date(),
      endedAt: null,
      metadata: dto.metadata || {},
    });

    return this.mapToSessionResponse(session, []);
  }

  async addEventToSession(
    sessionId: string,
    dto: CreateEventDto,
  ): Promise<EventResponse> {
    // Verify session exists
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    // Use atomic upsert operation for idempotency and concurrency safety
    // If event already exists, return it; otherwise create it
    const event = await this.sessionRepository.findOneAndUpsertEvent(
      sessionId,
      dto.eventId,
      {
        eventId: dto.eventId,
        sessionId,
        type: dto.type,
        payload: dto.payload,
        timestamp: dto.timestamp || new Date(),
      },
    );

    // findOneAndUpsertEvent should always return an event (existing or newly created)
    // If null, it means there was an unexpected error
    if (!event) {
      throw new ConflictException(
        `Event with ID ${dto.eventId} could not be created or retrieved for session ${sessionId}`,
      );
    }

    return this.mapToEventResponse(event);
  }

  async getSessionWithEvents(
    sessionId: string,
    query: QuerySessionDto,
  ): Promise<SessionResponse> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    const limit = query.limit || 50;
    const offset = query.offset || 0;

    const { events, total } = await this.sessionRepository.findEventsBySession(
      sessionId,
      limit,
      offset,
    );

    return this.mapToSessionResponse(session, events, total);
  }

  async completeSession(sessionId: string): Promise<SessionResponse> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    // Idempotent: if already completed, return as-is
    if (session.status === SessionStatus.COMPLETED) {
      const { events } = await this.sessionRepository.findEventsBySession(
        sessionId,
        50,
        0,
      );
      return this.mapToSessionResponse(session, events);
    }

    const endedAt = new Date();
    const updatedSession = await this.sessionRepository.updateStatus(
      sessionId,
      SessionStatus.COMPLETED,
      endedAt,
    );

    if (!updatedSession) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    const { events } = await this.sessionRepository.findEventsBySession(
      sessionId,
      50,
      0,
    );

    return this.mapToSessionResponse(updatedSession, events);
  }

  private mapToSessionResponse(
    session: any,
    events: any[],
    totalEvents?: number,
  ): SessionResponse {
    return {
      sessionId: session.sessionId,
      status: session.status,
      language: session.language,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      metadata: session.metadata || {},
      events: events.map((e) => this.mapToEventResponse(e)),
      totalEvents: totalEvents !== undefined ? totalEvents : events.length,
    };
  }

  private mapToEventResponse(event: any): EventResponse {
    return {
      eventId: event.eventId,
      sessionId: event.sessionId,
      type: event.type,
      payload: event.payload,
      timestamp: event.timestamp,
    };
  }
}
