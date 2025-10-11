import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/types/supabase'
import { SpeakerImageRepository } from '@/lib/repositories/speaker-image-repository'
import { SpeakerImage } from '@/types/speaker-images'

// Allowed image MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

export class SpeakerImageService {
  /**
   * Upload an image for a speaker
   * Handles storage upload and database record creation
   * If this is the first image for the speaker, automatically sets it as primary
   */
  static async uploadImage(
    speakerId: number,
    userId: string,
    file: File
  ): Promise<SpeakerImage> {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    const repository = new SpeakerImageRepository(supabase)

    // Validate speaker ownership
    const isOwner = await repository.verifySpeakerOwnership(speakerId, userId)
    if (!isOwner) {
      throw new Error('Speaker not found or access denied')
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error(
        `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(
        `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filename = `${timestamp}_${sanitizedFilename}`

    // Construct storage path: {user_id}/{speaker_id}/{filename}
    const storagePath = `${userId}/${speakerId}/${filename}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('speaker-images')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      throw new Error(`Failed to upload image: ${uploadError.message}`)
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('speaker-images')
      .getPublicUrl(storagePath)

    const publicUrl = urlData.publicUrl

    // Check if this is the first image for the speaker
    const imageCount = await repository.getImageCount(speakerId, userId)
    const isFirstImage = imageCount === 0

    // Create database record
    const imageRecord = await repository.createImage({
      speaker_id: speakerId,
      storage_path: storagePath,
      public_url: publicUrl,
      filename: sanitizedFilename,
      mime_type: file.type,
      size_bytes: file.size,
      is_primary: isFirstImage, // Auto-set as primary if first image
      user_id: userId,
    })

    // If this is the first image, update the speaker's primary_image_id
    if (isFirstImage) {
      await supabase
        .from('speakers')
        .update({ primary_image_id: imageRecord.id })
        .eq('id', speakerId)
        .eq('user_id', userId)
    }

    return imageRecord
  }

  /**
   * Delete an image
   * Removes from both storage and database
   * If deleting the primary image, automatically sets another image as primary
   */
  static async deleteImage(imageId: number, userId: string): Promise<void> {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    const repository = new SpeakerImageRepository(supabase)

    // Get the image to retrieve storage path
    const image = await repository.getImageById(imageId, userId)

    if (!image) {
      throw new Error('Image not found or access denied')
    }

    const wasPrimary = image.is_primary

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('speaker-images')
      .remove([image.storage_path])

    if (storageError) {
      throw new Error(`Failed to delete image from storage: ${storageError.message}`)
    }

    // Delete from database
    await repository.deleteImage(imageId, userId)

    // If the deleted image was primary, set another image as primary
    if (wasPrimary) {
      const remainingImages = await repository.getImagesBySpeaker(
        image.speaker_id,
        userId
      )

      if (remainingImages.length > 0) {
        // Set the most recent image as the new primary
        await repository.setPrimaryImage(
          remainingImages[0].id,
          image.speaker_id,
          userId
        )
      } else {
        // No images left, clear the speaker's primary_image_id
        await supabase
          .from('speakers')
          .update({ primary_image_id: null })
          .eq('id', image.speaker_id)
          .eq('user_id', userId)
      }
    }
  }

  /**
   * Set an image as the primary/default image for a speaker
   */
  static async setPrimaryImage(
    imageId: number,
    speakerId: number,
    userId: string
  ): Promise<SpeakerImage> {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    const repository = new SpeakerImageRepository(supabase)

    // Validate speaker ownership
    const isOwner = await repository.verifySpeakerOwnership(speakerId, userId)
    if (!isOwner) {
      throw new Error('Speaker not found or access denied')
    }

    return await repository.setPrimaryImage(imageId, speakerId, userId)
  }

  /**
   * Get all images for a speaker
   */
  static async getImagesForSpeaker(
    speakerId: number,
    userId: string
  ): Promise<SpeakerImage[]> {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    const repository = new SpeakerImageRepository(supabase)

    // Validate speaker ownership
    const isOwner = await repository.verifySpeakerOwnership(speakerId, userId)
    if (!isOwner) {
      throw new Error('Speaker not found or access denied')
    }

    return await repository.getImagesBySpeaker(speakerId, userId)
  }

  /**
   * Get the primary image for a speaker
   */
  static async getPrimaryImage(
    speakerId: number,
    userId: string
  ): Promise<SpeakerImage | null> {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    const repository = new SpeakerImageRepository(supabase)

    // Validate speaker ownership
    const isOwner = await repository.verifySpeakerOwnership(speakerId, userId)
    if (!isOwner) {
      throw new Error('Speaker not found or access denied')
    }

    return await repository.getPrimaryImage(speakerId, userId)
  }

  /**
   * Validate that a speaker has a primary image (for posting requirements)
   */
  static async validateSpeakerHasPrimaryImage(
    speakerId: number,
    userId: string
  ): Promise<boolean> {
    const primaryImage = await this.getPrimaryImage(speakerId, userId)
    return primaryImage !== null
  }
}
