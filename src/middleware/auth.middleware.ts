import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import type { JwtPayload } from 'jsonwebtoken'
import { ApiResponseFactory } from '../types/api.js'

export type UserRole = 'user' | 'moderator' | 'admin'

export interface AccessTokenPayload extends JwtPayload {
  readonly sub: string
  readonly username: string
  readonly email: string
  readonly role?: UserRole
}

export interface AuthenticatedUser {
  readonly userId: string
  readonly username: string
  readonly email: string
  readonly role: UserRole
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

export const authenticate = (req: Request, res: Response, next: NextFunction): Response | void => {
  const token = extractBearerToken(req.headers.authorization)

  if (!token) {
    return res.status(401).json(ApiResponseFactory.error('Unauthorized').toJSON())
  }

  try {
    const decoded = jwt.verify(token, getAccessTokenSecret())

    if (!isAccessTokenPayload(decoded)) {
      return res.status(401).json(ApiResponseFactory.error('Invalid access token').toJSON())
    }

    req.user = {
      userId: decoded.sub,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role ?? 'user'
    }

    return next()
  } catch {
    return res.status(401).json(ApiResponseFactory.error('Invalid or expired access token').toJSON())
  }
}

export const authorizeRoles =
  (...allowedRoles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction): Response | void => {
    if (!req.user) {
      return res.status(401).json(ApiResponseFactory.error('Unauthorized').toJSON())
    }

    if (allowedRoles.length === 0 || allowedRoles.includes(req.user.role)) {
      return next()
    }

    return res.status(403).json(ApiResponseFactory.error('Forbidden').toJSON())
  }
