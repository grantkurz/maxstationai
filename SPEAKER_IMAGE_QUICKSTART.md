# Speaker Image System - Quick Start Guide

Get up and running with the speaker image management system in 5 minutes.

## Prerequisites

- Supabase project configured
- Next.js 15 app running
- User authentication working
- Instagram and/or LinkedIn credentials configured

## Step 1: Run the Migration

```bash
cd /Users/grant/code/auth-test/otp-flow

# Push to Supabase
supabase db push

# Or run manually
psql -h <your-host> -d <your-db> -f supabase/migrations/20251009000001_create_speaker_images.sql
```

## Step 2: Verify Setup

```typescript
// Check that the table exists
import { createClient } from '@/utils/supabase/server'

const supabase = await createClient()
const { data, error } = await supabase
  .from('speaker_images')
  .select('*')
  .limit(1)

console.log('Table exists:', !error)
```

## Step 3: Upload Your First Image

### Option A: Using curl

```bash
# Get your auth token first
TOKEN="your-supabase-auth-token"
SPEAKER_ID=1

curl -X POST "http://localhost:3000/api/speakers/${SPEAKER_ID}/images" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@/path/to/speaker-image.jpg"
```

### Option B: Using fetch in browser/component

```typescript
const uploadImage = async (speakerId: number, file: File) => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`/api/speakers/${speakerId}/images`, {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error)
  }

  return response.json()
}

// Usage
const result = await uploadImage(1, fileFromInput)
console.log('Uploaded:', result.image.public_url)
```

## Step 4: Post to Social Media

```typescript
// Post to both Instagram and LinkedIn with speaker's primary image
const postToSocialMedia = async (speakerId: number, caption: string) => {
  const response = await fetch(`/api/speakers/${speakerId}/post`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      caption,
      platforms: ['instagram', 'linkedin']
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error)
  }

  return response.json()
}

// Usage
const result = await postToSocialMedia(1, 'Meet our amazing speaker!')
console.log('Posted to Instagram:', result.results.instagram.mediaId)
console.log('Posted to LinkedIn:', result.results.linkedin.postUrn)
```

## Step 5: Add to Your Frontend

Copy this component to get started:

```typescript
'use client'

import { useState } from 'react'

export function SpeakerImageUploadSimple({ speakerId }: { speakerId: number }) {
  const [uploading, setUploading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/speakers/${speakerId}/images`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      setImageUrl(data.image.public_url)
      alert('Image uploaded successfully!')
    } catch (error) {
      alert('Upload failed: ' + error)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept="image/*"
        onChange={handleUpload}
        disabled={uploading}
        className="block w-full"
      />
      {uploading && <p>Uploading...</p>}
      {imageUrl && (
        <img src={imageUrl} alt="Uploaded" className="w-64 h-64 object-cover" />
      )}
    </div>
  )
}
```

## Common Use Cases

### 1. Check if Speaker Has Image

```typescript
import { SpeakerImageService } from '@/lib/services/speaker-image-service'

const hasImage = await SpeakerImageService.validateSpeakerHasPrimaryImage(
  speakerId,
  userId
)

if (!hasImage) {
  // Show upload UI
  console.log('Please upload an image first')
}
```

### 2. Get Primary Image URL

```typescript
import { SpeakerImageService } from '@/lib/services/speaker-image-service'

const primaryImage = await SpeakerImageService.getPrimaryImage(
  speakerId,
  userId
)

if (primaryImage) {
  console.log('Image URL:', primaryImage.public_url)
}
```

### 3. Set Different Image as Primary

```typescript
// Frontend
const setPrimary = async (speakerId: number, imageId: number) => {
  const response = await fetch(
    `/api/speakers/${speakerId}/images/${imageId}/primary`,
    { method: 'PUT' }
  )

  if (response.ok) {
    alert('Primary image updated!')
  }
}
```

### 4. Delete Image

```typescript
// Frontend
const deleteImage = async (speakerId: number, imageId: number) => {
  if (!confirm('Delete this image?')) return

  const response = await fetch(
    `/api/speakers/${speakerId}/images/${imageId}`,
    { method: 'DELETE' }
  )

  if (response.ok) {
    alert('Image deleted!')
  }
}
```

### 5. List All Speaker Images

```typescript
// Frontend
const fetchImages = async (speakerId: number) => {
  const response = await fetch(`/api/speakers/${speakerId}/images`)
  const data = await response.json()
  return data.images
}

const images = await fetchImages(1)
console.log(`Speaker has ${images.length} images`)
```

## Testing

### Test Upload

```bash
# Create a test image
curl https://picsum.photos/800/800 > test-image.jpg

# Upload it
curl -X POST http://localhost:3000/api/speakers/1/images \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-image.jpg"
```

### Test Retrieval

```bash
curl http://localhost:3000/api/speakers/1/images \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Posting

```bash
curl -X POST http://localhost:3000/api/speakers/1/post \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "caption": "Test post!",
    "platforms": ["instagram"]
  }'
```

## Troubleshooting

### "Unauthorized" Error
Make sure you're logged in and have a valid session:
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
console.log('User:', user)
```

### "Speaker not found" Error
Verify the speaker exists and belongs to your user:
```typescript
const { data } = await supabase
  .from('speakers')
  .select('id, event_id, events!inner(user_id)')
  .eq('id', speakerId)
  .single()

console.log('Speaker:', data)
```

### "Image URL must be HTTPS" Error
The speaker's primary image URL must be HTTPS. Check:
```typescript
const image = await SpeakerImageService.getPrimaryImage(speakerId, userId)
console.log('Image URL:', image?.public_url)
console.log('Is HTTPS:', image?.public_url.startsWith('https://'))
```

### Storage Bucket Not Found
Verify the bucket exists:
```sql
SELECT * FROM storage.buckets WHERE id = 'speaker-images';
```

If not, create it:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('speaker-images', 'speaker-images', true);
```

## Next Steps

1. **Read the full documentation**: `/SPEAKER_IMAGE_SYSTEM.md`
2. **Review integration guide**: `/lib/services/SPEAKER_IMAGE_INTEGRATION.md`
3. **Add the image manager component**: See full example in `/SPEAKER_IMAGE_SYSTEM.md`
4. **Integrate with your posting flow**: Update your social media posting code
5. **Add image optimization**: Consider resizing images before upload

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/speakers/[id]/images` | GET | List all images |
| `/api/speakers/[id]/images` | POST | Upload new image |
| `/api/speakers/[id]/images/[imageId]` | DELETE | Delete image |
| `/api/speakers/[id]/images/[imageId]/primary` | PUT | Set as primary |
| `/api/speakers/[id]/post` | POST | Post to social media |

## Type Safety

Import types for better TypeScript support:

```typescript
import {
  SpeakerImage,
  UploadImageResponse,
  SpeakerPostRequest,
  SpeakerPostResponse,
  validateImageFile,
} from '@/types/speaker-images'

// Validate before upload
const file = fileInput.files[0]
const validation = validateImageFile(file)

if (!validation.valid) {
  alert(validation.error)
  return
}

// Upload with type safety
const response = await fetch(`/api/speakers/${speakerId}/images`, {
  method: 'POST',
  body: formData
})

const data: UploadImageResponse = await response.json()
console.log('Uploaded:', data.image.filename)
```

## Environment Variables

Make sure these are set for social media posting:

```bash
# Instagram
INSTAGRAM_USER_ID=your_instagram_user_id
INSTAGRAM_ACCESS_TOKEN=your_access_token

# LinkedIn
LINKEDIN_OWNER_URN=urn:li:person:your_person_id
LINKEDIN_ACCESS_TOKEN=your_access_token
# Or use refresh token
LINKEDIN_REFRESH_TOKEN=your_refresh_token
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
```

## Complete Example: Full Workflow

```typescript
// 1. Upload image
const formData = new FormData()
formData.append('file', imageFile)

const uploadResponse = await fetch(`/api/speakers/${speakerId}/images`, {
  method: 'POST',
  body: formData
})

const { image } = await uploadResponse.json()
console.log('✅ Image uploaded:', image.public_url)

// 2. Verify it's set as primary (auto-set if first image)
const imagesResponse = await fetch(`/api/speakers/${speakerId}/images`)
const { images } = await imagesResponse.json()
const primaryImage = images.find(img => img.is_primary)
console.log('✅ Primary image:', primaryImage?.public_url)

// 3. Post to social media
const postResponse = await fetch(`/api/speakers/${speakerId}/post`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    caption: 'Excited to announce our speaker!',
    platforms: ['instagram', 'linkedin']
  })
})

const postResult = await postResponse.json()
console.log('✅ Posted to Instagram:', postResult.results.instagram.mediaId)
console.log('✅ Posted to LinkedIn:', postResult.results.linkedin.postUrn)
```

---

That's it! You're ready to use the speaker image management system. For more details, see the complete documentation in `/SPEAKER_IMAGE_SYSTEM.md`.
