import 'dotenv/config'
import { io, type Socket } from 'socket.io-client'

interface AckError {
    readonly ok: false
    readonly event: string
    readonly timestamp: string
    readonly error: {
        readonly code: string
        readonly message: string
        readonly details?: unknown
    }
}

interface AckSuccess<T> {
    readonly ok: true
    readonly event: string
    readonly timestamp: string
    readonly data: T
}

type AckResponse<T> = AckSuccess<T> | AckError

interface MessageDto {
    readonly id: string
    readonly conversationId: string
    readonly senderId: string
    readonly type: 'text' | 'image' | 'file' | 'system'
    readonly content: string | null
    readonly metadata: unknown | null
    readonly replyToMessageId: string | null
    readonly createdAt: string
}

const SOCKET_URL = process.env.SOCKET_TEST_URL ?? 'http://localhost:3001'
const SOCKET_PATH = process.env.SOCKET_TEST_PATH ?? '/socket.io'
const CLIENT_A_TOKEN = process.env.SOCKET_TEST_TOKEN_A ?? ''
const CLIENT_B_TOKEN = process.env.SOCKET_TEST_TOKEN_B ?? ''
const CONVERSATION_ID = process.env.SOCKET_TEST_CONVERSATION_ID ?? ''
const SOCKET_TIMEOUT_MS = Number(process.env.SOCKET_TEST_TIMEOUT_MS ?? '10000')

const requiredConfig = [
    ['SOCKET_TEST_TOKEN_A', CLIENT_A_TOKEN],
    ['SOCKET_TEST_TOKEN_B', CLIENT_B_TOKEN],
    ['SOCKET_TEST_CONVERSATION_ID', CONVERSATION_ID]
]

const missingConfig = requiredConfig.filter(([, value]) => !value).map(([name]) => name)

if (missingConfig.length > 0) {
    throw new Error(`Missing required env vars: ${missingConfig.join(', ')}`)
}

const createClient = (token: string): Socket =>
    io(SOCKET_URL, {
        path: SOCKET_PATH,
        auth: {
            token
        },
        transports: ['websocket'],
        timeout: SOCKET_TIMEOUT_MS,
        autoConnect: false
    })

const waitForConnect = (socket: Socket): Promise<void> =>
    new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Socket connect timeout: ${socket.id ?? 'unknown'}`))
        }, SOCKET_TIMEOUT_MS)

        socket.once('connect', () => {
            clearTimeout(timeout)
            resolve()
        })

        socket.once('connect_error', (error) => {
            clearTimeout(timeout)
            reject(error)
        })

        socket.connect()
    })

const emitWithAck = <TResponse>(socket: Socket, event: string, payload: unknown): Promise<AckResponse<TResponse>> =>
    new Promise((resolve, reject) => {
        let finished = false

        const timer = setTimeout(() => {
            if (!finished) {
                finished = true
                reject(new Error(`Ack timeout for event ${event}`))
            }
        }, SOCKET_TIMEOUT_MS)

        socket.emit(event, payload, (response: AckResponse<TResponse>) => {
            if (finished) {
                return
            }

            finished = true
            clearTimeout(timer)
            resolve(response)
        })
    })

const waitForEvent = <T>(socket: Socket, event: string): Promise<T> =>
    new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Event timeout: ${event}`)), SOCKET_TIMEOUT_MS)

        socket.once(event, (payload: T) => {
            clearTimeout(timer)
            resolve(payload)
        })
    })

const assertAckSuccess = <T>(response: AckResponse<T>, event: string): T => {
    if (!response.ok) {
        throw new Error(`Expected success ack for ${event}, got ${response.error.code}: ${response.error.message}`)
    }

    return response.data
}

const run = async (): Promise<void> => {
    const clientA = createClient(CLIENT_A_TOKEN)
    const clientB = createClient(CLIENT_B_TOKEN)

    try {
        console.log('[integration] connecting clients...')
        await Promise.all([waitForConnect(clientA), waitForConnect(clientB)])

        console.log('[integration] clients connected, joining conversation...')

        const joinPayload = {
            conversationId: CONVERSATION_ID,
            limit: 30,
            cursor: null
        }

        const historyA = waitForEvent<{ conversationId: string; messages: MessageDto[]; nextCursor: unknown }>(
            clientA,
            'conversation:history'
        )
        const historyB = waitForEvent<{ conversationId: string; messages: MessageDto[]; nextCursor: unknown }>(
            clientB,
            'conversation:history'
        )

        const joinAckA = await emitWithAck<{ conversationId: string; joined: boolean }>(
            clientA,
            'conversation:join',
            joinPayload
        )
        const joinAckB = await emitWithAck<{ conversationId: string; joined: boolean }>(
            clientB,
            'conversation:join',
            joinPayload
        )

        assertAckSuccess(joinAckA, 'conversation:join')
        assertAckSuccess(joinAckB, 'conversation:join')

        const [joinedHistoryA, joinedHistoryB] = await Promise.all([historyA, historyB])

        console.log(
            `[integration] history loaded A=${joinedHistoryA.messages.length} messages, B=${joinedHistoryB.messages.length} messages`
        )

        const testContent = `integration-test-${Date.now()}`

        const expectedBroadcast = waitForEvent<{ message: MessageDto }>(clientB, 'message:new')

        const sendAck = await emitWithAck<{ clientMessageId: string; message: MessageDto }>(clientA, 'message:send', {
            clientMessageId: `it-${Date.now()}`,
            conversationId: CONVERSATION_ID,
            type: 'text',
            content: testContent,
            metadata: null,
            replyToMessageId: null
        })

        const sendData = assertAckSuccess(sendAck, 'message:send')
        const receivedOnB = await expectedBroadcast

        if (sendData.message.content !== testContent) {
            throw new Error('Sender ack content mismatch')
        }

        if (receivedOnB.message.content !== testContent) {
            throw new Error('Broadcast content mismatch on client B')
        }

        if (receivedOnB.message.id !== sendData.message.id) {
            throw new Error('Broadcast message id mismatch with sender ack')
        }

        console.log('[integration] PASS join/send/broadcast flow verified')
    } finally {
        clientA.disconnect()
        clientB.disconnect()
    }
}

run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown integration error'
    console.error(`[integration] FAIL ${message}`)
    process.exitCode = 1
})
