import type { Server, Socket } from 'socket.io'
import { ZodError } from 'zod'
import { REALTIME_ERROR, REALTIME_EVENT, REALTIME_MESSAGE, REALTIME_SETTINGS } from '../constants/realtime.constants.js'
import { requireSocketAuth, tryAuthenticateHandshake } from './socket.auth.js'
import { SocketService } from './socket.service.js'
import type {
    AckError,
    AckResponse,
    AuthLoginAckData,
    AuthLoginPayload,
    JoinConversationAckData,
    JoinConversationPayload,
    SendMessagePayload,
    SendMessageResult,
    SocketAckCallback,
    SocketContextData,
    TypingAckData,
    TypingPayload,
    ValidationErrorDetail
} from './socket.types.js'

const socketService = new SocketService()

const roomOfConversation = (conversationId: string): string =>
    `${REALTIME_SETTINGS.ROOM_CONVERSATION_PREFIX}${conversationId}`

const now = (): string => new Date().toISOString()

const toAckError = (
    event: string,
    code: AckError['error']['code'],
    message: string,
    details?: AckError['error']['details']
): AckResponse<never> => ({
    ok: false,
    event,
    timestamp: now(),
    error: {
        code,
        message,
        details
    }
})

const toAckSuccess = <T>(event: string, data: T): AckResponse<T> => ({
    ok: true,
    event,
    timestamp: now(),
    data
})

// NOTE: caught exceptions in TS can have any runtime shape, so `unknown` is required here.
const normalizeError = (event: string, error: unknown): AckResponse<never> => {
    if (error instanceof ZodError) {
        const details: ValidationErrorDetail[] = error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code
        }))

        return toAckError(event, REALTIME_ERROR.VALIDATION_FAILED, REALTIME_MESSAGE.VALIDATION_FAILED, details)
    }

    if (error instanceof Error) {
        if (error.message === REALTIME_MESSAGE.UNAUTHORIZED || error.message.includes('access token')) {
            return toAckError(event, REALTIME_ERROR.UNAUTHORIZED, REALTIME_MESSAGE.UNAUTHORIZED)
        }

        if (error.message === REALTIME_ERROR.FORBIDDEN_NOT_CONVERSATION_MEMBER) {
            return toAckError(event, REALTIME_ERROR.FORBIDDEN, REALTIME_MESSAGE.NOT_CONVERSATION_MEMBER)
        }

        return toAckError(event, REALTIME_ERROR.INTERNAL_ERROR, error.message)
    }

    return toAckError(event, REALTIME_ERROR.INTERNAL_ERROR, REALTIME_MESSAGE.INTERNAL_ERROR)
}

const safeAck = <T>(ack: SocketAckCallback<T> | undefined, response: AckResponse<T>): void => {
    if (ack) {
        ack(response)
    }
}

const handleConnection = (socket: Socket): void => {
    const context = socket.data as SocketContextData
    const initialUserId = context.user?.userId

    console.log(`[socket] connected id=${socket.id} userId=${initialUserId ?? 'anonymous'}`)

    socket.on(REALTIME_EVENT.AUTH_LOGIN, (payload: AuthLoginPayload, ack?: SocketAckCallback<AuthLoginAckData>) => {
        try {
            const user = socketService.authenticateByEvent(socket, payload)
            safeAck(ack, toAckSuccess(REALTIME_EVENT.AUTH_LOGIN, { userId: user.userId }))
        } catch (error: unknown) {
            safeAck(ack, normalizeError(REALTIME_EVENT.AUTH_LOGIN, error))
        }
    })

    socket.on(
        REALTIME_EVENT.CONVERSATION_JOIN,
        async (payload: JoinConversationPayload, ack?: SocketAckCallback<JoinConversationAckData>) => {
            try {
                const socketUser = requireSocketAuth(socket)
                const history = await socketService.joinConversation(socketUser, payload)
                const room = roomOfConversation(history.conversationId)

                socket.join(room)
                socket.emit(REALTIME_EVENT.CONVERSATION_HISTORY, history)

                safeAck(
                    ack,
                    toAckSuccess(REALTIME_EVENT.CONVERSATION_JOIN, {
                        conversationId: history.conversationId,
                        joined: true
                    })
                )
            } catch (error: unknown) {
                safeAck(ack, normalizeError(REALTIME_EVENT.CONVERSATION_JOIN, error))
            }
        }
    )

    socket.on(
        REALTIME_EVENT.MESSAGE_SEND,
        async (payload: SendMessagePayload, ack?: SocketAckCallback<SendMessageResult>) => {
            try {
                const socketUser = requireSocketAuth(socket)
                const sentResult = await socketService.sendMessage(socketUser, payload)
                const room = roomOfConversation(sentResult.message.conversationId)

                safeAck(
                    ack,
                    toAckSuccess(REALTIME_EVENT.MESSAGE_SEND, {
                        clientMessageId: sentResult.clientMessageId,
                        message: sentResult.message
                    })
                )

                socket.to(room).emit(REALTIME_EVENT.MESSAGE_NEW, {
                    message: sentResult.message
                })
            } catch (error: unknown) {
                safeAck(ack, normalizeError(REALTIME_EVENT.MESSAGE_SEND, error))
            }
        }
    )

    socket.on(REALTIME_EVENT.MESSAGE_TYPING, async (payload: TypingPayload, ack?: SocketAckCallback<TypingAckData>) => {
        try {
            const socketUser = requireSocketAuth(socket)
            const typingEvent = await socketService.updateTyping(socketUser, payload)
            const room = roomOfConversation(typingEvent.conversationId)

            safeAck(
                ack,
                toAckSuccess(REALTIME_EVENT.MESSAGE_TYPING, {
                    conversationId: typingEvent.conversationId,
                    accepted: true
                })
            )

            socket.to(room).emit(REALTIME_EVENT.MESSAGE_TYPING, typingEvent)
        } catch (error: unknown) {
            safeAck(ack, normalizeError(REALTIME_EVENT.MESSAGE_TYPING, error))
        }
    })

    socket.on(REALTIME_EVENT.DISCONNECT, (reason) => {
        console.log(`[socket] disconnected id=${socket.id} reason=${reason}`)
    })
}

export const registerSocketServer = (io: Server): void => {
    io.use((socket, next) => {
        try {
            tryAuthenticateHandshake(socket)
            next()
        } catch (error) {
            next(error as Error)
        }
    })

    io.on('connection', handleConnection)
}
