import type { AuthenticatedUser } from '../middleware/auth.middleware.js'
import type { message_type } from '../generated/prisma/enums.js'
import type * as Prisma from '../generated/prisma/internal/prismaNamespace.js'

export type SocketUser = AuthenticatedUser

export type JsonValue = Prisma.JsonValue

export type RealtimeErrorCode = 'unauthorized' | 'forbidden' | 'validation_failed' | 'not_found' | 'internal_error'

export interface ValidationErrorDetail {
    readonly field: string
    readonly code: string
    readonly message: string
}

export interface AuthLoginPayload {
    readonly token: string
}

export interface JoinConversationPayload {
    readonly conversationId: string
    readonly limit?: number
    readonly cursor?: {
        readonly createdAt: string
        readonly id: string
    } | null
}

export interface SendMessagePayload {
    readonly clientMessageId: string
    readonly conversationId: string
    readonly type: 'text' | 'image' | 'file' | 'system'
    readonly content?: string | null
    readonly metadata?: JsonValue | null
    readonly replyToMessageId?: string | null
}

export interface TypingPayload {
    readonly conversationId: string
    readonly isTyping: boolean
}

export interface MessageDto {
    readonly id: string
    readonly conversationId: string
    readonly senderId: string
    readonly type: 'text' | 'image' | 'file' | 'system'
    readonly content: string | null
    readonly metadata: JsonValue | null
    readonly replyToMessageId: string | null
    readonly createdAt: string
}

export interface ConversationHistoryResponse {
    readonly conversationId: string
    readonly messages: MessageDto[]
    readonly nextCursor: {
        readonly createdAt: string
        readonly id: string
    } | null
}

export interface MessageRecord {
    readonly id: bigint
    readonly conversation_id: bigint
    readonly sender_id: bigint
    readonly type: message_type
    readonly content: string | null
    readonly metadata: Prisma.JsonValue | null
    readonly reply_to_message_id: bigint | null
    readonly created_at: Date
}

export interface MessageHistoryCursor {
    readonly createdAt: Date
    readonly id: bigint
}

export interface CreateMessageInput {
    readonly conversationId: bigint
    readonly senderId: bigint
    readonly type: message_type
    readonly content: string | null
    readonly metadata?: Prisma.InputJsonValue
    readonly replyToMessageId: bigint | null
}

export interface SendMessageResult {
    readonly clientMessageId: string
    readonly message: MessageDto
}

export interface TypingEventData {
    readonly conversationId: string
    readonly userId: string
    readonly isTyping: boolean
    readonly at: string
}

export interface AuthLoginAckData {
    readonly userId: string
}

export interface JoinConversationAckData {
    readonly conversationId: string
    readonly joined: boolean
}

export interface TypingAckData {
    readonly conversationId: string
    readonly accepted: boolean
}

export type SocketAckCallback<T> = (response: AckResponse<T>) => void

export type AckSuccess<T> = {
    readonly ok: true
    readonly event: string
    readonly timestamp: string
    readonly data: T
}

export type AckError = {
    readonly ok: false
    readonly event: string
    readonly timestamp: string
    readonly error: {
        readonly code: RealtimeErrorCode
        readonly message: string
        readonly details?: JsonValue | ValidationErrorDetail[]
    }
}

export type AckResponse<T> = AckSuccess<T> | AckError

export interface SocketContextData {
    user?: SocketUser
    authenticated?: boolean
}
