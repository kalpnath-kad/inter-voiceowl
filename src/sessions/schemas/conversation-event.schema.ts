import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ConversationEventDocument = ConversationEvent & Document;

export enum EventType {
  USER_SPEECH = 'user_speech',
  BOT_SPEECH = 'bot_speech',
  SYSTEM = 'system',
}

@Schema({ timestamps: false })
export class ConversationEvent {
  @Prop({ required: true })
  eventId: string;

  @Prop({ required: true, index: true })
  sessionId: string;

  @Prop({ 
    required: true, 
    enum: EventType,
    index: true,
  })
  type: EventType;

  @Prop({ type: Object, required: true })
  payload: Record<string, any>;

  @Prop({ required: true, index: true })
  timestamp: Date;
}

export const ConversationEventSchema = SchemaFactory.createForClass(ConversationEvent);

// Compound unique index to ensure eventId is unique per session
ConversationEventSchema.index({ sessionId: 1, eventId: 1 }, { unique: true });

// Compound index for efficient querying of events by session ordered by timestamp
ConversationEventSchema.index({ sessionId: 1, timestamp: 1 });
