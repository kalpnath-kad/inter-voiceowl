import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SessionRepository } from './repositories/session.repository';
import { CreateSessionDto } from './dto/create-session.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { QuerySessionDto } from './dto/query-session.dto';
import { SessionResponse, EventResponse } from './interfaces/session.interface';
import { SessionStatus } from './schemas/conversation-session.schema';
import { ConversationSessionDocument } from './schemas/conversation-session.schema';
import { ConversationEventDocument } from './schemas/conversation-event.schema';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(private readonly sessionRepository: SessionRepository) {}

  async createOrUpsertSession(dto: CreateSessionDto): Promise<SessionResponse> {
    try {
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to create or upsert session ${dto.sessionId}: ${errorMessage}`,
        errorStack,
      );
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to create or retrieve session: ${errorMessage}`,
      );
    }
  }

  async addEventToSession(
    sessionId: string,
    dto: CreateEventDto,
  ): Promise<EventResponse> {
    try {
      // Verify session exists
      const session = await this.sessionRepository.findById(sessionId);
      if (!session) {
        throw new NotFoundException(`Session with ID ${sessionId} not found`);
      }

      // Generate unique eventId
      const eventId = randomUUID();

      // Create new event (eventId and timestamp are auto-generated)
      const event = await this.sessionRepository.createEvent({
        eventId,
        sessionId,
        type: dto.type,
        payload: dto.payload,
      });

      return this.mapToEventResponse(event);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to add event to session ${sessionId}: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        `Failed to add event to session: ${errorMessage}`,
      );
    }
  }

  async getSessionWithEvents(
    sessionId: string,
    query: QuerySessionDto,
  ): Promise<SessionResponse> {
    try {
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
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to get session ${sessionId} with events: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        `Failed to retrieve session: ${errorMessage}`,
      );
    }
  }

  async completeSession(sessionId: string): Promise<SessionResponse> {
    try {
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
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to complete session ${sessionId}: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        `Failed to complete session: ${errorMessage}`,
      );
    }
  }

  private mapToSessionResponse(
    session: ConversationSessionDocument,
    events: ConversationEventDocument[],
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

  private mapToEventResponse(event: ConversationEventDocument): EventResponse {
    return {
      eventId: event.eventId,
      sessionId: event.sessionId,
      type: event.type,
      payload: event.payload,
      timestamp: event.timestamp,
    };
  }
}
