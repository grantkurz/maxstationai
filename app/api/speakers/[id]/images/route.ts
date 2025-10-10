import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/types/supabase'
import { SpeakerImageService } from '@/lib/services/speaker-image-service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/speakers/[id]/images
 * List all images for a speaker
 */
export async function GET(
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

    // Get images
    const images = await SpeakerImageService.getImagesForSpeaker(
      speakerId,
      user.id
    )

    return NextResponse.json({ images }, { status: 200 })
  } catch (error) {
    console.error('Error fetching speaker images:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch images' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/speakers/[id]/images
 * Upload a new image for a speaker
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

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Upload image
    const image = await SpeakerImageService.uploadImage(
      speakerId,
      user.id,
      file
    )

    return NextResponse.json(
      { success: true, image },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error uploading speaker image:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload image' },
      { status: 500 }
    )
  }
}
