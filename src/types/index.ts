export interface FavoriteRoute {
  id: string
  fromId: string
  fromName: string
  toId: string
  toName: string
  label?: string
  createdAt: string
}

export interface User {
  id: string
  email?: string
  name?: string
  avatarUrl?: string
}
