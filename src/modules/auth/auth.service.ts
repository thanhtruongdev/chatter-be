import bcrypt from 'bcrypt'
import { createHash } from 'node:crypto'
import jwt from 'jsonwebtoken'
import type { JwtPayload, SignOptions } from 'jsonwebtoken'
import { AuthRepository } from './auth.repository.js'
import type { UserDto, UserRecord } from '../../models/user.js'
import type { AuthResponseData, LoginBody, RefreshTokenBody, RegisterBody } from '../../types/auth.js'

const SALT_ROUNDS = 10
const ACCESS_TOKEN_EXPIRES_IN: SignOptions['expiresIn'] = '30m'
const DEFAULT_REFRESH_TOKEN_EXPIRES_IN: SignOptions['expiresIn'] = '30d'

export class AuthService {
  private readonly authRepository: AuthRepository

  constructor(authRepository: AuthRepository = new AuthRepository()) {
    this.authRepository = authRepository
  }

  async register(input: RegisterBody): Promise<AuthResponseData> {
    const existingByEmail = await this.authRepository.findUserByEmail(input.email)

    if (existingByEmail) {
      throw new Error('Email already exists')
    }

    const existingByUsername = await this.authRepository.findUserByUsername(input.username)

    if (existingByUsername) {
      throw new Error('Username already exists')
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS)
    const createdUser = await this.authRepository.createUser(input, passwordHash)
    const tokens = await this.issueTokens(createdUser)

    return {
      user: this.toAuthUserDto(createdUser),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    }
  }

  async login(input: LoginBody): Promise<AuthResponseData> {
    const normalizedInput = input.emailOrUsername.trim()
    const isEmailInput = normalizedInput.includes('@')

    const user = isEmailInput
      ? await this.authRepository.findUserByEmail(normalizedInput)
      : await this.authRepository.findUserByUsername(normalizedInput)

    if (!user) {
      throw new Error('Invalid credentials')
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password_hash)

    if (!isPasswordValid) {
      throw new Error('Invalid credentials')
    }

    const tokens = await this.issueTokens(user)

    return {
      user: this.toAuthUserDto(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    }
  }

  async refreshToken(input: RefreshTokenBody): Promise<AuthResponseData> {
    const refreshTokenSecret = this.getRefreshTokenSecret()

    try {
      jwt.verify(input.refreshToken, refreshTokenSecret)
    } catch {
      throw new Error('Invalid refresh token')
    }

    const refreshTokenHash = this.hashToken(input.refreshToken)
    const session = await this.authRepository.findValidSessionByRefreshTokenHash(refreshTokenHash)

    if (!session) {
      throw new Error('Invalid refresh token')
    }

    await this.authRepository.revokeSessionById(session.sessionId)
    const tokens = await this.issueTokens(session.user)

    return {
    //   user: this.toAuthUserDto(session.user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    }
  }

  private toAuthUserDto(user: UserRecord): UserDto {
    return {
      id: user.id.toString(),
      username: user.username,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at.toISOString()
    }
  }

  private createAccessToken(user: UserRecord): string {
    const secret = process.env.JWT_SECRET

    if (!secret) {
      throw new Error('Missing JWT_SECRET environment variable')
    }

    const signOptions: SignOptions = {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN
    }

    return jwt.sign(
      {
        sub: user.id.toString(),
        username: user.username,
        email: user.email
      },
      secret,
      signOptions
    )
  }

  private createRefreshToken(user: UserRecord): string {
    const refreshTokenSecret = this.getRefreshTokenSecret()

    const signOptions: SignOptions = {
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? DEFAULT_REFRESH_TOKEN_EXPIRES_IN) as SignOptions['expiresIn']
    }

    return jwt.sign(
      {
        sub: user.id.toString(),
        type: 'refresh'
      },
      refreshTokenSecret,
      signOptions
    )
  }

  private async issueTokens(user: UserRecord): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.createAccessToken(user)
    const refreshToken = this.createRefreshToken(user)
    const refreshTokenHash = this.hashToken(refreshToken)
    const expiresAt = this.getTokenExpiryDate(refreshToken)

    await this.authRepository.createUserSession(user.id, refreshTokenHash, expiresAt)

    return {
      accessToken,
      refreshToken
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  private getTokenExpiryDate(token: string): Date {
    const decoded = jwt.decode(token)

    if (!decoded || typeof decoded === 'string') {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }

    const payload = decoded as JwtPayload

    if (!payload.exp) {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }

    return new Date(payload.exp * 1000)
  }

  private getRefreshTokenSecret(): string {
    const refreshTokenSecret = process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET

    if (!refreshTokenSecret) {
      throw new Error('Missing JWT_REFRESH_SECRET or JWT_SECRET environment variable')
    }

    return refreshTokenSecret
  }
}
