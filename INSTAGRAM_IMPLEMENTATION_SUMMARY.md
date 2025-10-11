# Instagram Integration Implementation Summary

This document summarizes the Instagram posting functionality that has been added to your Next.js application.

## Overview

The Instagram integration has been successfully converted from the Python FastAPI implementation to Next.js/TypeScript, following the existing LinkedIn service pattern. It uses Facebook Graph API v21.0 to post images with captions to Instagram Business accounts.

## Files Created

### 1. Service Layer
**File:** `/Users/grant/code/auth-test/otp-flow/lib/services/instagram-service.ts`

- **Class:** `InstagramService`
  - Handles all Instagram API interactions
  - Implements 2-step posting flow (create container → publish)
  - Comprehensive error handling with `InstagramAPIError` class

- **Key Methods:**
  - `createMediaContainer(imageUrl, caption?)` - Creates media container
  - `publishMedia(creationId)` - Publishes media to Instagram
  - `postToInstagram(imageUrl, caption?)` - Complete posting flow

- **Features:**
  - Environment variable validation on initialization
  - Native fetch API (no external HTTP libraries)
  - Detailed error messages from Instagram API
  - TypeScript strict typing for all responses

### 2. API Route
**File:** `/Users/grant/code/auth-test/otp-flow/app/api/instagram/post/route.ts`

- **Endpoint:** `POST /api/instagram/post`
- **Authentication:** Supabase auth (validates user ownership)
- **Request Body:**
  ```json
  {
    "announcement_id": 123,
    "image_url": "https://example.com/image.jpg",
    "caption": "Optional caption"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "creation_id": "18123456789",
    "media_id": "18234567890",
    "message": "Successfully posted to Instagram",
    "announcement_id": 123
  }
  ```

### 3. Documentation
**File:** `/Users/grant/code/auth-test/otp-flow/lib/services/INSTAGRAM_INTEGRATION.md`

Comprehensive 400+ line guide covering:
- Setup instructions (Facebook App, Instagram Business Account)
- How to obtain Instagram User ID and Access Tokens
- API usage examples
- Image requirements and limitations
- Error handling and troubleshooting
- Best practices for production deployment
- Security considerations

### 4. Usage Examples
**File:** `/Users/grant/code/auth-test/otp-flow/lib/services/INSTAGRAM_USAGE_EXAMPLE.ts`

8 practical examples demonstrating:
1. Basic image posting
2. Two-step posting (advanced control)
3. Integration with announcement system
4. Using with Vercel Blob storage
5. Using with Supabase storage
6. Robust error handling with retry logic
7. Batch posting with rate limiting
8. Complete API route pattern

### 5. Environment Configuration
**File:** `/Users/grant/code/auth-test/otp-flow/.env.local.example`

Added Instagram configuration section:
```bash
INSTAGRAM_USER_ID=your-instagram-user-id
INSTAGRAM_ACCESS_TOKEN=your-page-access-token
# Alternative: FB_PAGE_ACCESS_TOKEN=your-page-access-token
```

## Architecture

The implementation follows clean architecture principles with clear separation of concerns:

```
┌─────────────────────────────────────────┐
│       Client Application                │
│  (Frontend / API Consumer)              │
└─────────────┬───────────────────────────┘
              │ HTTP POST
┌─────────────▼───────────────────────────┐
│     API Route Layer                     │
│  app/api/instagram/post/route.ts        │
│  - Supabase Authentication              │
│  - Request Validation                   │
│  - Announcement Ownership Check         │
│  - Error Response Formatting            │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│     Service Layer                       │
│  lib/services/instagram-service.ts      │
│  - Business Logic                       │
│  - API Communication                    │
│  - Error Handling                       │
│  - 2-Step Posting Flow                  │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│  Repository Layer (Existing)            │
│  lib/repositories/announcement-         │
│  repository.ts                          │
│  - Database Operations                  │
│  - Data Access                          │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│     Supabase Database                   │
│  - announcements table                  │
│  - Row Level Security                   │
└─────────────────────────────────────────┘

              │
┌─────────────▼───────────────────────────┐
│   Instagram Graph API v21.0             │
│  https://graph.facebook.com/v21.0       │
└─────────────────────────────────────────┘
```

## Key Differences from Python Implementation

### 1. **Service Class Pattern**
- **Python:** Standalone functions with router
- **Next.js:** Class-based service with instance methods
- **Benefit:** Better encapsulation, testability, and state management

### 2. **Error Handling**
- **Python:** HTTPException with status codes
- **Next.js:** Custom `InstagramAPIError` class with detailed context
- **Benefit:** Type-safe errors, better debugging information

### 3. **Authentication**
- **Python:** Direct API call without auth
- **Next.js:** Supabase authentication + announcement ownership validation
- **Benefit:** Secure, multi-tenant support, proper authorization

### 4. **Environment Variables**
- **Python:** `IG_USER_ID`, `FB_PAGE_ACCESS_TOKEN`
- **Next.js:** `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN` (or `FB_PAGE_ACCESS_TOKEN`)
- **Benefit:** Clearer naming, supports both naming conventions

### 5. **Response Format**
- **Python:** JSONResponse
- **Next.js:** NextResponse with consistent error structure
- **Benefit:** Better Next.js integration, consistent API responses

## Environment Variables Required

```bash
# Required
INSTAGRAM_USER_ID=17841400123456789          # Instagram Business Account ID
INSTAGRAM_ACCESS_TOKEN=EAABwzLix...         # Facebook Page Access Token

# Optional (alternative name for access token)
FB_PAGE_ACCESS_TOKEN=EAABwzLix...           # Same as INSTAGRAM_ACCESS_TOKEN

# Existing (for authentication)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Setup Steps

### 1. Get Instagram Credentials

```bash
# Get Facebook Page ID
curl "https://graph.facebook.com/v21.0/me/accounts?access_token=YOUR_TOKEN"

# Get Instagram User ID from Page
curl "https://graph.facebook.com/v21.0/{PAGE_ID}?fields=instagram_business_account&access_token=YOUR_TOKEN"
```

### 2. Configure Environment

Add to `.env.local`:
```bash
INSTAGRAM_USER_ID=your-instagram-user-id
INSTAGRAM_ACCESS_TOKEN=your-page-access-token
```

### 3. Test the Integration

```bash
curl -X POST http://localhost:3000/api/instagram/post \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -d '{
    "announcement_id": 1,
    "image_url": "https://picsum.photos/1080/1080",
    "caption": "Test post from API"
  }'
```

## Instagram API Requirements

### Image Requirements
- **Protocol:** HTTPS only (not HTTP)
- **Accessibility:** Publicly accessible without authentication
- **Format:** JPG or PNG
- **Aspect Ratio:** 4:5, 1:1, or 1.91:1
- **Size:** 320px - 1440px width, under 8MB

### Account Requirements
- Instagram **Business Account** (not personal)
- Connected to a Facebook **Page**
- Page Access Token with permissions:
  - `instagram_basic`
  - `instagram_content_publish`

### Rate Limits
- 200 calls per hour per user
- 4800 calls per hour per app

## Integration with Existing System

The Instagram service integrates seamlessly with your existing announcement system:

```typescript
// 1. User creates announcement in frontend
// 2. Announcement saved to Supabase with platform='instagram'
// 3. When ready to post:

const result = await fetch('/api/instagram/post', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    announcement_id: announcement.id,
    image_url: 'https://your-cdn.com/image.jpg',
    caption: announcement.announcement_text,
  }),
});

const data = await result.json();
console.log('Posted to Instagram:', data.media_id);
```

## Security Features

### 1. **Authentication & Authorization**
- Validates user session with Supabase
- Checks announcement ownership before posting
- Prevents cross-user unauthorized access

### 2. **Input Validation**
- Validates image URL is HTTPS
- Checks announcement platform is 'instagram'
- Sanitizes all user inputs

### 3. **Credential Security**
- Access tokens stored in environment variables
- Never exposed in error messages or logs
- Service validates credentials on initialization

### 4. **Error Handling**
- Detailed errors for debugging (server-side)
- User-friendly messages (client-side)
- Prevents information leakage

## Testing Checklist

- [ ] Environment variables configured
- [ ] Instagram User ID is correct (numeric ID, not @username)
- [ ] Access token has correct permissions
- [ ] Image URL is publicly accessible HTTPS
- [ ] Image meets size/format requirements
- [ ] User is authenticated with Supabase
- [ ] Announcement belongs to authenticated user
- [ ] Announcement platform is 'instagram'

## Common Issues & Solutions

### "Image could not be downloaded"
- **Issue:** Instagram cannot access the image
- **Solution:** Ensure image is on public HTTPS URL, not localhost

### "Invalid OAuth 2.0 Access Token"
- **Issue:** Token expired or invalid
- **Solution:** Generate new long-lived token or use System User token

### "Missing permissions"
- **Issue:** Token lacks required permissions
- **Solution:** Re-authorize with `instagram_content_publish` permission

### "Announcement not configured for Instagram"
- **Issue:** Announcement platform field is not 'instagram'
- **Solution:** Update announcement platform in database

## Next Steps

### Recommended Enhancements

1. **Image Upload Integration**
   ```typescript
   // Add endpoint to upload image to Vercel Blob/Supabase Storage
   // Then post to Instagram with the public URL
   ```

2. **Scheduled Posting**
   ```typescript
   // Integrate with existing scheduled-post-service
   // Add Instagram support to cron job
   ```

3. **Post Analytics**
   ```typescript
   // Save media_id to database
   // Create endpoint to fetch Instagram Insights
   // Show engagement metrics in dashboard
   ```

4. **Multi-Image Carousels**
   ```typescript
   // Instagram API supports carousels
   // Extend service to handle multiple images
   ```

5. **Caption Templates**
   ```typescript
   // Pre-defined caption templates with variables
   // Hashtag suggestions based on content
   ```

## Production Deployment

### Environment Variables (Vercel/Production)

```bash
# Add to Vercel project settings or .env.production
INSTAGRAM_USER_ID=production-instagram-user-id
INSTAGRAM_ACCESS_TOKEN=production-access-token
```

### Monitoring

Consider adding:
- Error tracking (Sentry, etc.)
- API usage monitoring
- Rate limit tracking
- Success/failure metrics

### Access Token Management

For production, use **System User Tokens** (never expire):
1. Create System User in Facebook Business Manager
2. Assign to your app
3. Generate token with required permissions
4. Store securely in environment variables

## Resources

- [Instagram Graph API Docs](https://developers.facebook.com/docs/instagram-api)
- [Content Publishing Guide](https://developers.facebook.com/docs/instagram-api/guides/content-publishing)
- [Error Reference](https://developers.facebook.com/docs/graph-api/guides/error-handling)
- [Rate Limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting)

## Support

For issues:
1. Check error message and code
2. Review Instagram API status
3. Test with Graph API Explorer
4. Verify permissions and credentials
5. Check comprehensive documentation in `INSTAGRAM_INTEGRATION.md`

---

**Implementation Date:** October 9, 2025
**API Version:** Facebook Graph API v21.0
**Pattern Source:** Converted from Python FastAPI + adapted from LinkedIn service
**Status:** ✅ Ready for testing and deployment
