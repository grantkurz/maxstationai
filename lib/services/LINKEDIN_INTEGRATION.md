# LinkedIn Integration Guide

This document describes the LinkedIn posting and scheduling system implemented in this application.

## Overview

The LinkedIn integration allows users to:
1. Post announcements immediately to LinkedIn with optional images
2. Schedule announcements for future publication
3. Track scheduled posts and their status
4. Cancel or modify scheduled posts

## Architecture

### Database Layer
- **Migration**: `/supabase/migrations/20251006000001_create_scheduled_posts.sql`
- **Table**: `scheduled_posts` - Stores scheduled social media posts with full metadata
- **RLS Policies**: Users can only access their own scheduled posts

### Repository Layer
- **File**: `/lib/repositories/scheduled-post-repository.ts`
- **Purpose**: Pure data access operations for scheduled_posts table
- **Methods**: CRUD operations, status updates, pending post queries

### Service Layer
- **LinkedIn Service**: `/lib/services/linkedin-service.ts`
  - Handles LinkedIn API v2 integration
  - Three-step image upload process (register, upload, create post)
  - Support for text-only and image posts

- **Scheduled Post Service**: `/lib/services/scheduled-post-service.ts`
  - Business logic for scheduling posts
  - Validation (ownership, future dates, duplicates)
  - Status management

### API Routes
- **POST** `/api/linkedin/post` - Immediate posting with image support
- **POST** `/api/linkedin/schedule` - Schedule a post
- **GET** `/api/linkedin/schedule` - List scheduled posts
- **GET** `/api/linkedin/scheduled/[id]` - Get specific scheduled post
- **PATCH** `/api/linkedin/scheduled/[id]` - Update/cancel scheduled post
- **DELETE** `/api/linkedin/scheduled/[id]` - Delete scheduled post

## Environment Variables

Add these to your `.env.local`:

```bash
# LinkedIn API Configuration
LINKEDIN_ACCESS_TOKEN=your-linkedin-access-token
LINKEDIN_OWNER_URN=urn:li:person:YOUR_PERSON_ID
```

### Getting LinkedIn Credentials

1. **Create LinkedIn App**:
   - Go to https://www.linkedin.com/developers/apps
   - Create a new app or use existing
   - Request access to "Share on LinkedIn" and "Advertising API" products

2. **Get Access Token**:
   - Use LinkedIn OAuth 2.0 flow to get user access token
   - Required scopes: `w_member_social`, `r_liteprofile`
   - Token expires - implement refresh token flow for production

3. **Get Owner URN**:
   - For personal posts: `urn:li:person:YOUR_PERSON_ID`
   - For organization posts: `urn:li:organization:YOUR_ORG_ID`
   - Get person ID from: `GET https://api.linkedin.com/v2/me`

## API Usage Examples

### 1. Post Immediately to LinkedIn

**With Image**:
```javascript
const formData = new FormData();
formData.append('announcement_id', '123');
formData.append('image', imageFile); // File object

const response = await fetch('/api/linkedin/post', {
  method: 'POST',
  body: formData,
});

const data = await response.json();
// { success: true, post_urn: "urn:li:share:123456", ... }
```

**Text Only**:
```javascript
const formData = new FormData();
formData.append('announcement_id', '123');

const response = await fetch('/api/linkedin/post', {
  method: 'POST',
  body: formData,
});
```

### 2. Schedule a Post

```javascript
const response = await fetch('/api/linkedin/schedule', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    announcement_id: 123,
    scheduled_time: '2025-10-15T14:30:00Z', // ISO 8601
    timezone: 'America/New_York',
    image_url: 'https://storage.supabase.co/...', // Optional
  }),
});

const data = await response.json();
// { success: true, scheduled_post: {...}, ... }
```

### 3. List Scheduled Posts

```javascript
// All scheduled posts
const response = await fetch('/api/linkedin/schedule');

// Filter by status
const response = await fetch('/api/linkedin/schedule?status=pending');

// Filter by announcement
const response = await fetch('/api/linkedin/schedule?announcement_id=123');

// Filter by event
const response = await fetch('/api/linkedin/schedule?event_id=456');

const data = await response.json();
// { success: true, scheduled_posts: [...], count: 5 }
```

### 4. Cancel a Scheduled Post

```javascript
const response = await fetch('/api/linkedin/scheduled/123', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'cancelled',
  }),
});
```

### 5. Delete a Scheduled Post

```javascript
const response = await fetch('/api/linkedin/scheduled/123', {
  method: 'DELETE',
});
```

## LinkedIn API Details

### Image Upload Process

The LinkedIn v2 API requires a three-step process for posting with images:

1. **Register Upload** (`/v2/assets?action=registerUpload`)
   - Reserves an upload slot
   - Returns upload URL and asset URN

2. **Upload Binary** (PUT to upload URL)
   - Upload raw image bytes
   - Set correct Content-Type header

3. **Create Post** (`/v2/ugcPosts`)
   - Reference the asset URN
   - Include post text and visibility settings

### Supported Image Types

- JPEG/JPG
- PNG
- GIF
- WebP
- Maximum file size: 10MB

### Post Visibility

All posts are created with `PUBLIC` visibility:
```json
{
  "visibility": {
    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
  }
}
```

## Database Schema

### scheduled_posts Table

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| user_id | UUID | Owner (foreign key to users) |
| announcement_id | BIGINT | Reference to announcement |
| speaker_id | BIGINT | Denormalized for queries |
| event_id | BIGINT | Denormalized for queries |
| scheduled_time | TIMESTAMPTZ | When to publish |
| timezone | TEXT | Timezone for scheduled_time |
| platform | TEXT | 'linkedin', 'twitter', 'instagram' |
| status | TEXT | 'pending', 'posted', 'failed', 'cancelled' |
| post_text | TEXT | Post content (denormalized) |
| image_url | TEXT | Optional Supabase Storage URL |
| posted_at | TIMESTAMPTZ | When post was published |
| posted_urn | TEXT | LinkedIn URN after posting |
| error_message | TEXT | Error if failed |
| retry_count | INTEGER | Number of retry attempts |
| last_retry_at | TIMESTAMPTZ | Last retry timestamp |

### Indexes

- `idx_scheduled_posts_user_id` - User queries
- `idx_scheduled_posts_announcement_id` - Announcement lookups
- `idx_scheduled_posts_status` - Status filtering
- `idx_scheduled_posts_pending_scheduled` - Cron job queries
- `idx_scheduled_posts_user_scheduled` - User dashboard
- `idx_scheduled_posts_platform_status` - Platform filtering

## Security

### Authentication
- All endpoints require Supabase authentication
- User session validated via `createRouteHandlerClient`

### Authorization
- RLS policies ensure users can only access their own data
- Service layer validates ownership of announcements/events
- Cannot schedule posts for announcements you don't own

### Validation
- Scheduled time must be in the future
- Image file type and size validation
- Platform-specific character limits enforced
- Duplicate schedule prevention

## Error Handling

### LinkedIn API Errors
- `LinkedInAPIError` class with status code and response details
- Automatic retry logic for transient failures (in cron job)
- Error messages stored in database for debugging

### Common Errors

| Error | Status | Cause |
|-------|--------|-------|
| Unauthorized | 401 | Not logged in |
| Forbidden | 403 | Don't own resource |
| Not Found | 404 | Resource doesn't exist |
| Bad Request | 400 | Validation failure |
| Service Unavailable | 503 | LinkedIn credentials not configured |
| Internal Server Error | 500 | Unexpected error |

## Cron Job for Publishing

To automatically publish scheduled posts, create a cron job (e.g., Vercel Cron, GitHub Actions):

```typescript
// app/api/cron/publish-scheduled-posts/route.ts
import { ScheduledPostService } from '@/lib/services/scheduled-post-service';
import { LinkedInService } from '@/lib/services/linkedin-service';

export async function GET() {
  const supabase = createClient(); // Service role client
  const scheduledPostService = new ScheduledPostService(supabase);
  const linkedInService = new LinkedInService();

  // Get pending posts ready to publish
  const posts = await scheduledPostService.getPendingScheduledPosts();

  for (const post of posts) {
    try {
      // Fetch image if provided
      let imageBuffer;
      if (post.image_url) {
        imageBuffer = await fetchImage(post.image_url);
      }

      // Post to LinkedIn
      const postUrn = await linkedInService.postToLinkedIn(
        post.post_text,
        imageBuffer,
        'image.jpg'
      );

      // Mark as posted
      await scheduledPostService.markAsPosted(post.id, postUrn);
    } catch (error) {
      // Mark as failed
      await scheduledPostService.markAsFailed(
        post.id,
        error.message
      );
    }
  }

  return Response.json({ success: true });
}
```

## Testing

### Manual Testing
1. Create an announcement via `/api/announcements`
2. Post immediately via `/api/linkedin/post`
3. Schedule for future via `/api/linkedin/schedule`
4. List scheduled posts via `/api/linkedin/schedule`
5. Cancel via `/api/linkedin/scheduled/[id]`

### Test Mode
For development, use a LinkedIn test app or sandbox environment to avoid posting to production profile.

## Production Considerations

1. **Token Refresh**: LinkedIn access tokens expire - implement OAuth refresh flow
2. **Rate Limiting**: LinkedIn has rate limits - implement exponential backoff
3. **Monitoring**: Track failed posts and retry counts
4. **Webhooks**: Consider LinkedIn webhooks for post status updates
5. **Image Storage**: Store images in Supabase Storage before scheduling
6. **Timezone Handling**: Properly convert scheduled times to UTC
7. **Queue System**: For high volume, use a job queue (BullMQ, etc.)

## Troubleshooting

### "LinkedIn credentials not configured"
- Check `.env.local` has `LINKEDIN_ACCESS_TOKEN` and `LINKEDIN_OWNER_URN`
- Verify environment variables are loaded (restart Next.js dev server)

### "Failed to register upload"
- Access token may be expired - get a new one
- App may not have required permissions - check LinkedIn app settings
- Owner URN may be incorrect - verify format

### "Invalid image type"
- Only JPEG, PNG, GIF, WebP supported
- Check file MIME type is correct
- File may be corrupted

### "Scheduled time must be in the future"
- Ensure ISO 8601 timestamp is correct
- Check timezone conversion
- Server time may be different from client time

## Future Enhancements

1. **Multi-Platform**: Extend to Twitter and Instagram
2. **Recurring Posts**: Support recurring schedule patterns
3. **Post Analytics**: Track engagement metrics
4. **Draft Posts**: Save drafts before scheduling
5. **Bulk Scheduling**: Schedule multiple posts at once
6. **Template Library**: Reusable post templates
7. **Image Generation**: AI-generated images for posts
8. **Preview**: Preview how post will look on LinkedIn
