import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/types/supabase'
import { SpeakerImageService } from '@/lib/services/speaker-image-service'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/speakers/[id]/images/[imageId]
 * Delete a specific image
 */
export async function DELETE(
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

    // Delete image
    await SpeakerImageService.deleteImage(imageIdNum, user.id)

    return NextResponse.json(
      { success: true },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting speaker image:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete image' },
      { status: 500 }
    )
  }
}
