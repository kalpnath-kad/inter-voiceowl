import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { QuerySessionDto } from './dto/query-session.dto';
import { SessionResponse, EventResponse } from './interfaces/session.interface';
import { SessionResponseDto, EventResponseDto } from './dto/session-response.dto';

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create or upsert a session',
    description:
      'Creates a new conversation session or returns an existing one if the sessionId already exists. This operation is idempotent and safe under concurrent requests.',
  })
  @ApiResponse({
    status: 200,
    description: 'Session created or retrieved successfully',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createOrUpsertSession(
    @Body() createSessionDto: CreateSessionDto,
  ): Promise<SessionResponse> {
    return this.sessionsService.createOrUpsertSession(createSessionDto);
  }

  @Post(':sessionId/events')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add an event to a session',
    description:
      'Adds a new event to an existing session. The eventId is automatically generated and unique per session. Each request creates a new event.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session identifier',
    example: 'session-123',
  })
  @ApiResponse({
    status: 201,
    description: 'Event created successfully',
    type: EventResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async addEventToSession(
    @Param('sessionId') sessionId: string,
    @Body() createEventDto: CreateEventDto,
  ): Promise<EventResponse> {
    return this.sessionsService.addEventToSession(sessionId, createEventDto);
  }

  @Get(':sessionId')
  @ApiOperation({
    summary: 'Get session with events',
    description:
      'Retrieves a session and its associated events, ordered by timestamp. Supports pagination.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session identifier',
    example: 'session-123',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of events to return',
    example: 50,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of events to skip',
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: 'Session retrieved successfully',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getSessionWithEvents(
    @Param('sessionId') sessionId: string,
    @Query() query: QuerySessionDto,
  ): Promise<SessionResponse> {
    return this.sessionsService.getSessionWithEvents(sessionId, query);
  }

  @Post(':sessionId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete a session',
    description:
      'Marks a session as completed and sets the endedAt timestamp. This operation is idempotent.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session identifier',
    example: 'session-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Session completed successfully',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async completeSession(
    @Param('sessionId') sessionId: string,
  ): Promise<SessionResponse> {
    return this.sessionsService.completeSession(sessionId);
  }
}
