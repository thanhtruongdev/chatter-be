export type ConversationType = 'direct' | 'group' | 'channel'

export interface CreateConversationBody {
	readonly type: ConversationType
	readonly title?: string
	readonly memberIds: string[]
}
