/**
 * Type definitions for Speaker Image Management System
 */

/**
 * Speaker Image record from database
 */
export interface SpeakerImage {
  id: number
  speaker_id: number
  storage_path: string
  public_url: string
  filename: string
  mime_type: string
  size_bytes: number
  is_primary: boolean | null
  user_id: string
  created_at: string | null
  updated_at: string | null
}

/**
 * Data required to create a new speaker image
 */
export interface CreateSpeakerImageData {
  speaker_id: number
  storage_path: string
  public_url: string
  filename: string
  mime_type: string
  size_bytes: number
  is_primary?: boolean
  user_id: string
}

/**
 * API Response for image upload
 */
export interface UploadImageResponse {
  success: boolean
  image: SpeakerImage
}

/**
 * API Response for listing images
 */
export interface ListImagesResponse {
  images: SpeakerImage[]
}

/**
 * API Response for delete operation
 */
export interface DeleteImageResponse {
  success: boolean
}

/**
 * API Response for setting primary image
 */
export interface SetPrimaryImageResponse {
  success: boolean
  image: SpeakerImage
}

/**
 * Request body for posting to social media
 */
export interface SpeakerPostRequest {
  caption: string
  platforms: ('instagram' | 'linkedin')[]
  use_custom_image?: boolean
  custom_image_url?: string
}

/**
 * Result for individual platform post
 */
export interface PlatformPostResult {
  success: boolean
  error?: string
  statusCode?: number
}

/**
 * Instagram post result
 */
export interface InstagramPostResult extends PlatformPostResult {
  creationId?: string
  mediaId?: string
}

/**
 * LinkedIn post result
 */
export interface LinkedInPostResult extends PlatformPostResult {
  postUrn?: string
}

/**
 * API Response for social media posting
 */
export interface SpeakerPostResponse {
  success: boolean
  message: string
  results?: {
    instagram?: InstagramPostResult
    linkedin?: LinkedInPostResult
  }
  errors?: {
    instagram?: PlatformPostResult
    linkedin?: PlatformPostResult
  }
}

/**
 * Allowed image MIME types
 */
export type AllowedImageMimeType =
  | 'image/jpeg'
  | 'image/jpg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp'

/**
 * Social media platforms
 */
export type SocialMediaPlatform = 'instagram' | 'linkedin'

/**
 * Image validation constraints
 */
export const IMAGE_CONSTRAINTS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ] as const,
  STORAGE_BUCKET: 'speaker-images',
} as const

/**
 * Helper type guard to check if MIME type is allowed
 */
export function isAllowedMimeType(mimeType: string): mimeType is AllowedImageMimeType {
  return IMAGE_CONSTRAINTS.ALLOWED_MIME_TYPES.includes(mimeType as any)
}

/**
 * Helper type guard to check if platform is valid
 */
export function isValidPlatform(platform: string): platform is SocialMediaPlatform {
  return platform === 'instagram' || platform === 'linkedin'
}

/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Validate file before upload
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!isAllowedMimeType(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${IMAGE_CONSTRAINTS.ALLOWED_MIME_TYPES.join(', ')}`
    }
  }

  if (file.size > IMAGE_CONSTRAINTS.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${formatFileSize(IMAGE_CONSTRAINTS.MAX_FILE_SIZE)}`
    }
  }

  return { valid: true }
}

/**
 * Generate storage path for speaker image
 */
export function generateStoragePath(
  userId: string,
  speakerId: number,
  filename: string
): string {
  const timestamp = Date.now()
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  return `${userId}/${speakerId}/${timestamp}_${sanitizedFilename}`
}
