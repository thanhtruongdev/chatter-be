export const REALTIME_EVENT = {
    AUTH_LOGIN: 'auth:login',
    CONVERSATION_JOIN: 'conversation:join',
    CONVERSATION_HISTORY: 'conversation:history',
    MESSAGE_SEND: 'message:send',
    MESSAGE_NEW: 'message:new',
    MESSAGE_TYPING: 'message:typing',
    DISCONNECT: 'disconnect'
} as const

export const REALTIME_ERROR = {
    UNAUTHORIZED: 'unauthorized',
    FORBIDDEN: 'forbidden',
    VALIDATION_FAILED: 'validation_failed',
    NOT_FOUND: 'not_found',
    INTERNAL_ERROR: 'internal_error',
    FORBIDDEN_NOT_CONVERSATION_MEMBER: 'FORBIDDEN_NOT_CONVERSATION_MEMBER'
} as const

export const REALTIME_MESSAGE = {
    VALIDATION_FAILED: 'Validation failed',
    UNAUTHORIZED: 'Unauthorized',
    INTERNAL_ERROR: 'Internal server error',
    NOT_CONVERSATION_MEMBER: 'You are not a member of this conversation',
    INVALID_USER_ID: 'Invalid user id in access token',
    INVALID_ACCESS_TOKEN: 'Invalid access token'
} as const

export const REALTIME_SETTINGS = {
    HISTORY_DEFAULT_LIMIT: 30,
    HISTORY_MAX_LIMIT: 100,
    ROOM_CONVERSATION_PREFIX: 'conversation:'
} as const
