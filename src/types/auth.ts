import type { UserDto } from '../models/user.js'

export interface RegisterBody {
  readonly username: string
  readonly email: string
  readonly password: string
  readonly displayName?: string
}

export interface LoginBody {
  readonly emailOrUsername: string
  readonly password: string
}

export interface RefreshTokenBody {
  readonly refreshToken: string
}

export interface AuthResponseData {
  readonly user?: UserDto
  readonly accessToken: string
  readonly refreshToken: string
}
