# Speaker Image Management Integration Guide

This document explains how to integrate the speaker image management system with Instagram and LinkedIn posting flows.

## Overview

The speaker image management system allows you to:
- Upload multiple images per speaker
- Set a primary/default image for each speaker
- Automatically use the primary image when posting to social media
- Manage images through a clean API

## Database Schema

### speaker_images Table
```sql
- id (bigserial PRIMARY KEY)
- speaker_id (bigint REFERENCES speakers)
- storage_path (text)
- public_url (text)
- filename (text)
- mime_type (text)
- size_bytes (integer)
- is_primary (boolean)
- user_id (uuid REFERENCES auth.users)
- created_at (timestamptz)
- updated_at (timestamptz)
```

### speakers Table (Updated)
```sql
- primary_image_id (bigint REFERENCES speaker_images)
```

## API Endpoints

### Upload Image
```typescript
POST /api/speakers/[id]/images
Content-Type: multipart/form-data

// Request
FormData {
  file: File
}

// Response
{
  success: true,
  image: {
    id: number,
    speaker_id: number,
    public_url: string,
    is_primary: boolean,
    // ... other fields
  }
}
```

### List Speaker Images
```typescript
GET /api/speakers/[id]/images

// Response
{
  images: Array<{
    id: number,
    speaker_id: number,
    public_url: string,
    is_primary: boolean,
    // ... other fields
  }>
}
```

### Delete Image
```typescript
DELETE /api/speakers/[id]/images/[imageId]

// Response
{
  success: true
}
```

### Set Primary Image
```typescript
PUT /api/speakers/[id]/images/[imageId]/primary

// Response
{
  success: true,
  image: {
    id: number,
    is_primary: true,
    // ... other fields
  }
}
```

## Integration with Instagram

### Before (Manual Image URL)
```typescript
import { InstagramService } from '@/lib/services/instagram-service'

const instagramService = new InstagramService()
const result = await instagramService.postToInstagram(
  imageUrl,  // User had to provide this
  caption
)
```

### After (Automatic Primary Image)
```typescript
import { InstagramService } from '@/lib/services/instagram-service'
import { SpeakerImageService } from '@/lib/services/speaker-image-service'
import { createClient } from '@/utils/supabase/server'

// Get authenticated user
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()

// Validate speaker has a primary image
const hasImage = await SpeakerImageService.validateSpeakerHasPrimaryImage(
  speakerId,
  user.id
)

if (!hasImage) {
  throw new Error('Speaker must have a primary image to post to Instagram')
}

// Get the primary image
const primaryImage = await SpeakerImageService.getPrimaryImage(
  speakerId,
  user.id
)

// Post to Instagram with the primary image
const instagramService = new InstagramService()
const result = await instagramService.postToInstagram(
  primaryImage!.public_url,  // Automatically use primary image
  caption
)
```

## Integration with LinkedIn

LinkedIn requires the image as a buffer. Here's how to fetch and convert the primary image:

### Before (Manual Image)
```typescript
import { LinkedInService } from '@/lib/services/linkedin-service'

const linkedInService = new LinkedInService()

// User had to provide image buffer manually
const imageBuffer = await fetch(imageUrl).then(res => res.arrayBuffer())
const result = await linkedInService.postToLinkedIn(
  caption,
  Buffer.from(imageBuffer),
  'image.jpg'
)
```

### After (Automatic Primary Image)
```typescript
import { LinkedInService } from '@/lib/services/linkedin-service'
import { SpeakerImageService } from '@/lib/services/speaker-image-service'
import { createClient } from '@/utils/supabase/server'

// Get authenticated user
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()

// Get the primary image
const primaryImage = await SpeakerImageService.getPrimaryImage(
  speakerId,
  user.id
)

if (!primaryImage) {
  throw new Error('Speaker must have a primary image to post to LinkedIn')
}

// Fetch image from public URL and convert to buffer
const imageResponse = await fetch(primaryImage.public_url)
if (!imageResponse.ok) {
  throw new Error('Failed to fetch speaker image')
}

const imageBuffer = await imageResponse.arrayBuffer()

// Post to LinkedIn
const linkedInService = new LinkedInService()
const result = await linkedInService.postToLinkedIn(
  caption,
  Buffer.from(imageBuffer),
  primaryImage.filename
)
```

## Example: Complete Posting Flow

Here's a complete example of posting to both platforms:

```typescript
// app/api/speakers/[id]/post/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { SpeakerImageService } from '@/lib/services/speaker-image-service'
import { InstagramService } from '@/lib/services/instagram-service'
import { LinkedInService } from '@/lib/services/linkedin-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const speakerId = parseInt(id, 10)
    const { caption, platforms } = await request.json()

    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get primary image
    const primaryImage = await SpeakerImageService.getPrimaryImage(
      speakerId,
      user.id
    )

    if (!primaryImage) {
      return NextResponse.json(
        { error: 'Speaker must have a primary image to post' },
        { status: 400 }
      )
    }

    const results: any = {}

    // Post to Instagram
    if (platforms.includes('instagram')) {
      const instagramService = new InstagramService()
      const instagramResult = await instagramService.postToInstagram(
        primaryImage.public_url,
        caption
      )
      results.instagram = instagramResult
    }

    // Post to LinkedIn
    if (platforms.includes('linkedin')) {
      // Fetch image as buffer
      const imageResponse = await fetch(primaryImage.public_url)
      const imageBuffer = await imageResponse.arrayBuffer()

      const linkedInService = new LinkedInService()
      const linkedInResult = await linkedInService.postToLinkedIn(
        caption,
        Buffer.from(imageBuffer),
        primaryImage.filename
      )
      results.linkedin = linkedInResult
    }

    return NextResponse.json({ success: true, results }, { status: 200 })
  } catch (error) {
    console.error('Error posting to social media:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to post' },
      { status: 500 }
    )
  }
}
```

## Frontend Integration

### Upload Image Component Example
```typescript
'use client'

import { useState } from 'react'

export function SpeakerImageUpload({ speakerId }: { speakerId: number }) {
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/speakers/${speakerId}/images`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()
      console.log('Uploaded:', data.image)

      // Refresh images list or update UI
    } catch (error) {
      console.error('Upload error:', error)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <input
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        onChange={handleUpload}
        disabled={uploading}
      />
      {uploading && <p>Uploading...</p>}
    </div>
  )
}
```

## Best Practices

1. **Always validate primary image exists** before posting to social media
2. **Use the validation helper**: `SpeakerImageService.validateSpeakerHasPrimaryImage()`
3. **Handle missing images gracefully** with clear error messages
4. **Set first uploaded image as primary** automatically (already implemented)
5. **Clean up orphaned storage files** when deleting speakers (CASCADE handles DB)
6. **Use proper error handling** for network failures when fetching images
7. **Cache image buffers** if posting to multiple platforms to avoid redundant fetches

## Security Considerations

- RLS policies ensure users can only access their own speaker images
- Storage policies restrict uploads to user-specific folders
- All API endpoints validate user authentication and ownership
- File type and size validation prevent malicious uploads
- Public URLs are safe to share (bucket is public)

## Performance Tips

- Images are stored in Supabase Storage CDN for fast access
- Use the `public_url` directly - it's cached and optimized
- Consider resizing large images before upload
- Implement lazy loading for image galleries
- Cache primary image lookups if querying frequently
