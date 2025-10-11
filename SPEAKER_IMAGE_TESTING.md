# Speaker Image System - Testing Guide

Complete testing guide for the speaker image management system.

## Prerequisites

Before testing:
- [ ] Database migration applied successfully
- [ ] Supabase project configured
- [ ] User authenticated in the application
- [ ] At least one event and speaker created

## Manual Testing Checklist

### 1. Database Setup Verification

```sql
-- Check table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'speaker_images'
);

-- Check columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'speaker_images';

-- Check indexes
SELECT indexname
FROM pg_indexes
WHERE tablename = 'speaker_images';

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'speaker_images';

-- Check storage bucket
SELECT * FROM storage.buckets WHERE id = 'speaker-images';

-- Check storage policies
SELECT * FROM storage.policies WHERE bucket_id = 'speaker-images';
```

### 2. API Endpoint Testing

#### A. Upload Image (POST /api/speakers/[id]/images)

**Test Case 1: Valid Image Upload**
```bash
# Prerequisites: Replace with actual values
SPEAKER_ID=1
AUTH_TOKEN="your-auth-token"

# Upload a valid JPEG image
curl -X POST "http://localhost:3000/api/speakers/${SPEAKER_ID}/images" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -F "file=@test-image.jpg" \
  -v

# Expected: 201 Created
# Response should include:
# - image.id
# - image.public_url (HTTPS URL)
# - image.is_primary = true (if first image)
```

**Test Case 2: Invalid File Type**
```bash
curl -X POST "http://localhost:3000/api/speakers/${SPEAKER_ID}/images" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -F "file=@test-file.pdf" \
  -v

# Expected: 500 Internal Server Error
# Response: "Invalid file type" error
```

**Test Case 3: File Too Large**
```bash
# Create a large file (>10MB)
dd if=/dev/zero of=large-image.jpg bs=1M count=11

curl -X POST "http://localhost:3000/api/speakers/${SPEAKER_ID}/images" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -F "file=@large-image.jpg" \
  -v

# Expected: 500 Internal Server Error
# Response: File size exceeds maximum error
```

**Test Case 4: Unauthorized Access**
```bash
# Try to upload without authentication
curl -X POST "http://localhost:3000/api/speakers/${SPEAKER_ID}/images" \
  -F "file=@test-image.jpg" \
  -v

# Expected: 401 Unauthorized
```

**Test Case 5: Invalid Speaker ID**
```bash
curl -X POST "http://localhost:3000/api/speakers/99999/images" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -F "file=@test-image.jpg" \
  -v

# Expected: 500 Internal Server Error
# Response: Speaker not found or access denied
```

#### B. List Images (GET /api/speakers/[id]/images)

**Test Case 1: List All Images**
```bash
curl -X GET "http://localhost:3000/api/speakers/${SPEAKER_ID}/images" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -v

# Expected: 200 OK
# Response: { images: [...] }
```

**Test Case 2: Empty List**
```bash
# For a speaker with no images
curl -X GET "http://localhost:3000/api/speakers/NEW_SPEAKER_ID/images" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -v

# Expected: 200 OK
# Response: { images: [] }
```

#### C. Set Primary Image (PUT /api/speakers/[id]/images/[imageId]/primary)

**Test Case 1: Set Primary**
```bash
IMAGE_ID=1

curl -X PUT "http://localhost:3000/api/speakers/${SPEAKER_ID}/images/${IMAGE_ID}/primary" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -v

# Expected: 200 OK
# Response: { success: true, image: { is_primary: true } }
```

**Test Case 2: Verify Only One Primary**
```bash
# After setting primary, verify only one image has is_primary = true
curl -X GET "http://localhost:3000/api/speakers/${SPEAKER_ID}/images" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  | jq '[.images[] | select(.is_primary == true)] | length'

# Expected: Should output "1"
```

#### D. Delete Image (DELETE /api/speakers/[id]/images/[imageId])

**Test Case 1: Delete Non-Primary Image**
```bash
IMAGE_ID=2

curl -X DELETE "http://localhost:3000/api/speakers/${SPEAKER_ID}/images/${IMAGE_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -v

# Expected: 200 OK
# Response: { success: true }
```

**Test Case 2: Delete Primary Image**
```bash
# Get primary image ID
PRIMARY_ID=$(curl -s "http://localhost:3000/api/speakers/${SPEAKER_ID}/images" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  | jq '.images[] | select(.is_primary == true) | .id')

# Delete primary
curl -X DELETE "http://localhost:3000/api/speakers/${SPEAKER_ID}/images/${PRIMARY_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -v

# Expected: 200 OK
# Verify: Another image should now be primary
curl -s "http://localhost:3000/api/speakers/${SPEAKER_ID}/images" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  | jq '.images[] | select(.is_primary == true)'
```

#### E. Post to Social Media (POST /api/speakers/[id]/post)

**Test Case 1: Post to Instagram Only**
```bash
curl -X POST "http://localhost:3000/api/speakers/${SPEAKER_ID}/post" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "caption": "Test post to Instagram!",
    "platforms": ["instagram"]
  }' \
  -v

# Expected: 200 OK
# Response: { success: true, results: { instagram: { mediaId: "..." } } }
```

**Test Case 2: Post to LinkedIn Only**
```bash
curl -X POST "http://localhost:3000/api/speakers/${SPEAKER_ID}/post" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "caption": "Test post to LinkedIn!",
    "platforms": ["linkedin"]
  }' \
  -v

# Expected: 200 OK
# Response: { success: true, results: { linkedin: { postUrn: "..." } } }
```

**Test Case 3: Post to Both Platforms**
```bash
curl -X POST "http://localhost:3000/api/speakers/${SPEAKER_ID}/post" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "caption": "Test post to both platforms!",
    "platforms": ["instagram", "linkedin"]
  }' \
  -v

# Expected: 200 OK
# Response: Both platforms in results
```

**Test Case 4: Post Without Primary Image**
```bash
# Delete all images first
curl -X GET "http://localhost:3000/api/speakers/${SPEAKER_ID}/images" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  | jq -r '.images[].id' \
  | xargs -I {} curl -X DELETE "http://localhost:3000/api/speakers/${SPEAKER_ID}/images/{}" \
    -H "Authorization: Bearer ${AUTH_TOKEN}"

# Try to post
curl -X POST "http://localhost:3000/api/speakers/${SPEAKER_ID}/post" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "caption": "This should fail",
    "platforms": ["instagram"]
  }' \
  -v

# Expected: 400 Bad Request
# Response: "Speaker must have a primary image"
```

**Test Case 5: Post with Custom Image**
```bash
curl -X POST "http://localhost:3000/api/speakers/${SPEAKER_ID}/post" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "caption": "Post with custom image!",
    "platforms": ["instagram"],
    "use_custom_image": true,
    "custom_image_url": "https://example.com/custom-image.jpg"
  }' \
  -v

# Expected: 200 OK or 500 if image URL is invalid
```

### 3. Business Logic Testing

#### A. Auto-Set First Image as Primary

```typescript
// Test in TypeScript
import { SpeakerImageService } from '@/lib/services/speaker-image-service'

// Upload first image
const formData1 = new FormData()
formData1.append('file', file1)
const response1 = await fetch(`/api/speakers/${speakerId}/images`, {
  method: 'POST',
  body: formData1
})
const result1 = await response1.json()

console.assert(result1.image.is_primary === true, 'First image should be primary')

// Upload second image
const formData2 = new FormData()
formData2.append('file', file2)
const response2 = await fetch(`/api/speakers/${speakerId}/images`, {
  method: 'POST',
  body: formData2
})
const result2 = await response2.json()

console.assert(result2.image.is_primary === false, 'Second image should not be primary')
```

#### B. Auto-Promote on Primary Deletion

```typescript
// Get current primary
const listResponse1 = await fetch(`/api/speakers/${speakerId}/images`)
const list1 = await listResponse1.json()
const currentPrimary = list1.images.find(img => img.is_primary)

// Delete primary
await fetch(`/api/speakers/${speakerId}/images/${currentPrimary.id}`, {
  method: 'DELETE'
})

// Check new primary exists
const listResponse2 = await fetch(`/api/speakers/${speakerId}/images`)
const list2 = await listResponse2.json()
const newPrimary = list2.images.find(img => img.is_primary)

console.assert(newPrimary !== undefined, 'Should have a new primary')
console.assert(newPrimary.id !== currentPrimary.id, 'Should be different image')
```

#### C. Only One Primary Per Speaker

```typescript
// Upload multiple images
for (let i = 0; i < 3; i++) {
  const formData = new FormData()
  formData.append('file', files[i])
  await fetch(`/api/speakers/${speakerId}/images`, {
    method: 'POST',
    body: formData
  })
}

// Set different image as primary
const listResponse = await fetch(`/api/speakers/${speakerId}/images`)
const list = await listResponse.json()
const secondImage = list.images[1]

await fetch(`/api/speakers/${speakerId}/images/${secondImage.id}/primary`, {
  method: 'PUT'
})

// Verify only one primary
const finalList = await fetch(`/api/speakers/${speakerId}/images`)
const finalData = await finalList.json()
const primaryCount = finalData.images.filter(img => img.is_primary).length

console.assert(primaryCount === 1, 'Should only have one primary image')
```

### 4. Security Testing

#### A. RLS Policy Verification

```sql
-- Try to access another user's speaker images
SET SESSION ROLE authenticated;
SET request.jwt.claims.sub = 'user-id-1';

-- Should see own images
SELECT * FROM speaker_images WHERE user_id = 'user-id-1';

-- Should NOT see other user's images
SELECT * FROM speaker_images WHERE user_id = 'user-id-2';
-- Expected: Empty result
```

#### B. Ownership Validation

```bash
# Try to access speaker from different user
OTHER_SPEAKER_ID=999  # Speaker owned by different user

curl -X GET "http://localhost:3000/api/speakers/${OTHER_SPEAKER_ID}/images" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -v

# Expected: Empty images array or error
```

#### C. Storage Access Control

```bash
# Try to upload to another user's folder
curl -X POST "https://YOUR_PROJECT.supabase.co/storage/v1/object/speaker-images/other-user-id/1/test.jpg" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -F "file=@test.jpg" \
  -v

# Expected: 403 Forbidden
```

### 5. Performance Testing

#### A. Concurrent Uploads

```bash
# Upload 5 images concurrently
for i in {1..5}; do
  curl -X POST "http://localhost:3000/api/speakers/${SPEAKER_ID}/images" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    -F "file=@test-image-${i}.jpg" \
    -v &
done
wait

# Verify all uploaded successfully
curl -s "http://localhost:3000/api/speakers/${SPEAKER_ID}/images" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  | jq '.images | length'

# Expected: 5
```

#### B. Large File Upload Time

```bash
# Create a large (but valid) image
# Note: Max is 10MB
dd if=/dev/urandom of=large-valid.jpg bs=1M count=9

# Time the upload
time curl -X POST "http://localhost:3000/api/speakers/${SPEAKER_ID}/images" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -F "file=@large-valid.jpg" \
  -v

# Expected: < 5 seconds
```

### 6. Edge Cases

#### A. Unicode Filenames

```bash
# Upload file with unicode characters
curl -X POST "http://localhost:3000/api/speakers/${SPEAKER_ID}/images" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -F "file=@测试图片.jpg" \
  -v

# Expected: 201 Created
# Filename should be sanitized
```

#### B. Special Characters in Filename

```bash
# Upload file with special characters
curl -X POST "http://localhost:3000/api/speakers/${SPEAKER_ID}/images" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -F "file=@test@#$%^&*.jpg" \
  -v

# Expected: 201 Created
# Filename should be sanitized to alphanumeric + dots/dashes/underscores
```

#### C. Delete Last Image

```bash
# Delete all images except one
# Then delete the last one
LAST_IMAGE_ID=$(curl -s "http://localhost:3000/api/speakers/${SPEAKER_ID}/images" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  | jq -r '.images[-1].id')

curl -X DELETE "http://localhost:3000/api/speakers/${SPEAKER_ID}/images/${LAST_IMAGE_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -v

# Expected: 200 OK
# Verify speaker.primary_image_id is now NULL
```

## Automated Test Suite

### Jest Test Example

```typescript
// __tests__/speaker-images.test.ts
import { SpeakerImageService } from '@/lib/services/speaker-image-service'
import { SpeakerImageRepository } from '@/lib/repositories/speaker-image-repository'

describe('Speaker Image Service', () => {
  const mockUserId = 'user-123'
  const mockSpeakerId = 1

  beforeEach(() => {
    // Setup test database
  })

  afterEach(() => {
    // Cleanup
  })

  describe('uploadImage', () => {
    it('should upload valid image', async () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      const result = await SpeakerImageService.uploadImage(
        mockSpeakerId,
        mockUserId,
        file
      )

      expect(result.filename).toBe('test.jpg')
      expect(result.public_url).toContain('https://')
    })

    it('should reject invalid file type', async () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })

      await expect(
        SpeakerImageService.uploadImage(mockSpeakerId, mockUserId, file)
      ).rejects.toThrow('Invalid file type')
    })

    it('should set first image as primary', async () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      const result = await SpeakerImageService.uploadImage(
        mockSpeakerId,
        mockUserId,
        file
      )

      expect(result.is_primary).toBe(true)
    })
  })

  describe('setPrimaryImage', () => {
    it('should set only one image as primary', async () => {
      // Upload two images
      const file1 = new File(['content1'], 'test1.jpg', { type: 'image/jpeg' })
      const file2 = new File(['content2'], 'test2.jpg', { type: 'image/jpeg' })

      const image1 = await SpeakerImageService.uploadImage(mockSpeakerId, mockUserId, file1)
      const image2 = await SpeakerImageService.uploadImage(mockSpeakerId, mockUserId, file2)

      // Set second as primary
      await SpeakerImageService.setPrimaryImage(image2.id, mockSpeakerId, mockUserId)

      // Verify
      const images = await SpeakerImageService.getImagesForSpeaker(mockSpeakerId, mockUserId)
      const primaryImages = images.filter(img => img.is_primary)

      expect(primaryImages.length).toBe(1)
      expect(primaryImages[0].id).toBe(image2.id)
    })
  })
})
```

## Monitoring & Logging

### Check Application Logs

```bash
# Check for errors in Next.js logs
tail -f .next/server.log | grep -i error

# Check Supabase logs
# Go to Supabase Dashboard > Logs
```

### Database Query Performance

```sql
-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%speaker_images%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'speaker_images';
```

### Storage Usage

```sql
-- Check storage bucket size
SELECT
  bucket_id,
  COUNT(*) as file_count,
  SUM(metadata->>'size')::bigint / (1024*1024) as total_mb
FROM storage.objects
WHERE bucket_id = 'speaker-images'
GROUP BY bucket_id;
```

## Test Results Template

Use this template to document your test results:

```markdown
# Test Results - Speaker Image System

**Date**: YYYY-MM-DD
**Tester**: Your Name
**Environment**: Development / Staging / Production

## Database Setup
- [ ] Migration applied successfully
- [ ] Storage bucket exists
- [ ] RLS policies active
- [ ] Storage policies active

## API Endpoints
- [ ] Upload valid image: PASS / FAIL
- [ ] Upload invalid type: PASS / FAIL
- [ ] Upload too large: PASS / FAIL
- [ ] List images: PASS / FAIL
- [ ] Set primary: PASS / FAIL
- [ ] Delete image: PASS / FAIL
- [ ] Post to Instagram: PASS / FAIL
- [ ] Post to LinkedIn: PASS / FAIL

## Business Logic
- [ ] First image auto-primary: PASS / FAIL
- [ ] Auto-promote on delete: PASS / FAIL
- [ ] Only one primary: PASS / FAIL

## Security
- [ ] RLS enforcement: PASS / FAIL
- [ ] Ownership validation: PASS / FAIL
- [ ] Storage access control: PASS / FAIL

## Performance
- [ ] Upload < 5s for 10MB: PASS / FAIL
- [ ] Concurrent uploads work: PASS / FAIL
- [ ] CDN delivery < 200ms: PASS / FAIL

## Edge Cases
- [ ] Unicode filenames: PASS / FAIL
- [ ] Special characters: PASS / FAIL
- [ ] Delete last image: PASS / FAIL

## Issues Found
1. Issue description
2. Issue description

## Notes
Additional observations...
```

## Troubleshooting Common Issues

### Issue: "Table does not exist"
```sql
-- Verify table exists
SELECT * FROM information_schema.tables WHERE table_name = 'speaker_images';

-- If not, run migration
\i supabase/migrations/20251009000001_create_speaker_images.sql
```

### Issue: "Storage bucket not found"
```sql
-- Check bucket
SELECT * FROM storage.buckets WHERE id = 'speaker-images';

-- Create if missing
INSERT INTO storage.buckets (id, name, public)
VALUES ('speaker-images', 'speaker-images', true);
```

### Issue: "RLS policy blocks access"
```sql
-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'speaker_images';

-- Verify user ID matches
SELECT auth.uid();  -- Should match user_id in speaker_images
```

### Issue: "Image URL not HTTPS"
Check Supabase project URL configuration and ensure `getPublicUrl` returns HTTPS.

## Success Criteria

All tests should pass with:
- ✅ 100% RLS coverage (no unauthorized access)
- ✅ Proper error handling (clear error messages)
- ✅ Performance within targets (< 5s uploads)
- ✅ No data corruption (cascade deletes work)
- ✅ Security validated (ownership enforced)
- ✅ Edge cases handled (unicode, special chars)

---

**Ready to test!** Follow the checklist above and document your results.
