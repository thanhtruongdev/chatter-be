import { ConversationType } from '~/types/conversation.js'
import { ConversationMemberDto } from './conversation-member.js'

export interface ConversationDto {
	readonly id: string
	readonly type: ConversationType
	readonly title: string | null
	readonly avatarUrl: string | null
	readonly createdBy: string | null
	readonly createdAt: string
	readonly updatedAt: string
	readonly members: ConversationMemberDto[]
}
