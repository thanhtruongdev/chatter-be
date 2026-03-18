import { ConversationDto } from '~/models/conversation.js'
import type { CreateConversationBody } from '../../types/conversation.js'
import { ConversationRepository } from './conversation.repository.js'
import type { ConversationWithMembersRecord } from './conversation.repository.js'

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

		return this.toConversationDto(createdConversation)
	}

	async getConversationList(currentUserId: string): Promise<ConversationDto[]> {
		const userId = this.parseUserId(currentUserId)
		const conversations = await this.conversationRepository.getConversationList(userId)

		return conversations.map((conversation) => this.toConversationDto(conversation))
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

	private toConversationDto(conversation: ConversationWithMembersRecord): ConversationDto {
		return {
			id: conversation.id.toString(),
			type: conversation.type,
			title: conversation.title,
			avatarUrl: conversation.avatar_url,
			createdBy: conversation.created_by?.toString() ?? null,
			createdAt: conversation.created_at.toISOString(),
			updatedAt: conversation.updated_at.toISOString(),
			members: conversation.conversation_members.map((member) => ({
				userId: member.user_id.toString(),
				role: member.role,
				joinedAt: member.joined_at.toISOString()
			}))
		}
	}
}
