import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ConversationSessionDocument = ConversationSession & Document;

export enum SessionStatus {
  INITIATED = 'initiated',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Schema({ timestamps: false })
export class ConversationSession {
  @Prop({ required: true, unique: true, index: true })
  sessionId: string;

  @Prop({ 
    required: true, 
    enum: SessionStatus,
    default: SessionStatus.INITIATED,
    index: true,
  })
  status: SessionStatus;

  @Prop({ required: true, index: true })
  language: string;

  @Prop({ required: true })
  startedAt: Date;

  @Prop({ default: null })
  endedAt: Date | null;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const ConversationSessionSchema = SchemaFactory.createForClass(ConversationSession);

// Compound index for common query patterns
ConversationSessionSchema.index({ status: 1, startedAt: -1 });
ConversationSessionSchema.index({ language: 1, startedAt: -1 });
