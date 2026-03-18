import type { Socket } from 'socket.io'
import { z } from 'zod'
import type * as Prisma from '../generated/prisma/internal/prismaNamespace.js'
import { REALTIME_ERROR, REALTIME_MESSAGE, REALTIME_SETTINGS } from '../constants/realtime.constants.js'
import { verifyAccessToken } from './socket.auth.js'
import { SocketRepository } from './socket.repository.js'
import type {
    AuthLoginPayload,
    ConversationHistoryResponse,
    JoinConversationPayload,
    MessageRecord,
    MessageDto,
    SendMessagePayload,
    SendMessageResult,
    TypingEventData,
    TypingPayload,
    SocketContextData,
    SocketUser
} from './socket.types.js'

const joinConversationSchema = z.object({
    conversationId: z.string().trim().regex(/^\d+$/, 'Conversation id must be a numeric string'),
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z
        .object({
            createdAt: z.iso.datetime(),
            id: z.string().trim().regex(/^\d+$/, 'Cursor id must be a numeric string')
        })
        .nullable()
        .optional()
})

const sendMessageSchema = z
    .object({
        clientMessageId: z.string().trim().min(1, 'clientMessageId is required').max(120),
        conversationId: z.string().trim().regex(/^\d+$/, 'Conversation id must be a numeric string'),
        type: z.enum(['text', 'image', 'file', 'system']),
        content: z.string().trim().max(4000).nullable().optional(),
        metadata: z.json().nullable().optional(),
        replyToMessageId: z.string().trim().regex(/^\d+$/, 'replyToMessageId must be numeric').nullable().optional()
    })
    .superRefine((value, ctx) => {
        if (value.type === 'text' && (!value.content || value.content.trim().length === 0)) {
            ctx.addIssue({
                path: ['content'],
                code: z.ZodIssueCode.custom,
                message: 'content is required for text message'
            })
        }
    })

const authLoginSchema = z.object({
    token: z.string().trim().min(1, 'token is required')
})

const typingSchema = z.object({
    conversationId: z.string().trim().regex(/^\d+$/, 'Conversation id must be a numeric string'),
    isTyping: z.boolean()
})

const toMessageDto = (message: MessageRecord): MessageDto => ({
    id: message.id.toString(),
    conversationId: message.conversation_id.toString(),
    senderId: message.sender_id.toString(),
    type: message.type,
    content: message.content,
    metadata: message.metadata,
    replyToMessageId: message.reply_to_message_id?.toString() ?? null,
    createdAt: message.created_at.toISOString()
})

const parseUserId = (userId: string): bigint => {
    if (!/^\d+$/.test(userId)) {
        throw new Error(REALTIME_MESSAGE.INVALID_USER_ID)
    }

    return BigInt(userId)
}

const parseConversationId = (conversationId: string): bigint => BigInt(conversationId)

const resolveLimit = (limit?: number): number => {
    if (!limit) {
        return REALTIME_SETTINGS.HISTORY_DEFAULT_LIMIT
    }

    return Math.min(limit, REALTIME_SETTINGS.HISTORY_MAX_LIMIT)
}

export class SocketService {
    private readonly socketRepository: SocketRepository

    constructor(socketRepository: SocketRepository = new SocketRepository()) {
        this.socketRepository = socketRepository
    }

    authenticateByEvent(socket: Socket, payload: AuthLoginPayload): SocketUser {
        const parsed = authLoginSchema.parse(payload)
        const user = verifyAccessToken(parsed.token)
        const context = socket.data as SocketContextData

        context.user = user
        context.authenticated = true

        return user
    }

    async joinConversation(
        socketUser: SocketUser,
        payload: JoinConversationPayload
    ): Promise<ConversationHistoryResponse> {
        const parsed = joinConversationSchema.parse(payload)
        const userId = parseUserId(socketUser.userId)
        const conversationId = parseConversationId(parsed.conversationId)

        const isMember = await this.socketRepository.isActiveConversationMember(conversationId, userId)

        if (!isMember) {
            throw new Error(REALTIME_ERROR.FORBIDDEN_NOT_CONVERSATION_MEMBER)
        }

        const messages = await this.socketRepository.getConversationHistory(
            conversationId,
            resolveLimit(parsed.limit),
            parsed.cursor
                ? {
                      createdAt: new Date(parsed.cursor.createdAt),
                      id: BigInt(parsed.cursor.id)
                  }
                : undefined
        )

        const nextCursor =
            messages.length > 0
                ? {
                      createdAt: messages[messages.length - 1].created_at.toISOString(),
                      id: messages[messages.length - 1].id.toString()
                  }
                : null

        return {
            conversationId: parsed.conversationId,
            messages: messages.map(toMessageDto),
            nextCursor
        }
    }

    async sendMessage(socketUser: SocketUser, payload: SendMessagePayload): Promise<SendMessageResult> {
        const parsed = sendMessageSchema.parse(payload)
        const userId = parseUserId(socketUser.userId)
        const conversationId = parseConversationId(parsed.conversationId)

        const isMember = await this.socketRepository.isActiveConversationMember(conversationId, userId)

        if (!isMember) {
            throw new Error(REALTIME_ERROR.FORBIDDEN_NOT_CONVERSATION_MEMBER)
        }

        const parsedMetadata: Prisma.InputJsonValue | undefined =
            parsed.metadata === null || parsed.metadata === undefined
                ? undefined
                : (parsed.metadata as Prisma.InputJsonValue)

        const createdMessage = await this.socketRepository.createMessageAndTouchConversation({
            conversationId,
            senderId: userId,
            type: parsed.type,
            content: parsed.content ?? null,
            metadata: parsedMetadata,
            replyToMessageId: parsed.replyToMessageId ? BigInt(parsed.replyToMessageId) : null
        })

        return {
            clientMessageId: parsed.clientMessageId,
            message: toMessageDto(createdMessage)
        }
    }

    async updateTyping(socketUser: SocketUser, payload: TypingPayload): Promise<TypingEventData> {
        const parsed = typingSchema.parse(payload)
        const userId = parseUserId(socketUser.userId)
        const conversationId = parseConversationId(parsed.conversationId)

        const isMember = await this.socketRepository.isActiveConversationMember(conversationId, userId)

        if (!isMember) {
            throw new Error(REALTIME_ERROR.FORBIDDEN_NOT_CONVERSATION_MEMBER)
        }

        return {
            conversationId: parsed.conversationId,
            userId: socketUser.userId,
            isTyping: parsed.isTyping,
            at: new Date().toISOString()
        }
    }
}
