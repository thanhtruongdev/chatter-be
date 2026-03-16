import type { ConversationDto, CreateConversationBody } from '../../types/conversation.js'
import { ConversationRepository } from './conversation.repository.js'

export class ConversationService {
	private readonly conversationRepository: ConversationRepository

	constructor(conversationRepository: ConversationRepository = new ConversationRepository()) {
		this.conversationRepository = conversationRepository
	}

	async createConversation(currentUserId: string, input: CreateConversationBody): Promise<ConversationDto> {
		const creatorId = this.parseUserId(currentUserId)
		const normalizedMemberIds = this.normalizeMemberIds(input.memberIds)

		if (normalizedMemberIds.some((memberId) => memberId === creatorId)) {
			throw new Error('memberIds must not include current user id')
		}

		const allMemberIds = [creatorId, ...normalizedMemberIds]
		const existingUserIds = await this.conversationRepository.findExistingUsersByIds(allMemberIds)

		if (existingUserIds.length !== allMemberIds.length) {
			throw new Error('One or more members do not exist')
		}

		const createdConversation = await this.conversationRepository.createConversationWithMembers(
			creatorId,
			input.type,
			input.title?.trim() || null,
			[
				{ userId: creatorId, role: 'owner' },
				...normalizedMemberIds.map((memberId) => ({
					userId: memberId,
					role: 'member' as const
				}))
			]
		)

		return {
			id: createdConversation.id.toString(),
			type: createdConversation.type,
			title: createdConversation.title,
			avatarUrl: createdConversation.avatar_url,
			createdBy: createdConversation.created_by?.toString() ?? null,
			createdAt: createdConversation.created_at.toISOString(),
			updatedAt: createdConversation.updated_at.toISOString(),
			members: createdConversation.conversation_members.map((member) => ({
				userId: member.user_id.toString(),
				role: member.role,
				joinedAt: member.joined_at.toISOString()
			}))
		}
	}

	private normalizeMemberIds(memberIds: string[]): bigint[] {
		const uniqueMemberIdStrings = Array.from(new Set(memberIds.map((memberId) => memberId.trim())))
		return uniqueMemberIdStrings.map((memberId) => BigInt(memberId))
	}

	private parseUserId(userId: string): bigint {
		if (!/^\d+$/.test(userId)) {
			throw new Error('Invalid user id in access token')
		}

		return BigInt(userId)
	}
}
