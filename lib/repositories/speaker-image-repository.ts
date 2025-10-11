import { Database } from '@/types/supabase'
import { SupabaseClient } from '@supabase/supabase-js'
import { SpeakerImage, CreateSpeakerImageData } from '@/types/speaker-images'

export class SpeakerImageRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Create a new speaker image record
   */
  async createImage(data: CreateSpeakerImageData): Promise<SpeakerImage> {
    const supabase = this.supabase

    const { data: image, error } = await supabase
      .from('speaker_images')
      .insert({
        speaker_id: data.speaker_id,
        storage_path: data.storage_path,
        public_url: data.public_url,
        filename: data.filename,
        mime_type: data.mime_type,
        size_bytes: data.size_bytes,
        is_primary: data.is_primary || false,
        user_id: data.user_id,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create speaker image: ${error.message}`)
    }

    return image
  }

  /**
   * Get all images for a specific speaker
   */
  async getImagesBySpeaker(speakerId: number, userId: string): Promise<SpeakerImage[]> {
    const supabase = this.supabase

    const { data: images, error } = await supabase
      .from('speaker_images')
      .select('*')
      .eq('speaker_id', speakerId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch speaker images: ${error.message}`)
    }

    return images || []
  }

  /**
   * Get the primary/default image for a speaker
   */
  async getPrimaryImage(speakerId: number, userId: string): Promise<SpeakerImage | null> {
    const supabase = this.supabase

    const { data: image, error } = await supabase
      .from('speaker_images')
      .select('*')
      .eq('speaker_id', speakerId)
      .eq('user_id', userId)
      .eq('is_primary', true)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      throw new Error(`Failed to fetch primary image: ${error.message}`)
    }

    return image || null
  }

  /**
   * Set an image as primary and unset all others for the same speaker
   */
  async setPrimaryImage(imageId: number, speakerId: number, userId: string): Promise<SpeakerImage> {
    const supabase = this.supabase

    // First, verify the image exists and belongs to the user
    const { data: image, error: fetchError } = await supabase
      .from('speaker_images')
      .select('*')
      .eq('id', imageId)
      .eq('speaker_id', speakerId)
      .eq('user_id', userId)
      .single()

    if (fetchError) {
      throw new Error(`Image not found or access denied: ${fetchError.message}`)
    }

    // Unset all primary flags for this speaker
    const { error: unsetError } = await supabase
      .from('speaker_images')
      .update({ is_primary: false })
      .eq('speaker_id', speakerId)
      .eq('user_id', userId)

    if (unsetError) {
      throw new Error(`Failed to unset primary images: ${unsetError.message}`)
    }

    // Set the new primary image
    const { data: updatedImage, error: updateError } = await supabase
      .from('speaker_images')
      .update({ is_primary: true })
      .eq('id', imageId)
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to set primary image: ${updateError.message}`)
    }

    // Update the speaker's primary_image_id
    await supabase
      .from('speakers')
      .update({ primary_image_id: imageId })
      .eq('id', speakerId)
      .eq('user_id', userId)

    return updatedImage
  }

  /**
   * Delete a speaker image record
   */
  async deleteImage(imageId: number, userId: string): Promise<void> {
    const supabase = this.supabase

    const { error } = await supabase
      .from('speaker_images')
      .delete()
      .eq('id', imageId)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to delete speaker image: ${error.message}`)
    }
  }

  /**
   * Get a single image by ID
   */
  async getImageById(imageId: number, userId: string): Promise<SpeakerImage | null> {
    const supabase = this.supabase

    const { data: image, error } = await supabase
      .from('speaker_images')
      .select('*')
      .eq('id', imageId)
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch speaker image: ${error.message}`)
    }

    return image || null
  }

  /**
   * Get the count of images for a speaker
   */
  async getImageCount(speakerId: number, userId: string): Promise<number> {
    const supabase = this.supabase

    const { count, error } = await supabase
      .from('speaker_images')
      .select('*', { count: 'exact', head: true })
      .eq('speaker_id', speakerId)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to count speaker images: ${error.message}`)
    }

    return count || 0
  }

  /**
   * Verify speaker ownership
   * Note: Speakers don't have a direct user_id, they reference it through events
   */
  async verifySpeakerOwnership(speakerId: number, userId: string): Promise<boolean> {
    const supabase = this.supabase

    const { data, error } = await supabase
      .from('speakers')
      .select('event_id, events!inner(user_id)')
      .eq('id', speakerId)
      .single()

    if (error || !data) {
      return false
    }

    // Check if the event belongs to the user
    return (data.events as any).user_id === userId
  }
}
