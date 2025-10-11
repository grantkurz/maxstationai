# X (Twitter) Integration Guide

This guide explains how to integrate X/Twitter posting functionality into your application.

## Overview

The X/Twitter integration allows you to:
- Post tweets with optional images immediately
- Schedule tweets for future publication
- Manage scheduled tweets (view, update, cancel, delete)
- Automatically publish scheduled tweets via cron job

## Architecture

The integration follows a clean architecture pattern:

```
┌─────────────────────────────────────────────────┐
│                 API Routes                      │
│  /api/x/post, /api/x/schedule, /api/x/scheduled │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│              XService                           │
│  - OAuth 1.0a authentication                    │
│  - Media upload                                 │
│  - Tweet posting                                │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│         Twitter API (v1.1 & v2)                 │
│  - Media Upload: v1.1                           │
│  - Tweet Creation: v2                           │
└─────────────────────────────────────────────────┘
```

## Setup Instructions

### 1. Create a Twitter Developer Account

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Sign in with your Twitter account
3. Apply for a developer account (if you don't have one)

### 2. Create a Twitter App

1. In the Developer Portal, click "Create App" or "Add App"
2. Fill in the required information:
   - App name
   - Description
   - Website URL
3. Once created, go to your app's settings

### 3. Get OAuth 1.0a Credentials

1. Navigate to "Keys and tokens" tab
2. Under "Consumer Keys", you'll find:
   - **API Key** (Consumer Key)
   - **API Key Secret** (Consumer Secret)
3. Under "Authentication Tokens", generate:
   - **Access Token**
   - **Access Token Secret**
4. Make sure your app has **Read and Write** permissions:
   - Go to "Settings" tab
   - Scroll to "App permissions"
   - Change to "Read and Write" if needed
   - Regenerate tokens if you changed permissions

### 4. Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# X/Twitter API Configuration
TWITTER_API_KEY=your-api-key-here
TWITTER_API_SECRET=your-api-secret-here
TWITTER_ACCESS_TOKEN=your-access-token-here
TWITTER_ACCESS_SECRET=your-access-secret-here
```

### 5. Verify Setup

Test your credentials by making a simple API call:

```bash
curl -X POST http://localhost:3000/api/x/post \
  -H "Content-Type: multipart/form-data" \
  -F "announcement_id=1"
```

## API Endpoints

### POST /api/x/post

Posts a tweet immediately.

**Request Body (FormData):**
```typescript
{
  announcement_id: number;  // Required
  image?: File;             // Optional
}
```

**Response:**
```json
{
  "success": true,
  "tweet_id": "1234567890",
  "message": "Successfully posted to X/Twitter",
  "announcement_id": 1
}
```

**Example Usage:**
```typescript
const formData = new FormData();
formData.append('announcement_id', '1');
formData.append('image', imageFile);

const response = await fetch('/api/x/post', {
  method: 'POST',
  body: formData
});
```

### POST /api/x/schedule

Schedules a tweet for future publication.

**Request Body (JSON):**
```typescript
{
  announcement_id: number;   // Required
  scheduled_time: string;    // Required (ISO 8601)
  timezone?: string;         // Optional (default: UTC)
  image_url?: string;        // Optional (Supabase Storage URL)
}
```

**Response:**
```json
{
  "success": true,
  "scheduled_post": { ... },
  "message": "Post scheduled successfully"
}
```

**Example Usage:**
```typescript
const response = await fetch('/api/x/schedule', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    announcement_id: 1,
    scheduled_time: '2024-12-31T12:00:00Z',
    timezone: 'America/New_York',
    image_url: 'https://your-storage-url.com/image.jpg'
  })
});
```

### GET /api/x/schedule

Retrieves scheduled tweets.

**Query Parameters:**
- `status` (optional): Filter by status - `pending`, `posted`, `failed`, `cancelled`
- `announcement_id` (optional): Filter by announcement
- `event_id` (optional): Filter by event

**Response:**
```json
{
  "success": true,
  "scheduled_posts": [...],
  "count": 5
}
```

### GET /api/x/scheduled/[id]

Retrieves a specific scheduled tweet.

**Response:**
```json
{
  "success": true,
  "scheduled_post": { ... }
}
```

### PATCH /api/x/scheduled/[id]

Updates a scheduled tweet (only pending posts).

**Request Body:**
```typescript
{
  scheduled_time?: string;
  timezone?: string;
  image_url?: string;
  status?: 'cancelled';  // Only 'cancelled' can be set manually
}
```

### DELETE /api/x/scheduled/[id]

Permanently deletes a scheduled tweet.

**Response:**
```json
{
  "success": true,
  "message": "Scheduled post deleted successfully"
}
```

## XService API

The `XService` class provides low-level access to Twitter API functionality.

### Constructor

```typescript
import { XService } from '@/lib/services/x-service';

const xService = new XService();
```

Automatically loads credentials from environment variables.

### Methods

#### postToX(text, imageBuffer?, filename?)

Posts a tweet with optional image.

```typescript
// Text-only tweet
const tweetId = await xService.postToX('Hello X/Twitter!');

// Tweet with image
const imageBuffer = await fs.readFile('image.jpg');
const tweetId = await xService.postToX(
  'Check out this image!',
  imageBuffer,
  'image.jpg'
);
```

#### uploadMedia(imageBuffer, filename)

Uploads an image to Twitter and returns media ID.

```typescript
const mediaId = await xService.uploadMedia(imageBuffer, 'photo.jpg');
```

#### createTweet(text, mediaId?)

Creates a tweet with optional media attachment.

```typescript
const tweetId = await xService.createTweet('Hello!', mediaId);
```

#### downloadImage(imageUrl)

Downloads an image from a URL.

```typescript
const buffer = await xService.downloadImage('https://example.com/image.jpg');
```

## Image Requirements

Twitter has specific requirements for images:

- **Supported formats**: JPEG, PNG, GIF, WebP
- **Maximum size**: 5MB (for photos)
- **Recommended dimensions**:
  - Photos: 1200x675 (16:9 aspect ratio)
  - Square: 1200x1200

## Tweet Character Limits

- Standard tweets: **280 characters**
- Extended tweets: Supported automatically by API

## Error Handling

The service uses custom error classes:

```typescript
import { XAPIError } from '@/lib/services/x-service';

try {
  await xService.postToX('Hello!');
} catch (error) {
  if (error instanceof XAPIError) {
    console.error('Twitter API error:', error.message);
    console.error('Status code:', error.statusCode);
    console.error('Response:', error.response);
  }
}
```

## Rate Limits

Twitter API has rate limits:

- **Tweet creation**: 300 tweets per 3 hours
- **Media upload**: 500 uploads per 24 hours

The service automatically handles rate limit errors. Consider implementing:
- Request queuing
- Exponential backoff
- Rate limit monitoring

## Scheduled Posts & Cron Job

Scheduled tweets are automatically published by a cron job at `/api/cron/publish-scheduled-posts`.

### Cron Job Configuration

1. Set `CRON_SECRET` in your environment:
```bash
CRON_SECRET=$(openssl rand -base64 32)
```

2. Configure your scheduler (e.g., Vercel Cron, Supabase pg_cron) to call:
```
POST /api/cron/publish-scheduled-posts
Authorization: Bearer YOUR_CRON_SECRET
```

3. Recommended frequency: Every 5 minutes

### How It Works

1. Cron job queries for pending posts with `scheduled_time <= now()`
2. For each post:
   - Downloads image if `image_url` is provided
   - Posts to Twitter using `XService`
   - Marks post as `posted` or `failed`
3. Returns summary: `{ published: 5, failed: 0 }`

## Security Best Practices

1. **Never commit credentials** - Always use environment variables
2. **Use HTTPS** - All API calls use HTTPS by default
3. **Validate inputs** - All inputs are validated before API calls
4. **Rate limiting** - Implement rate limiting on your API routes
5. **Monitor usage** - Track API usage to avoid exceeding limits

## Troubleshooting

### "Twitter credentials not configured"

**Solution**: Verify all four environment variables are set:
- `TWITTER_API_KEY`
- `TWITTER_API_SECRET`
- `TWITTER_ACCESS_TOKEN`
- `TWITTER_ACCESS_SECRET`

### "Failed to upload media"

**Possible causes:**
1. Image file is too large (> 5MB)
2. Invalid image format
3. Corrupted image data

**Solution**: Validate image before upload

### "Failed to create tweet" (403 Forbidden)

**Possible causes:**
1. App doesn't have write permissions
2. Access token is invalid or revoked
3. Tweet violates Twitter's policies

**Solution**: Check app permissions in Developer Portal

### OAuth signature errors

**Possible causes:**
1. System clock is not synchronized
2. Credentials contain extra whitespace
3. URL encoding issues

**Solution**:
- Sync system clock
- Trim credentials in environment variables
- Verify URL encoding implementation

## Comparison with LinkedIn Integration

| Feature | LinkedIn | X/Twitter |
|---------|----------|-----------|
| Authentication | OAuth 2.0 + Refresh Token | OAuth 1.0a |
| Media Upload | 3-step process | Single upload |
| Post Creation | UGC API | Tweets API v2 |
| Character Limit | 3000 | 280 |
| Image Size | 10MB | 5MB |

## Additional Resources

- [Twitter API Documentation](https://developer.twitter.com/en/docs/twitter-api)
- [OAuth 1.0a Specification](https://oauth.net/core/1.0a/)
- [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
- [Rate Limits](https://developer.twitter.com/en/docs/twitter-api/rate-limits)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Twitter API documentation
3. Check Twitter API status: https://api.twitterstat.us/
4. Contact your development team
