import prisma from '../prisma.js'
import type { CreateMessageInput, MessageHistoryCursor, MessageRecord } from './socket.types.js'

export class SocketRepository {
    async isActiveConversationMember(conversationId: bigint, userId: bigint): Promise<boolean> {
        const member = await prisma.conversation_members.findFirst({
            where: {
                conversation_id: conversationId,
                user_id: userId,
                deleted_at: null,
                left_at: null
            },
            select: {
                id: true
            }
        })

        return Boolean(member)
    }

    async getConversationHistory(
        conversationId: bigint,
        limit: number,
        cursor?: MessageHistoryCursor
    ): Promise<MessageRecord[]> {
        const messages = await prisma.messages.findMany({
            where: {
                conversation_id: conversationId,
                deleted_at: null,
                ...(cursor
                    ? {
                          OR: [
                              {
                                  created_at: {
                                      lt: cursor.createdAt
                                  }
                              },
                              {
                                  created_at: cursor.createdAt,
                                  id: {
                                      lt: cursor.id
                                  }
                              }
                          ]
                      }
                    : {})
            },
            select: {
                id: true,
                conversation_id: true,
                sender_id: true,
                type: true,
                content: true,
                metadata: true,
                reply_to_message_id: true,
                created_at: true
            },
            orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
            take: limit
        })

        return messages
    }

    async createMessageAndTouchConversation(input: CreateMessageInput): Promise<MessageRecord> {
        return prisma.$transaction(async (tx) => {
            const createdMessage = await tx.messages.create({
                data: {
                    conversation_id: input.conversationId,
                    sender_id: input.senderId,
                    type: input.type,
                    content: input.content,
                    metadata: input.metadata,
                    reply_to_message_id: input.replyToMessageId
                },
                select: {
                    id: true,
                    conversation_id: true,
                    sender_id: true,
                    type: true,
                    content: true,
                    metadata: true,
                    reply_to_message_id: true,
                    created_at: true
                }
            })

            await tx.conversations.update({
                where: {
                    id: input.conversationId
                },
                data: {
                    last_message_id: createdMessage.id,
                    last_message_at: createdMessage.created_at
                }
            })

            return createdMessage
        })
    }
}
