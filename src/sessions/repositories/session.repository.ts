import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConversationSession, ConversationSessionDocument } from '../schemas/conversation-session.schema';
import { ConversationEvent, ConversationEventDocument } from '../schemas/conversation-event.schema';

@Injectable()
export class SessionRepository {
  constructor(
    @InjectModel(ConversationSession.name)
    private sessionModel: Model<ConversationSessionDocument>,
    @InjectModel(ConversationEvent.name)
    private eventModel: Model<ConversationEventDocument>,
  ) {}

  async findById(sessionId: string): Promise<ConversationSessionDocument | null> {
    return this.sessionModel.findOne({ sessionId }).exec();
  }

  async create(session: Partial<ConversationSession>): Promise<ConversationSessionDocument> {
    const newSession = new this.sessionModel(session);
    return newSession.save();
  }

  async findOneAndUpsert(
    sessionId: string,
    session: Partial<ConversationSession>,
  ): Promise<ConversationSessionDocument> {
    // Atomic upsert operation - if session exists, return it; otherwise create it
    return this.sessionModel
      .findOneAndUpdate(
        { sessionId },
        {
          $setOnInsert: session,
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
        },
      )
      .exec();
  }

  async updateStatus(
    sessionId: string,
    status: string,
    endedAt?: Date,
  ): Promise<ConversationSessionDocument | null> {
    const update: any = { status };
    if (endedAt !== undefined) {
      update.endedAt = endedAt;
    }
    return this.sessionModel
      .findOneAndUpdate({ sessionId }, update, { new: true })
      .exec();
  }

  async findEventBySessionAndEventId(
    sessionId: string,
    eventId: string,
  ): Promise<ConversationEventDocument | null> {
    return this.eventModel.findOne({ sessionId, eventId }).exec();
  }

  async createEvent(event: Partial<ConversationEvent>): Promise<ConversationEventDocument> {
    const newEvent = new this.eventModel(event);
    return newEvent.save();
  }

  async findOneAndUpsertEvent(
    sessionId: string,
    eventId: string,
    event: Partial<ConversationEvent>,
  ): Promise<ConversationEventDocument | null> {
    // Atomic upsert operation - if event exists, return it; otherwise create it
    // Returns null if event already exists (to maintain immutability)
    try {
      return await this.eventModel
        .findOneAndUpdate(
          { sessionId, eventId },
          {
            $setOnInsert: event,
          },
          {
            upsert: true,
            new: true,
            runValidators: true,
          },
        )
        .exec();
    } catch (error: any) {
      // If duplicate key error, event already exists - fetch and return it
      if (error.code === 11000) {
        return this.findEventBySessionAndEventId(sessionId, eventId);
      }
      throw error;
    }
  }

  async findEventsBySession(
    sessionId: string,
    limit: number,
    offset: number,
  ): Promise<{ events: ConversationEventDocument[]; total: number }> {
    const [events, total] = await Promise.all([
      this.eventModel
        .find({ sessionId })
        .sort({ timestamp: 1 })
        .skip(offset)
        .limit(limit)
        .exec(),
      this.eventModel.countDocuments({ sessionId }).exec(),
    ]);

    return { events, total };
  }

  async updateEvent(
    sessionId: string,
    eventId: string,
    update: Partial<ConversationEvent>,
  ): Promise<ConversationEventDocument | null> {
    return this.eventModel
      .findOneAndUpdate(
        { sessionId, eventId },
        { $set: update },
        { new: true, runValidators: true },
      )
      .exec();
  }
}
