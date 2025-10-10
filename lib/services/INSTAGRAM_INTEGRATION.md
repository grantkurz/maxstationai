# Instagram Integration Guide

This guide explains how to integrate Instagram posting functionality into your Next.js application using the Facebook Graph API v21.0.

## Overview

The Instagram integration allows you to programmatically post images with captions to an Instagram Business Account. This uses the Instagram Graph API, which is part of Meta's Facebook Graph API.

## Architecture

The integration follows a clean layered architecture:

```
┌─────────────────────────────────────────────┐
│          API Route Layer                    │
│  app/api/instagram/post/route.ts            │
│  - Authentication                           │
│  - Request validation                       │
│  - Error handling                           │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│          Service Layer                      │
│  lib/services/instagram-service.ts          │
│  - Business logic                           │
│  - API communication                        │
│  - 2-step posting flow                      │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│       Instagram Graph API v21.0             │
│  https://graph.facebook.com/v21.0           │
└─────────────────────────────────────────────┘
```

## Prerequisites

### 1. Facebook App Setup

1. Go to [Facebook Developers](https://developers.facebook.com/apps)
2. Create a new app or use an existing one
3. Add the **Instagram Graph API** product to your app
4. Configure the app settings

### 2. Instagram Business Account

- You need an **Instagram Business Account** (not a personal account)
- The Instagram account must be connected to a **Facebook Page**
- You cannot post to personal Instagram accounts via API

### 3. Required Permissions

Your access token needs these permissions:
- `instagram_basic` - Read Instagram account info
- `instagram_content_publish` - Publish content to Instagram
- `pages_read_engagement` - Read Page data (for Page access)

## Setup Instructions

### Step 1: Get Instagram User ID

The Instagram User ID is a numeric identifier (not the @username) that represents your Instagram Business Account.

```bash
# First, get your Facebook Page ID
curl "https://graph.facebook.com/v21.0/me/accounts?access_token=YOUR_ACCESS_TOKEN"

# Response will include:
# {
#   "data": [
#     {
#       "id": "1234567890",  <- This is your Page ID
#       "name": "Your Page Name"
#     }
#   ]
# }

# Then get the Instagram Business Account ID
curl "https://graph.facebook.com/v21.0/{PAGE_ID}?fields=instagram_business_account&access_token=YOUR_ACCESS_TOKEN"

# Response:
# {
#   "instagram_business_account": {
#     "id": "17841400123456789"  <- This is your Instagram User ID
#   }
# }
```

### Step 2: Get Access Token

**Option A: Short-lived Token (1 hour)**
1. Use Facebook's [Access Token Tool](https://developers.facebook.com/tools/accesstoken/)
2. Select your app and get a User Access Token
3. Exchange it for a Page Access Token using the Graph API Explorer

**Option B: Long-lived Token (60 days)**
```bash
# Exchange short-lived token for long-lived token
curl "https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=SHORT_LIVED_TOKEN"
```

**Option C: Never-expiring Token (Recommended for production)**
1. Create a System User in Facebook Business Manager
2. Assign the System User to your app
3. Generate a System User Access Token (never expires)
4. See: [System User Tokens](https://developers.facebook.com/docs/facebook-login/access-tokens/system-user-tokens)

### Step 3: Configure Environment Variables

Add to your `.env.local`:

```bash
# Instagram API Configuration
INSTAGRAM_USER_ID=17841400123456789
INSTAGRAM_ACCESS_TOKEN=your-page-access-token

# Alternative: Use FB_PAGE_ACCESS_TOKEN if you prefer
# FB_PAGE_ACCESS_TOKEN=your-page-access-token
```

**Security Notes:**
- Never commit access tokens to version control
- Use different tokens for development and production
- Rotate tokens periodically
- Monitor token usage in Facebook's developer dashboard

## API Usage

### Instagram Posting Flow

Instagram requires a 2-step process to publish content:

```typescript
import { InstagramService } from '@/lib/services/instagram-service';

// Initialize service (reads from environment variables)
const instagramService = new InstagramService();

// Step 1: Create media container
const creationId = await instagramService.createMediaContainer(
  "https://example.com/image.jpg",
  "Check out this amazing post! #instagram"
);

// Step 2: Publish media
const mediaId = await instagramService.publishMedia(creationId);

// Or use the complete flow in one call:
const result = await instagramService.postToInstagram(
  "https://example.com/image.jpg",
  "My caption here"
);
console.log(`Posted! Media ID: ${result.mediaId}`);
```

### Important Image Requirements

**Instagram API has strict image requirements:**

1. **Must be publicly accessible HTTPS URL**
   - Cannot use `http://` (must be `https://`)
   - Cannot use localhost or private IPs
   - Must be accessible without authentication

2. **Image specifications:**
   - File types: JPG, PNG
   - Aspect ratios: 4:5 (portrait), 1:1 (square), 1.91:1 (landscape)
   - Size: Between 320px and 1440px width
   - File size: Under 8MB

3. **For local development:**
   - Upload images to a public CDN (Vercel Blob, S3, Cloudinary)
   - Use ngrok or similar to expose local files temporarily
   - Use Supabase Storage with public buckets

### API Route Usage

**Endpoint:** `POST /api/instagram/post`

**Request:**
```json
{
  "announcement_id": 123,
  "image_url": "https://cdn.example.com/image.jpg",
  "caption": "Optional caption text"
}
```

**Response (Success):**
```json
{
  "success": true,
  "creation_id": "18123456789",
  "media_id": "18234567890",
  "message": "Successfully posted to Instagram",
  "announcement_id": 123
}
```

**Response (Error):**
```json
{
  "error": "Instagram API error: Image could not be downloaded (Code: 9004)",
  "details": "..."
}
```

## Error Handling

### Common Errors

**1. Invalid Image URL**
```json
{
  "error": "Instagram API error: Image could not be downloaded (Code: 9004)"
}
```
- **Cause:** URL is not publicly accessible or not HTTPS
- **Solution:** Ensure image is hosted on public HTTPS URL

**2. Invalid Access Token**
```json
{
  "error": "Instagram API error: Invalid OAuth 2.0 Access Token (Code: 190)"
}
```
- **Cause:** Token expired or invalid
- **Solution:** Generate new access token or use long-lived token

**3. Rate Limiting**
```json
{
  "error": "Instagram API error: Application request limit reached (Code: 4)"
}
```
- **Cause:** Too many API calls
- **Solution:** Implement rate limiting, spread out requests

**4. Permission Error**
```json
{
  "error": "Instagram API error: Missing permissions (Code: 200)"
}
```
- **Cause:** Access token doesn't have required permissions
- **Solution:** Re-authorize with `instagram_content_publish` permission

### Error Recovery

The service includes comprehensive error handling:

```typescript
try {
  const result = await instagramService.postToInstagram(imageUrl, caption);
} catch (error) {
  if (error instanceof InstagramAPIError) {
    console.error(`Instagram API error: ${error.message}`);
    console.error(`Status code: ${error.statusCode}`);
    console.error(`Response: ${error.response}`);
  }
}
```

## Testing

### Test Image Posting

```bash
curl -X POST http://localhost:3000/api/instagram/post \
  -H "Content-Type: application/json" \
  -d '{
    "announcement_id": 1,
    "image_url": "https://picsum.photos/1080/1080",
    "caption": "Test post from API"
  }'
```

### Verify Post on Instagram

After successful posting:
1. Check the response for `media_id`
2. View the post: `https://www.instagram.com/p/{MEDIA_CODE}/`
   - Convert media_id to media code using Instagram's Base64 variant
3. Or simply open Instagram and check your profile

## Best Practices

### 1. Image Hosting Strategy

**Recommended approach:**
```typescript
// Upload to Supabase Storage or Vercel Blob first
const { publicUrl } = await uploadImageToStorage(imageBuffer);

// Then post to Instagram
const result = await instagramService.postToInstagram(publicUrl, caption);
```

### 2. Caption Optimization

```typescript
// Instagram caption best practices
const caption = `
${announcement.announcement_text}

📍 ${event.location}
📅 ${event.date}

#event #announcement #instagram
`.trim();

// Instagram supports up to 2,200 characters
// Include relevant hashtags and emojis
// First 125 characters show without "more" click
```

### 3. Scheduling Posts

```typescript
// Instagram API doesn't support scheduled posts natively
// Implement scheduling in your application:

import { ScheduledPostService } from '@/lib/services/scheduled-post-service';

const scheduledPost = await scheduledPostService.schedulePost({
  platform: 'instagram',
  imageUrl: 'https://...',
  caption: 'My post',
  scheduledAt: new Date('2025-01-15T10:00:00Z')
});

// Use cron job to check and post scheduled content
```

### 4. Rate Limiting

Instagram API has rate limits:
- **Per user:** 200 calls per hour
- **Per app:** 4800 calls per hour
- Implement queuing for high-volume posting

### 5. Monitoring

```typescript
// Log all Instagram API calls for debugging
console.log('Instagram post attempt:', {
  imageUrl,
  captionLength: caption.length,
  timestamp: new Date().toISOString()
});

// Track success/failure metrics
// Monitor API quota usage in Facebook Developer Console
```

## Limitations

1. **No carousel posts:** API doesn't support multi-image posts
2. **No Stories:** Cannot post to Instagram Stories via API
3. **No Reels:** Cannot post Reels via API
4. **Business accounts only:** Cannot post to personal Instagram accounts
5. **No scheduled posts:** Must implement scheduling yourself
6. **Image must be public:** Cannot upload binary data directly

## Security Considerations

1. **Access Token Security:**
   - Store in environment variables, never in code
   - Use System User tokens for production (never expire)
   - Rotate tokens periodically
   - Monitor token usage for suspicious activity

2. **Input Validation:**
   - Always validate image URLs before posting
   - Sanitize captions to prevent injection
   - Check file sizes and types before uploading to storage

3. **Authentication:**
   - Verify user ownership of announcements
   - Implement proper Supabase RLS policies
   - Add rate limiting to prevent abuse

4. **Error Handling:**
   - Never expose access tokens in error messages
   - Log errors securely without sensitive data
   - Provide user-friendly error messages

## Troubleshooting

### "Image could not be downloaded"
- Verify URL is HTTPS and publicly accessible
- Test URL in browser incognito mode
- Check image meets size/format requirements
- Ensure CDN/storage has proper CORS settings

### "Invalid OAuth 2.0 Access Token"
- Generate new access token
- Verify token has correct permissions
- Check token hasn't expired
- Ensure using Page Access Token, not User Token

### "Missing permissions"
- Re-authorize app with correct permissions
- Check app is in Live mode (not Development)
- Verify Instagram account is Business account
- Confirm Page is connected to Instagram

### "Application request limit reached"
- Wait for rate limit to reset (1 hour)
- Implement request queuing
- Spread out posts over time
- Check for retry loops in code

## Resources

- [Instagram Graph API Documentation](https://developers.facebook.com/docs/instagram-api)
- [Publishing Content](https://developers.facebook.com/docs/instagram-api/guides/content-publishing)
- [Access Tokens](https://developers.facebook.com/docs/facebook-login/access-tokens)
- [Error Codes](https://developers.facebook.com/docs/graph-api/guides/error-handling)
- [Rate Limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting)

## Support

For issues with the Instagram integration:
1. Check the error message and code
2. Review Facebook Developer Console logs
3. Test with Graph API Explorer
4. Check Instagram API status page
5. Review app permissions and settings
