import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/types/supabase'
import { SpeakerImageService } from '@/lib/services/speaker-image-service'
import { InstagramService, InstagramAPIError } from '@/lib/services/instagram-service'
import { LinkedInService, LinkedInAPIError } from '@/lib/services/linkedin-service'

export const dynamic = 'force-dynamic'

/**
 * Request body schema for speaker social media post
 */
interface SpeakerPostRequest {
  caption: string
  platforms: ('instagram' | 'linkedin')[]
  use_custom_image?: boolean
  custom_image_url?: string
}

/**
 * POST /api/speakers/[id]/post
 * Posts a speaker's announcement to Instagram and/or LinkedIn
 *
 * This endpoint automatically uses the speaker's primary image if available,
 * or allows using a custom image URL.
 *
 * Request body (JSON):
 * - caption: string (required) - Post caption text
 * - platforms: string[] (required) - Array of platforms to post to ['instagram', 'linkedin']
 * - use_custom_image: boolean (optional) - Whether to use a custom image instead of primary
 * - custom_image_url: string (optional) - Custom image URL (required if use_custom_image is true)
 *
 * Response:
 * - success: boolean
 * - results: Object with platform-specific results
 *   - instagram?: { creationId, mediaId }
 *   - linkedin?: { postUrn }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const speakerId = parseInt(id, 10)

    if (isNaN(speakerId)) {
      return NextResponse.json(
        { error: 'Invalid speaker ID' },
        { status: 400 }
      )
    }

    // Authenticate user
    const supabase = createRouteHandlerClient<Database>({ cookies })
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = (await request.json()) as SpeakerPostRequest
    const { caption, platforms, use_custom_image, custom_image_url } = body

    // Validate required fields
    if (!caption || !caption.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: caption' },
        { status: 400 }
      )
    }

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: platforms (must be non-empty array)' },
        { status: 400 }
      )
    }

    // Validate platforms
    const validPlatforms = ['instagram', 'linkedin']
    for (const platform of platforms) {
      if (!validPlatforms.includes(platform)) {
        return NextResponse.json(
          { error: `Invalid platform: ${platform}. Must be one of: ${validPlatforms.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Determine which image to use
    let imageUrl: string
    let filename: string

    if (use_custom_image) {
      if (!custom_image_url || !custom_image_url.trim()) {
        return NextResponse.json(
          { error: 'custom_image_url is required when use_custom_image is true' },
          { status: 400 }
        )
      }

      if (!custom_image_url.toLowerCase().startsWith('https://')) {
        return NextResponse.json(
          { error: 'custom_image_url must be a publicly accessible HTTPS URL' },
          { status: 400 }
        )
      }

      imageUrl = custom_image_url
      filename = 'custom_image.jpg'
    } else {
      // Get primary image from speaker
      const primaryImage = await SpeakerImageService.getPrimaryImage(
        speakerId,
        user.id
      )

      if (!primaryImage) {
        return NextResponse.json(
          {
            error: 'Speaker must have a primary image. Please upload and set a primary image first.',
            hint: `POST /api/speakers/${speakerId}/images to upload an image`
          },
          { status: 400 }
        )
      }

      imageUrl = primaryImage.public_url
      filename = primaryImage.filename
    }

    // Post to selected platforms
    const results: any = {}
    const errors: any = {}

    // Post to Instagram
    if (platforms.includes('instagram')) {
      try {
        console.log(`Posting speaker ${speakerId} to Instagram...`)
        console.log(`Image URL: ${imageUrl}`)
        console.log(`Caption length: ${caption.length} characters`)

        const instagramService = new InstagramService()
        const instagramResult = await instagramService.postToInstagram(
          imageUrl,
          caption
        )

        results.instagram = {
          success: true,
          creationId: instagramResult.creationId,
          mediaId: instagramResult.mediaId,
        }

        console.log(`Successfully posted to Instagram. Media ID: ${instagramResult.mediaId}`)
      } catch (error) {
        console.error('Instagram posting error:', error)

        if (error instanceof InstagramAPIError) {
          errors.instagram = {
            success: false,
            error: error.message,
            statusCode: error.statusCode,
          }
        } else {
          errors.instagram = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      }
    }

    // Post to LinkedIn
    if (platforms.includes('linkedin')) {
      try {
        console.log(`Posting speaker ${speakerId} to LinkedIn...`)
        console.log(`Image URL: ${imageUrl}`)
        console.log(`Caption length: ${caption.length} characters`)

        // Fetch image from public URL and convert to buffer
        const imageResponse = await fetch(imageUrl)
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
        }

        const imageBuffer = await imageResponse.arrayBuffer()

        const linkedInService = new LinkedInService()
        const postUrn = await linkedInService.postToLinkedIn(
          caption,
          Buffer.from(imageBuffer),
          filename
        )

        results.linkedin = {
          success: true,
          postUrn,
        }

        console.log(`Successfully posted to LinkedIn. Post URN: ${postUrn}`)
      } catch (error) {
        console.error('LinkedIn posting error:', error)

        if (error instanceof LinkedInAPIError) {
          errors.linkedin = {
            success: false,
            error: error.message,
            statusCode: error.statusCode,
          }
        } else {
          errors.linkedin = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      }
    }

    // Determine overall success
    const hasSuccesses = Object.keys(results).length > 0
    const hasErrors = Object.keys(errors).length > 0

    if (hasSuccesses && !hasErrors) {
      return NextResponse.json(
        {
          success: true,
          message: 'Successfully posted to all platforms',
          results,
        },
        { status: 200 }
      )
    }

    if (hasSuccesses && hasErrors) {
      return NextResponse.json(
        {
          success: true,
          message: 'Partially successful - some platforms failed',
          results,
          errors,
        },
        { status: 207 } // Multi-Status
      )
    }

    // All failed
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to post to all platforms',
        errors,
      },
      { status: 500 }
    )
  } catch (error) {
    console.error('Error in speaker post API:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to post to social media',
      },
      { status: 500 }
    )
  }
}
