export type UserRole = 'user' | 'creator' | 'admin'
export type ResourceType = 'image' | 'video' | 'font' | 'psd' | 'ai' | 'audio' | 'other'
export type ResourceStatus = 'pending' | 'approved' | 'rejected'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  cover_image: string | null
  role: UserRole
  is_creator: boolean
  is_admin: boolean
  is_premium: boolean
  subscription_tier: string
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  parent_id: string | null
  order_index: number
  created_at: string
}

export interface Tag {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface Resource {
  id: string
  title: string
  description: string | null
  resource_type: ResourceType
  category_id: string | null
  creator_id: string
  status: ResourceStatus
  file_url: string
  thumbnail_url: string | null
  preview_url: string | null
  file_size: number
  file_format: string
  width: number | null
  height: number | null
  duration: number | null
  frame_rate: number | null
  has_alpha_channel: boolean
  has_loop: boolean
  video_encoding: string | null
  video_codec: string | null
  video_color_space: string | null
  video_has_timecode: boolean
  video_audio_codec: string | null
  orientation: string | null
  keywords: string[] | null
  color_palette: string[] | null
  is_premium: boolean
  is_official: boolean
  is_ai_generated: boolean
  price: number | null
  download_count: number
  view_count: number
  like_count: number
  rejected_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  // Relations
  creator?: Profile
  category?: Category
  tags?: Tag[]
}

export interface Download {
  id: string
  user_id: string
  resource_id: string
  downloaded_at: string
  resource?: Resource
}

export interface Favorite {
  id: string
  user_id: string
  resource_id: string
  created_at: string
  resource?: Resource
}

export interface CreatorEarning {
  id: string
  creator_id: string
  resource_id: string
  download_id: string | null
  amount: number
  commission_rate: number
  status: string
  created_at: string
  paid_at: string | null
}

export interface Collection {
  id: string
  creator_id: string
  title: string
  description: string | null
  cover_image: string | null
  slug: string
  is_featured: boolean
  is_premium: boolean
  status: ResourceStatus
  view_count: number
  rejected_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  // Relations
  creator?: Profile
  resources?: Resource[]
  resources_count?: number
}

export interface CollectionResource {
  id: string
  collection_id: string
  resource_id: string
  order_index: number
  created_at: string
  // Relations
  resource?: Resource
  collection?: Collection
}

