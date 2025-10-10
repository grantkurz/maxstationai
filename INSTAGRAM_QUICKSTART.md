# Instagram Integration - Quick Start Guide

Get started with Instagram posting in 5 minutes.

## Step 1: Get Your Instagram Credentials

### A. Get Your Instagram User ID

Open your terminal and run:

```bash
# Replace YOUR_ACCESS_TOKEN with your Facebook Page Access Token
curl "https://graph.facebook.com/v21.0/me/accounts?access_token=YOUR_ACCESS_TOKEN"
```

This returns your Facebook Pages. Copy the `id` of the page connected to Instagram:

```json
{
  "data": [
    {
      "id": "1234567890",  <- Copy this Page ID
      "name": "Your Page Name"
    }
  ]
}
```

Now get the Instagram Business Account ID:

```bash
# Replace {PAGE_ID} with the ID from above
curl "https://graph.facebook.com/v21.0/{PAGE_ID}?fields=instagram_business_account&access_token=YOUR_ACCESS_TOKEN"
```

Response:

```json
{
  "instagram_business_account": {
    "id": "17841400123456789"  <- This is your INSTAGRAM_USER_ID
  }
}
```

### B. Get Your Access Token

**Quick Option (Short-lived token for testing):**
1. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app
3. Click "Get Token" → "Get Page Access Token"
4. Grant permissions: `instagram_basic`, `instagram_content_publish`
5. Copy the token (expires in ~1 hour)

**Production Option (Long-lived token):**

```bash
# Exchange short-lived token for 60-day token
curl "https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=SHORT_LIVED_TOKEN"
```

## Step 2: Configure Environment Variables

Add to your `.env.local` file:

```bash
# Instagram API Configuration
INSTAGRAM_USER_ID=17841400123456789
INSTAGRAM_ACCESS_TOKEN=EAABwzLixnjYBO...  # Your Page Access Token
```

Restart your Next.js dev server:

```bash
npm run dev
```

## Step 3: Prepare Your Image

Instagram requires images to be publicly accessible via HTTPS. You have a few options:

### Option A: Use a Public CDN
```bash
# Upload to Vercel Blob, Cloudinary, S3, etc.
# Example: https://your-cdn.com/images/post.jpg
```

### Option B: Use Supabase Storage
```typescript
// Create a public bucket in Supabase Storage
// Upload image and get public URL
const { data } = await supabase
  .storage
  .from('instagram-images')
  .upload('public/image.jpg', file);

const { data: { publicUrl } } = supabase
  .storage
  .from('instagram-images')
  .getPublicUrl('public/image.jpg');
```

### Option C: Use an Existing Public Image
```bash
# For testing, use a public image URL like:
https://picsum.photos/1080/1080
```

## Step 4: Create an Announcement

First, ensure you have an announcement in your database with `platform='instagram'`:

```sql
-- Example: Insert test announcement via Supabase SQL Editor
INSERT INTO announcements (
  announcement_text,
  character_count,
  platform,
  event_id,
  speaker_id,
  template,
  user_id
) VALUES (
  'Exciting news from our event! Check out this amazing moment. #event #instagram',
  80,
  'instagram',
  1,  -- Your event ID
  1,  -- Your speaker ID
  'default',
  'your-user-id'  -- Your Supabase user ID
);
```

Get the announcement ID from the response.

## Step 5: Post to Instagram

### Using the API Route

```bash
# Get your Supabase auth token first
# (From browser DevTools → Application → Cookies → sb-*-auth-token)

curl -X POST http://localhost:3000/api/instagram/post \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-xxx-auth-token=YOUR_TOKEN" \
  -d '{
    "announcement_id": 1,
    "image_url": "https://picsum.photos/1080/1080",
    "caption": "Test post from Next.js API!"
  }'
```

### Using JavaScript/TypeScript

```typescript
// In your frontend or API route
const response = await fetch('/api/instagram/post', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    announcement_id: 1,
    image_url: 'https://your-cdn.com/image.jpg',
    caption: 'My awesome post!',
  }),
});

const data = await response.json();

if (data.success) {
  console.log('Posted to Instagram!');
  console.log('Media ID:', data.media_id);
} else {
  console.error('Failed:', data.error);
}
```

### Using the Service Directly

```typescript
import { InstagramService } from '@/lib/services/instagram-service';

const instagramService = new InstagramService();

const result = await instagramService.postToInstagram(
  'https://your-cdn.com/image.jpg',
  'My awesome Instagram post! #hashtag'
);

console.log('Media ID:', result.mediaId);
console.log('Container ID:', result.creationId);
```

## Step 6: Verify on Instagram

1. Open Instagram app or web
2. Go to your profile
3. You should see your new post!

## Troubleshooting

### "Environment variable is required"
- Check your `.env.local` has `INSTAGRAM_USER_ID` and `INSTAGRAM_ACCESS_TOKEN`
- Restart your dev server after adding env variables

### "Image could not be downloaded"
- Ensure image URL starts with `https://` (not `http://`)
- Verify image is publicly accessible (open in incognito browser)
- Check image is not behind authentication

### "Invalid OAuth 2.0 Access Token"
- Token expired - generate a new one
- Token doesn't have required permissions - re-authorize with `instagram_content_publish`

### "Unauthorized"
- You're not authenticated with Supabase
- The announcement doesn't belong to your user

### "This announcement is not configured for Instagram"
- The announcement's `platform` field must be `'instagram'`
- Update in database: `UPDATE announcements SET platform='instagram' WHERE id=1;`

## Testing Checklist

Before posting to Instagram, verify:

- [ ] `INSTAGRAM_USER_ID` is set in `.env.local`
- [ ] `INSTAGRAM_ACCESS_TOKEN` is set in `.env.local`
- [ ] Dev server restarted after adding env variables
- [ ] Image URL is HTTPS and publicly accessible
- [ ] You're authenticated with Supabase
- [ ] Announcement exists and belongs to you
- [ ] Announcement `platform` is `'instagram'`

## What's Next?

### Integrate with Your Frontend

```typescript
// Example: Post announcement button
async function handlePostToInstagram(announcementId: number, imageUrl: string) {
  try {
    const response = await fetch('/api/instagram/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        announcement_id: announcementId,
        image_url: imageUrl,
        caption: 'Custom caption here',
      }),
    });

    const data = await response.json();

    if (data.success) {
      toast.success('Posted to Instagram!');
    } else {
      toast.error(data.error);
    }
  } catch (error) {
    toast.error('Failed to post');
  }
}
```

### Add Image Upload

```typescript
// Upload to Vercel Blob
import { put } from '@vercel/blob';

const blob = await put(`instagram/${file.name}`, file, {
  access: 'public',
});

// Then post to Instagram
await fetch('/api/instagram/post', {
  method: 'POST',
  body: JSON.stringify({
    announcement_id: announcementId,
    image_url: blob.url,
  }),
});
```

### Schedule Posts

```typescript
// Use your existing scheduled-post-service
import { ScheduledPostService } from '@/lib/services/scheduled-post-service';

await scheduledPostService.schedulePost({
  platform: 'instagram',
  announcement_id: 1,
  image_url: 'https://...',
  scheduled_at: new Date('2025-01-15T10:00:00Z'),
});
```

## Need More Help?

- **Detailed Setup:** See `lib/services/INSTAGRAM_INTEGRATION.md`
- **Usage Examples:** See `lib/services/INSTAGRAM_USAGE_EXAMPLE.ts`
- **API Reference:** See `lib/services/instagram-service.ts`
- **Complete Summary:** See `INSTAGRAM_IMPLEMENTATION_SUMMARY.md`

## Common Patterns

### Pattern 1: Upload → Post
```typescript
// 1. Upload image to storage
const { url } = await uploadToStorage(file);

// 2. Post to Instagram
await postToInstagram(announcementId, url);
```

### Pattern 2: Create → Review → Post
```typescript
// 1. Create media container (can be reviewed)
const creationId = await instagramService.createMediaContainer(url, caption);

// 2. User reviews in frontend
// 3. Publish when ready
const mediaId = await instagramService.publishMedia(creationId);
```

### Pattern 3: Batch Post with Delay
```typescript
for (const announcement of announcements) {
  await postToInstagram(announcement.id, announcement.imageUrl);
  await sleep(30000); // Wait 30s between posts
}
```

---

**Ready to post to Instagram!** 🎉

If you encounter any issues, check the detailed documentation in `INSTAGRAM_INTEGRATION.md`.
