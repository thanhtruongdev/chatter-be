export interface UserRecord {
  readonly id: bigint
  readonly username: string
  readonly email: string
  readonly password_hash: string
  readonly display_name: string | null
  readonly avatar_url: string | null
  readonly created_at: Date
}

export interface UserDto {
  readonly id: string
  readonly username: string
  readonly email: string
  readonly displayName: string | null
  readonly avatarUrl: string | null
  readonly createdAt: string
}
