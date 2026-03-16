import { z } from 'zod'

const conversationTypeSchema = z.enum(['direct', 'group', 'channel'])

export const createConversationSchema = z
	.object({
		type: conversationTypeSchema.default('direct'),
		title: z
			.string()
			.trim()
			.min(1, 'Title cannot be empty')
			.max(255, 'Title must be at most 255 characters')
			.optional(),
		memberIds: z
			.array(z.string().trim().regex(/^\d+$/, 'Member id must be a numeric string'))
			.min(1, 'At least one member is required')
	})
	.superRefine((value, ctx) => {
		if (value.type === 'direct' && value.memberIds.length !== 1) {
			ctx.addIssue({
				path: ['memberIds'],
				code: z.ZodIssueCode.custom,
				message: 'Direct conversation requires exactly one member id'
			})
		}

		if ((value.type === 'group' || value.type === 'channel') && !value.title) {
			ctx.addIssue({
				path: ['title'],
				code: z.ZodIssueCode.custom,
				message: 'Title is required for group or channel conversation'
			})
		}
	})
