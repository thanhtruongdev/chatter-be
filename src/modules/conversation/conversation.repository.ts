import prisma from '../../prisma.js'
import type { member_role } from '../../generated/prisma/enums.js'

type ConversationType = 'direct' | 'group' | 'channel'

interface ConversationMemberCreateInput {
	readonly userId: bigint
	readonly role: member_role
}

export interface ConversationWithMembersRecord {
	readonly id: bigint
	readonly type: ConversationType
	readonly title: string | null
	readonly avatar_url: string | null
	readonly created_by: bigint | null
	readonly created_at: Date
	readonly updated_at: Date
	readonly conversation_members: {
		readonly user_id: bigint
		readonly role: member_role
		readonly joined_at: Date
	}[]
}
export class ConversationRepository {
	async findExistingUsersByIds(userIds: bigint[]): Promise<bigint[]> {
		const users = await prisma.users.findMany({
			where: {
				id: {
					in: userIds
				},
				deleted_at: null
			},
			select: {
				id: true
			}
		})

		return users.map((user) => user.id)
	}

	async createConversationWithMembers(
		creatorId: bigint,
		type: ConversationType,
		title: string | null,
		members: ConversationMemberCreateInput[]
	): Promise<ConversationWithMembersRecord> {
		return prisma.$transaction(async (tx) => {
			const conversation = await tx.conversations.create({
				data: {
					type,
					title,
					created_by: creatorId
				},
				select: {
					id: true
				}
			})

			await tx.conversation_members.createMany({
				data: members.map((member) => ({
					conversation_id: conversation.id,
					user_id: member.userId,
					role: member.role
				}))
			})

			const createdConversation = await tx.conversations.findUnique({
				where: { id: conversation.id },
				select: {
					id: true,
					type: true,
					title: true,
					avatar_url: true,
					created_by: true,
					created_at: true,
					updated_at: true,
					conversation_members: {
						where: {
							deleted_at: null,
							left_at: null
						},
						select: {
							user_id: true,
							role: true,
							joined_at: true
						},
						orderBy: {
							joined_at: 'asc'
						}
					}
				}
			})

			if (!createdConversation) {
				throw new Error('Failed to create conversation')
			}

			return createdConversation
		})
	}

	async getConversationList(currentUserId: bigint): Promise<ConversationWithMembersRecord[]> {
		return prisma.conversations.findMany({
			where: {
				deleted_at: null,
				conversation_members: {
					some: {
						user_id: currentUserId,
						deleted_at: null,
						left_at: null
					}
				}
			},
			select: {
				id: true,
				type: true,
				title: true,
				avatar_url: true,
				created_by: true,
				created_at: true,
				updated_at: true,
				conversation_members: {
					where: {
						deleted_at: null,
						left_at: null
					},
					select: {
						user_id: true,
						role: true,
						joined_at: true
					},
					orderBy: {
						joined_at: 'asc'
					}
				}
			},
			orderBy: [{ last_message_at: 'desc' }, { updated_at: 'desc' }, { id: 'desc' }]
		})
	}
}
