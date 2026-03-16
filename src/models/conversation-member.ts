export interface ConversationMemberDto {
	readonly userId: string
	readonly role: 'owner' | 'admin' | 'member'
	readonly joinedAt: string
}
