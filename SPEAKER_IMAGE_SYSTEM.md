# Speaker Image Management System

A comprehensive image management system for speakers with automatic social media integration for Instagram and LinkedIn.

## Overview

This system allows you to:
- Upload and store multiple images per speaker in Supabase Storage
- Set a primary/default image for each speaker
- Automatically use speaker images when posting to Instagram and LinkedIn
- Manage images through secure REST API endpoints
- Handle image validation, storage, and cleanup

## Architecture

### 1. Database Layer

**Table: `speaker_images`**
```sql
CREATE TABLE speaker_images (
  id BIGSERIAL PRIMARY KEY,
  speaker_id BIGINT REFERENCES speakers(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Updated: `speakers` table**
```sql
ALTER TABLE speakers
  ADD COLUMN primary_image_id BIGINT REFERENCES speaker_images(id) ON DELETE SET NULL;
```

**Supabase Storage Bucket: `speaker-images`**
- Public bucket for CDN-delivered images
- Folder structure: `{user_id}/{speaker_id}/{filename}`
- Size limit: 10MB per image
- Allowed types: jpeg, jpg, png, gif, webp

### 2. Security Layer

**Row Level Security (RLS)**
- Users can only access images for speakers they own (through events table)
- All CRUD operations are protected by RLS policies
- Storage policies enforce user folder isolation

**Validation**
- File type validation (jpeg, jpg, png, gif, webp)
- File size validation (max 10MB)
- Image URL validation (must be HTTPS)
- User ownership validation at every layer

### 3. Repository Layer

**File: `/lib/repositories/speaker-image-repository.ts`**

```typescript
class SpeakerImageRepository {
  static async createImage(data): Promise<SpeakerImage>
  static async getImagesBySpeaker(speakerId, userId): Promise<SpeakerImage[]>
  static async getPrimaryImage(speakerId, userId): Promise<SpeakerImage | null>
  static async setPrimaryImage(imageId, speakerId, userId): Promise<SpeakerImage>
  static async deleteImage(imageId, userId): Promise<void>
  static async getImageById(imageId, userId): Promise<SpeakerImage | null>
  static async getImageCount(speakerId, userId): Promise<number>
  static async verifySpeakerOwnership(speakerId, userId): Promise<boolean>
}
```

### 4. Service Layer

**File: `/lib/services/speaker-image-service.ts`**

```typescript
class SpeakerImageService {
  static async uploadImage(speakerId, userId, file): Promise<SpeakerImage>
  static async deleteImage(imageId, userId): Promise<void>
  static async setPrimaryImage(imageId, speakerId, userId): Promise<SpeakerImage>
  static async getImagesForSpeaker(speakerId, userId): Promise<SpeakerImage[]>
  static async getPrimaryImage(speakerId, userId): Promise<SpeakerImage | null>
  static async validateSpeakerHasPrimaryImage(speakerId, userId): Promise<boolean>
}
```

**Features:**
- Automatic storage path generation
- Public URL generation
- Auto-set first image as primary
- Auto-promote new primary when deleting current primary
- Cleanup of storage and database in sync

## API Endpoints

### Upload Speaker Image
```
POST /api/speakers/[id]/images
Content-Type: multipart/form-data

Body:
  file: File (required)

Response: 201 Created
{
  "success": true,
  "image": {
    "id": 1,
    "speaker_id": 123,
    "public_url": "https://...",
    "filename": "image.jpg",
    "is_primary": true,
    ...
  }
}
```

### List Speaker Images
```
GET /api/speakers/[id]/images

Response: 200 OK
{
  "images": [
    {
      "id": 1,
      "speaker_id": 123,
      "public_url": "https://...",
      "is_primary": true,
      ...
    }
  ]
}
```

### Delete Speaker Image
```
DELETE /api/speakers/[id]/images/[imageId]

Response: 200 OK
{
  "success": true
}
```

### Set Primary Image
```
PUT /api/speakers/[id]/images/[imageId]/primary

Response: 200 OK
{
  "success": true,
  "image": {
    "id": 1,
    "is_primary": true,
    ...
  }
}
```

### Post to Social Media (New!)
```
POST /api/speakers/[id]/post
Content-Type: application/json

Body:
{
  "caption": "Check out our speaker!",
  "platforms": ["instagram", "linkedin"],
  "use_custom_image": false
}

Response: 200 OK
{
  "success": true,
  "message": "Successfully posted to all platforms",
  "results": {
    "instagram": {
      "success": true,
      "creationId": "123",
      "mediaId": "456"
    },
    "linkedin": {
      "success": true,
      "postUrn": "urn:li:share:789"
    }
  }
}
```

## Usage Examples

### 1. Upload a Speaker Image

```typescript
// Frontend
const formData = new FormData()
formData.append('file', fileInput.files[0])

const response = await fetch(`/api/speakers/${speakerId}/images`, {
  method: 'POST',
  body: formData
})

const { success, image } = await response.json()
console.log('Uploaded:', image.public_url)
```

### 2. Get Speaker's Primary Image

```typescript
// Backend
import { SpeakerImageService } from '@/lib/services/speaker-image-service'

const primaryImage = await SpeakerImageService.getPrimaryImage(
  speakerId,
  userId
)

if (primaryImage) {
  console.log('Primary image URL:', primaryImage.public_url)
}
```

### 3. Post to Instagram with Speaker Image

```typescript
// Option A: Use the integrated endpoint
const response = await fetch(`/api/speakers/${speakerId}/post`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    caption: 'Meet our amazing speaker!',
    platforms: ['instagram']
  })
})

// Option B: Manual integration
import { InstagramService } from '@/lib/services/instagram-service'
import { SpeakerImageService } from '@/lib/services/speaker-image-service'

const primaryImage = await SpeakerImageService.getPrimaryImage(speakerId, userId)

if (!primaryImage) {
  throw new Error('Speaker must have a primary image')
}

const instagramService = new InstagramService()
const result = await instagramService.postToInstagram(
  primaryImage.public_url,
  caption
)
```

### 4. Post to LinkedIn with Speaker Image

```typescript
// Option A: Use the integrated endpoint (recommended)
const response = await fetch(`/api/speakers/${speakerId}/post`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    caption: 'Meet our amazing speaker!',
    platforms: ['linkedin']
  })
})

// Option B: Manual integration
import { LinkedInService } from '@/lib/services/linkedin-service'
import { SpeakerImageService } from '@/lib/services/speaker-image-service'

const primaryImage = await SpeakerImageService.getPrimaryImage(speakerId, userId)

if (!primaryImage) {
  throw new Error('Speaker must have a primary image')
}

// Fetch image and convert to buffer
const imageResponse = await fetch(primaryImage.public_url)
const imageBuffer = await imageResponse.arrayBuffer()

const linkedInService = new LinkedInService()
const postUrn = await linkedInService.postToLinkedIn(
  caption,
  Buffer.from(imageBuffer),
  primaryImage.filename
)
```

### 5. Post to Both Platforms Simultaneously

```typescript
const response = await fetch(`/api/speakers/${speakerId}/post`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    caption: 'Excited to announce our speaker lineup!',
    platforms: ['instagram', 'linkedin']
  })
})

const data = await response.json()

if (data.success) {
  console.log('Instagram Media ID:', data.results.instagram.mediaId)
  console.log('LinkedIn Post URN:', data.results.linkedin.postUrn)
}
```

## Frontend Component Example

Here's a complete React component for managing speaker images:

```typescript
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

interface SpeakerImage {
  id: number
  public_url: string
  filename: string
  is_primary: boolean
  size_bytes: number
  created_at: string
}

export function SpeakerImageManager({ speakerId }: { speakerId: number }) {
  const [images, setImages] = useState<SpeakerImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)

  // Fetch images
  useEffect(() => {
    fetchImages()
  }, [speakerId])

  const fetchImages = async () => {
    try {
      const response = await fetch(`/api/speakers/${speakerId}/images`)
      const data = await response.json()
      setImages(data.images)
    } catch (error) {
      console.error('Error fetching images:', error)
    } finally {
      setLoading(false)
    }
  }

  // Upload new image
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

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }

      await fetchImages()
    } catch (error) {
      console.error('Upload error:', error)
      alert(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // Set as primary
  const handleSetPrimary = async (imageId: number) => {
    try {
      const response = await fetch(
        `/api/speakers/${speakerId}/images/${imageId}/primary`,
        { method: 'PUT' }
      )

      if (!response.ok) {
        throw new Error('Failed to set primary image')
      }

      await fetchImages()
    } catch (error) {
      console.error('Error setting primary:', error)
    }
  }

  // Delete image
  const handleDelete = async (imageId: number) => {
    if (!confirm('Delete this image?')) return

    try {
      const response = await fetch(
        `/api/speakers/${speakerId}/images/${imageId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        throw new Error('Failed to delete image')
      }

      await fetchImages()
    } catch (error) {
      console.error('Error deleting image:', error)
    }
  }

  if (loading) return <div>Loading images...</div>

  return (
    <div className="space-y-4">
      <div>
        <label className="block mb-2 font-medium">Upload Image</label>
        <input
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          onChange={handleUpload}
          disabled={uploading}
          className="block w-full"
        />
        {uploading && <p className="text-sm text-gray-500 mt-1">Uploading...</p>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((image) => (
          <div key={image.id} className="relative border rounded-lg p-2">
            <div className="relative aspect-square mb-2">
              <Image
                src={image.public_url}
                alt={image.filename}
                fill
                className="object-cover rounded"
              />
            </div>

            {image.is_primary && (
              <span className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                Primary
              </span>
            )}

            <p className="text-sm truncate mb-2">{image.filename}</p>

            <div className="flex gap-2">
              {!image.is_primary && (
                <button
                  onClick={() => handleSetPrimary(image.id)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
                >
                  Set Primary
                </button>
              )}
              <button
                onClick={() => handleDelete(image.id)}
                className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {images.length === 0 && (
        <p className="text-gray-500 text-center py-8">
          No images uploaded yet. Upload an image to get started.
        </p>
      )}
    </div>
  )
}
```

## Migration Instructions

### 1. Run the Database Migration

```bash
cd /Users/grant/code/auth-test/otp-flow
supabase db push
```

Or manually run the migration:
```bash
psql -f supabase/migrations/20251009000001_create_speaker_images.sql
```

### 2. Verify Storage Bucket

Check that the `speaker-images` bucket was created:
```sql
SELECT * FROM storage.buckets WHERE id = 'speaker-images';
```

### 3. Test Image Upload

```bash
curl -X POST http://localhost:3000/api/speakers/1/images \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/image.jpg"
```

### 4. Update Existing Code

Update any existing Instagram/LinkedIn posting code to use the new integrated endpoint:

**Before:**
```typescript
await fetch('/api/instagram/post', {
  method: 'POST',
  body: JSON.stringify({
    announcement_id: 123,
    image_url: 'https://...',
    caption: 'Hello'
  })
})
```

**After:**
```typescript
await fetch(`/api/speakers/${speakerId}/post`, {
  method: 'POST',
  body: JSON.stringify({
    caption: 'Hello',
    platforms: ['instagram', 'linkedin']
  })
})
```

## Key Features

### Automatic Behaviors

1. **First Image as Primary**: When uploading the first image for a speaker, it's automatically set as primary
2. **Primary Promotion**: When deleting the current primary image, the most recent remaining image is automatically promoted to primary
3. **Cascade Deletion**: When a speaker is deleted, all associated images are automatically deleted from both database and storage
4. **Public CDN URLs**: All images are served through Supabase's CDN for optimal performance

### Security Features

1. **RLS Enforcement**: All queries enforce row-level security
2. **Ownership Validation**: Every operation validates user ownership through the events table
3. **Type Validation**: Only allowed image types can be uploaded
4. **Size Limits**: 10MB maximum file size
5. **Folder Isolation**: Users can only access their own folders in storage

### Error Handling

All endpoints provide clear error messages:
- `400 Bad Request`: Invalid input or missing primary image
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized to access resource
- `404 Not Found`: Resource doesn't exist
- `500 Internal Server Error`: Server-side errors

## Troubleshooting

### Issue: "Speaker must have a primary image"
**Solution**: Upload at least one image for the speaker first:
```bash
curl -X POST /api/speakers/[id]/images -F "file=@image.jpg"
```

### Issue: "Failed to fetch image"
**Solution**: Ensure the image URL is publicly accessible and uses HTTPS

### Issue: "Unauthorized"
**Solution**: Verify you're logged in and own the speaker (through the event)

### Issue: Storage upload fails
**Solution**: Check bucket exists and policies are correctly set:
```sql
SELECT * FROM storage.buckets WHERE id = 'speaker-images';
SELECT * FROM storage.policies WHERE bucket_id = 'speaker-images';
```

## Performance Considerations

1. **Image Optimization**: Consider resizing large images before upload
2. **Lazy Loading**: Use Next.js Image component with lazy loading
3. **CDN Caching**: Images are cached by Supabase's CDN (3600s default)
4. **Batch Operations**: When posting to multiple platforms, image is fetched only once
5. **Database Indexes**: All foreign keys and primary flags are indexed

## Future Enhancements

- [ ] Image transformation API (resize, crop, compress)
- [ ] Multiple image sizes (thumbnail, medium, full)
- [ ] Image upload progress tracking
- [ ] Bulk image operations
- [ ] Image metadata extraction (EXIF data)
- [ ] Image gallery component with drag-and-drop reordering
- [ ] Automatic image optimization pipeline
- [ ] Image analytics (views, usage tracking)

## Files Created

1. `/supabase/migrations/20251009000001_create_speaker_images.sql` - Database schema
2. `/lib/repositories/speaker-image-repository.ts` - Data access layer
3. `/lib/services/speaker-image-service.ts` - Business logic layer
4. `/app/api/speakers/[id]/images/route.ts` - GET, POST endpoints
5. `/app/api/speakers/[id]/images/[imageId]/route.ts` - DELETE endpoint
6. `/app/api/speakers/[id]/images/[imageId]/primary/route.ts` - PUT endpoint
7. `/app/api/speakers/[id]/post/route.ts` - Integrated social media posting
8. `/lib/services/SPEAKER_IMAGE_INTEGRATION.md` - Integration documentation

## Support

For questions or issues, refer to:
- Integration guide: `/lib/services/SPEAKER_IMAGE_INTEGRATION.md`
- Repository code: `/lib/repositories/speaker-image-repository.ts`
- Service code: `/lib/services/speaker-image-service.ts`
