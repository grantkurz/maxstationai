/**
 * Instagram Service - Usage Examples
 *
 * This file demonstrates how to use the InstagramService to post images to Instagram.
 * These examples show different patterns for common use cases.
 */

import { InstagramService, InstagramAPIError } from './instagram-service';

/**
 * Example 1: Basic Image Post with Caption
 *
 * This is the most common use case - posting a single image with a caption.
 */
async function basicImagePost() {
  try {
    const instagramService = new InstagramService();

    const result = await instagramService.postToInstagram(
      'https://example.com/images/event-poster.jpg',
      'Join us for our amazing event! 🎉 #event #announcement'
    );

    console.log('Successfully posted to Instagram!');
    console.log('Container ID:', result.creationId);
    console.log('Media ID:', result.mediaId);

  } catch (error) {
    if (error instanceof InstagramAPIError) {
      console.error('Instagram API Error:', error.message);
      console.error('Status Code:', error.statusCode);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

/**
 * Example 2: Two-Step Posting (Advanced)
 *
 * For use cases where you need more control over the posting flow,
 * you can manually call each step of the process.
 */
async function twoStepPosting() {
  try {
    const instagramService = new InstagramService();

    // Step 1: Create media container
    console.log('Creating media container...');
    const creationId = await instagramService.createMediaContainer(
      'https://example.com/images/announcement.jpg',
      'Check out our latest announcement!'
    );

    console.log('Container created:', creationId);

    // At this point, you could:
    // - Save the creationId to database
    // - Perform additional validation
    // - Schedule the publish for later

    // Step 2: Publish media
    console.log('Publishing media...');
    const mediaId = await instagramService.publishMedia(creationId);

    console.log('Media published:', mediaId);

  } catch (error) {
    if (error instanceof InstagramAPIError) {
      console.error('Instagram API Error:', error.message);
    }
  }
}

/**
 * Example 3: Posting from Announcement System
 *
 * Integration with the announcement repository pattern.
 */
async function postAnnouncementToInstagram(
  announcementId: number,
  imageUrl: string
) {
  try {
    // Assuming you have announcement data
    const announcement = {
      id: announcementId,
      announcement_text: 'Exciting news everyone!',
      platform: 'instagram',
    };

    const instagramService = new InstagramService();

    const result = await instagramService.postToInstagram(
      imageUrl,
      announcement.announcement_text
    );

    console.log(`Announcement ${announcementId} posted to Instagram`);
    console.log(`Media ID: ${result.mediaId}`);

    // Update announcement record with media ID
    // await updateAnnouncement(announcementId, {
    //   instagram_media_id: result.mediaId,
    //   posted_at: new Date()
    // });

    return result;

  } catch (error) {
    if (error instanceof InstagramAPIError) {
      // Log error to your monitoring service
      console.error('Failed to post announcement:', {
        announcementId,
        error: error.message,
        statusCode: error.statusCode,
      });
    }
    throw error;
  }
}

/**
 * Example 4: Using with Vercel Blob Storage
 *
 * Complete flow: upload image to Vercel Blob, then post to Instagram.
 */
async function postWithBlobStorage(
  imageBuffer: Buffer,
  filename: string,
  caption: string
) {
  try {
    // First, upload to Vercel Blob (or any public storage)
    // import { put } from '@vercel/blob';

    // const blob = await put(`instagram/${filename}`, imageBuffer, {
    //   access: 'public',
    //   contentType: 'image/jpeg',
    // });

    // For this example, assume we have the URL
    const publicImageUrl = 'https://your-blob-storage.com/image.jpg';

    // Now post to Instagram
    const instagramService = new InstagramService();
    const result = await instagramService.postToInstagram(
      publicImageUrl,
      caption
    );

    console.log('Posted to Instagram:', result.mediaId);

    return result;

  } catch (error) {
    console.error('Error in upload/post flow:', error);
    throw error;
  }
}

/**
 * Example 5: Using with Supabase Storage
 *
 * Upload image to Supabase Storage bucket, then post to Instagram.
 */
async function postWithSupabaseStorage(
  imageBuffer: Buffer,
  filename: string,
  caption: string
) {
  try {
    // Upload to Supabase Storage
    // import { createClient } from '@supabase/supabase-js';
    //
    // const supabase = createClient(
    //   process.env.NEXT_PUBLIC_SUPABASE_URL!,
    //   process.env.SUPABASE_SERVICE_ROLE_KEY!
    // );
    //
    // const { data, error } = await supabase
    //   .storage
    //   .from('instagram-images')
    //   .upload(`public/${filename}`, imageBuffer, {
    //     contentType: 'image/jpeg',
    //     upsert: false
    //   });
    //
    // if (error) throw error;
    //
    // const { data: { publicUrl } } = supabase
    //   .storage
    //   .from('instagram-images')
    //   .getPublicUrl(`public/${filename}`);

    // For this example, assume we have the URL
    const publicImageUrl = 'https://your-supabase-project.supabase.co/storage/v1/object/public/instagram-images/image.jpg';

    // Post to Instagram
    const instagramService = new InstagramService();
    const result = await instagramService.postToInstagram(
      publicImageUrl,
      caption
    );

    console.log('Posted to Instagram:', result.mediaId);

    return result;

  } catch (error) {
    console.error('Error in Supabase storage flow:', error);
    throw error;
  }
}

/**
 * Example 6: Error Handling Patterns
 *
 * Demonstrates comprehensive error handling for production use.
 */
async function robustPostWithRetry(
  imageUrl: string,
  caption: string,
  maxRetries = 3
) {
  const instagramService = new InstagramService();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt} of ${maxRetries}...`);

      const result = await instagramService.postToInstagram(imageUrl, caption);

      console.log('Success!', result);
      return result;

    } catch (error) {
      lastError = error as Error;

      if (error instanceof InstagramAPIError) {
        // Check if error is retryable
        const retryableStatusCodes = [408, 429, 500, 502, 503, 504];

        if (!retryableStatusCodes.includes(error.statusCode)) {
          // Not retryable, throw immediately
          console.error('Non-retryable error:', error.message);
          throw error;
        }

        // Wait before retry (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));

      } else {
        // Unknown error, don't retry
        throw error;
      }
    }
  }

  // All retries exhausted
  throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Example 7: Batch Posting with Rate Limiting
 *
 * Post multiple images while respecting Instagram's rate limits.
 */
async function batchPostWithRateLimit(
  posts: Array<{ imageUrl: string; caption: string }>
) {
  const instagramService = new InstagramService();
  const results: Array<{ success: boolean; mediaId?: string; error?: string }> = [];

  // Instagram allows ~200 requests per hour per user
  // Space out posts to avoid rate limiting
  const delayBetweenPosts = 30000; // 30 seconds between posts

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];

    try {
      console.log(`Posting ${i + 1} of ${posts.length}...`);

      const result = await instagramService.postToInstagram(
        post.imageUrl,
        post.caption
      );

      results.push({
        success: true,
        mediaId: result.mediaId,
      });

      console.log(`Posted successfully: ${result.mediaId}`);

      // Wait before next post (unless this is the last one)
      if (i < posts.length - 1) {
        console.log(`Waiting ${delayBetweenPosts / 1000}s before next post...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenPosts));
      }

    } catch (error) {
      console.error(`Failed to post ${i + 1}:`, error);

      results.push({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Continue with next post even if one fails
    }
  }

  // Summary
  const successful = results.filter(r => r.success).length;
  console.log(`\nBatch complete: ${successful}/${posts.length} posts succeeded`);

  return results;
}

/**
 * Example 8: API Route Pattern (Next.js)
 *
 * This shows the complete pattern used in the API route handler.
 */
async function apiRouteHandler(
  announcementId: number,
  imageUrl: string,
  userId: string
) {
  try {
    // 1. Validate inputs
    if (!imageUrl.startsWith('https://')) {
      throw new Error('Image URL must be HTTPS');
    }

    // 2. Fetch and validate announcement
    // const announcement = await getAnnouncement(announcementId);
    // if (announcement.user_id !== userId) {
    //   throw new Error('Unauthorized');
    // }

    // 3. Post to Instagram
    const instagramService = new InstagramService();
    const result = await instagramService.postToInstagram(
      imageUrl,
      'Sample caption' // or announcement.announcement_text
    );

    // 4. Return success response
    return {
      success: true,
      creation_id: result.creationId,
      media_id: result.mediaId,
      message: 'Successfully posted to Instagram',
    };

  } catch (error) {
    // Handle and format errors
    if (error instanceof InstagramAPIError) {
      return {
        success: false,
        error: error.message,
        statusCode: error.statusCode,
      };
    }

    return {
      success: false,
      error: 'Internal server error',
      statusCode: 500,
    };
  }
}

// Export examples for testing
export {
  basicImagePost,
  twoStepPosting,
  postAnnouncementToInstagram,
  postWithBlobStorage,
  postWithSupabaseStorage,
  robustPostWithRetry,
  batchPostWithRateLimit,
  apiRouteHandler,
};
