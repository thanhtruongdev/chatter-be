import type { Request, Response } from 'express'
import { ApiResponseFactory } from '../../types/api.js'
import type { ApiErrorDetail } from '../../types/api.js'
import type { CreateConversationBody } from '../../types/conversation.js'
import { ConversationService } from './conversation.service.js'
import { createConversationSchema } from './conversation.validation.js'

export class ConversationController {
	private readonly conversationService: ConversationService

	constructor(conversationService: ConversationService = new ConversationService()) {
		this.conversationService = conversationService
	}

	createConversation = async (req: Request, res: Response): Promise<Response> => {
		if (!req.user) {
			return res.status(401).json(ApiResponseFactory.error('Unauthorized').toJSON())
		}

		const parsedBody = createConversationSchema.safeParse(req.body)

		if (!parsedBody.success) {
			const errors: ApiErrorDetail[] = parsedBody.error.issues.map((issue) => ({
				field: issue.path.join('.'),
				message: issue.message,
				code: issue.code
			}))

			return res.status(400).json(ApiResponseFactory.error('Validation failed', errors).toJSON())
		}

		const body: CreateConversationBody = parsedBody.data

		try {
			const data = await this.conversationService.createConversation(req.user.userId, body)
			return res.status(201).json(ApiResponseFactory.success('Create conversation success', data).toJSON())
		} catch (error: unknown) {
			const message = this.getErrorMessage(error)
			const statusCode = this.getStatusCodeByMessage(message)

			return res.status(statusCode).json(ApiResponseFactory.error(message).toJSON())
		}
	}

	private getErrorMessage(error: unknown): string {
		if (error instanceof Error) {
			return error.message
		}

		return 'Internal server error'
	}

	private getStatusCodeByMessage(message: string): number {
		if (message === 'One or more members do not exist') {
			return 404
		}

		if (message.includes('Invalid user id') || message.includes('memberIds must not include')) {
			return 400
		}

		return 500
	}
}
