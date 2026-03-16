import type { Request, Response } from 'express'
import { ApiResponseFactory } from '../../types/api.js'
import type { ApiErrorDetail } from '../../types/api.js'
import type { LoginBody, RefreshTokenBody, RegisterBody } from '../../types/auth.js'
import { AuthService } from './auth.service.js'
import { loginSchema, refreshTokenSchema, registerSchema } from './auth.validation.js'

export class AuthController {
  private readonly authService: AuthService

  constructor(authService: AuthService = new AuthService()) {
    this.authService = authService
  }

  register = async (req: Request, res: Response): Promise<Response> => {
    const parsedBody = registerSchema.safeParse(req.body)

    if (!parsedBody.success) {
      const errors: ApiErrorDetail[] = parsedBody.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code
      }))

      return res.status(400).json(ApiResponseFactory.error('Validation failed', errors).toJSON())
    }

    const body: RegisterBody = parsedBody.data

    try {
      const data = await this.authService.register(body)
      return res.status(201).json(ApiResponseFactory.success('Register success', data).toJSON())
    } catch (error: unknown) {
      const message = this.getErrorMessage(error)
      const statusCode = message.includes('exists') ? 409 : 500

      return res.status(statusCode).json(ApiResponseFactory.error(message).toJSON())
    }
  }

  login = async (req: Request, res: Response): Promise<Response> => {
    const parsedBody = loginSchema.safeParse(req.body)

    if (!parsedBody.success) {
      const errors: ApiErrorDetail[] = parsedBody.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code
      }))

      return res.status(400).json(ApiResponseFactory.error('Validation failed', errors).toJSON())
    }

    const body: LoginBody = parsedBody.data

    try {
      const data = await this.authService.login(body)
      return res.status(200).json(ApiResponseFactory.success('Login success', data).toJSON())
    } catch (error: unknown) {
      const message = this.getErrorMessage(error)
      const statusCode = message === 'Invalid credentials' ? 401 : 500

      return res.status(statusCode).json(ApiResponseFactory.error(message).toJSON())
    }
  }

  refreshToken = async (req: Request, res: Response): Promise<Response> => {
    const parsedBody = refreshTokenSchema.safeParse(req.body)

    if (!parsedBody.success) {
      const errors: ApiErrorDetail[] = parsedBody.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code
      }))

      return res.status(400).json(ApiResponseFactory.error('Validation failed', errors).toJSON())
    }

    const body: RefreshTokenBody = parsedBody.data

    try {
      const data = await this.authService.refreshToken(body)
      return res.status(200).json(ApiResponseFactory.success('Refresh token success', data).toJSON())
    } catch (error: unknown) {
      const message = this.getErrorMessage(error)
      const statusCode = message === 'Invalid refresh token' ? 401 : 500

      return res.status(statusCode).json(ApiResponseFactory.error(message).toJSON())
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }

    return 'Internal server error'
  }
}
