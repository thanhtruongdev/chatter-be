import prisma from '../../prisma.js'
import type { UserRecord } from '../../models/user.js'
import type { RegisterBody } from '../../types/auth.js'

interface ValidSessionWithUser {
  readonly sessionId: bigint
  readonly user: UserRecord
}

export class AuthRepository {
  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const user = await prisma.users.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        username: true,
        email: true,
        password_hash: true,
        display_name: true,
        avatar_url: true,
        created_at: true
      }
    })

    return user
  }

  async findUserByUsername(username: string): Promise<UserRecord | null> {
    const user = await prisma.users.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        email: true,
        password_hash: true,
        display_name: true,
        avatar_url: true,
        created_at: true
      }
    })

    return user
  }

  async createUser(input: RegisterBody, passwordHash: string): Promise<UserRecord> {
    const createdUser = await prisma.users.create({
      data: {
        username: input.username,
        email: input.email.toLowerCase(),
        password_hash: passwordHash,
        display_name: input.displayName
      },
      select: {
        id: true,
        username: true,
        email: true,
        password_hash: true,
        display_name: true,
        avatar_url: true,
        created_at: true
      }
    })

    return createdUser
  }

  async createUserSession(userId: bigint, refreshTokenHash: string, expiresAt: Date): Promise<void> {
    await prisma.user_sessions.create({
      data: {
        user_id: userId,
        refresh_token_hash: refreshTokenHash,
        expires_at: expiresAt
      }
    })
  }

  async findValidSessionByRefreshTokenHash(refreshTokenHash: string): Promise<ValidSessionWithUser | null> {
    const session = await prisma.user_sessions.findFirst({
      where: {
        refresh_token_hash: refreshTokenHash,
        revoked_at: null,
        expires_at: {
          gt: new Date()
        }
      },
      select: {
        id: true,
        users: {
          select: {
            id: true,
            username: true,
            email: true,
            password_hash: true,
            display_name: true,
            avatar_url: true,
            created_at: true
          }
        }
      }
    })

    if (!session || !session.users) {
      return null
    }

    return {
      sessionId: session.id,
      user: session.users
    }
  }

  async revokeSessionById(sessionId: bigint): Promise<void> {
    await prisma.user_sessions.update({
      where: { id: sessionId },
      data: { revoked_at: new Date() }
    })
  }
}
