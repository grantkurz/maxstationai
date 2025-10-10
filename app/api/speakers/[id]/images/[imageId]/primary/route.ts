import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/types/supabase'
import { SpeakerImageService } from '@/lib/services/speaker-image-service'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/speakers/[id]/images/[imageId]/primary
 * Set an image as the primary/default image for a speaker
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const { id, imageId } = await params
    const speakerId = parseInt(id, 10)
    const imageIdNum = parseInt(imageId, 10)

    if (isNaN(speakerId) || isNaN(imageIdNum)) {
      return NextResponse.json(
        { error: 'Invalid speaker ID or image ID' },
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

    // Set primary image
    const image = await SpeakerImageService.setPrimaryImage(
      imageIdNum,
      speakerId,
      user.id
    )

    return NextResponse.json(
      { success: true, image },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error setting primary image:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to set primary image' },
      { status: 500 }
    )
  }
}
