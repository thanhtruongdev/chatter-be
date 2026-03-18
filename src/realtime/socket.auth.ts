import jwt from 'jsonwebtoken'
import type { JwtPayload } from 'jsonwebtoken'
import type { Socket } from 'socket.io'
import type { SocketContextData, SocketUser } from './socket.types.js'

interface AccessTokenPayload extends JwtPayload {
    readonly sub: string
    readonly username: string
    readonly email: string
    readonly role?: 'user' | 'moderator' | 'admin'
}

const BEARER_PREFIX = 'Bearer '

const getAccessTokenSecret = (): string => {
    const secret = process.env.JWT_SECRET

    if (!secret) {
        throw new Error('Missing JWT_SECRET environment variable')
    }

    return secret
}

const extractBearerToken = (authorizationHeader?: string): string | null => {
    if (!authorizationHeader || !authorizationHeader.startsWith(BEARER_PREFIX)) {
        return null
    }

    const token = authorizationHeader.slice(BEARER_PREFIX.length).trim()

    if (!token) {
        return null
    }

    return token
}

const isAccessTokenPayload = (payload: JwtPayload | string): payload is AccessTokenPayload => {
    if (typeof payload === 'string') {
        return false
    }

    return typeof payload.sub === 'string' && typeof payload.username === 'string' && typeof payload.email === 'string'
}

export const verifyAccessToken = (token: string): SocketUser => {
    const decoded = jwt.verify(token, getAccessTokenSecret())

    if (!isAccessTokenPayload(decoded)) {
        throw new Error('Invalid access token')
    }

    return {
        userId: decoded.sub,
        username: decoded.username,
        email: decoded.email,
        role: decoded.role ?? 'user'
    }
}

export const tryAuthenticateHandshake = (socket: Socket): void => {
    const authToken =
        typeof socket.handshake.auth.token === 'string'
            ? socket.handshake.auth.token.trim()
            : typeof socket.handshake.auth.authorization === 'string'
              ? extractBearerToken(socket.handshake.auth.authorization)
              : null

    const headerValue = socket.handshake.headers.authorization
    const headerToken = typeof headerValue === 'string' ? extractBearerToken(headerValue) : null
    const token = authToken || headerToken

    const context = socket.data as SocketContextData

    if (!token) {
        context.authenticated = false
        context.user = undefined
        return
    }

    context.user = verifyAccessToken(token)
    context.authenticated = true
}

export const requireSocketAuth = (socket: Socket): SocketUser => {
    const context = socket.data as SocketContextData

    if (!context.authenticated || !context.user) {
        throw new Error('Unauthorized')
    }

    return context.user
}
