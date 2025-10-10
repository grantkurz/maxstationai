/**
 * Instagram API Service
 * Handles posting to Instagram using Facebook Graph API v21.0
 *
 * Reference: https://developers.facebook.com/docs/instagram-platform/reference/ig-user/media
 *
 * Authentication Flow:
 * 1. Create media container with image URL and optional caption
 * 2. Publish media container to Instagram
 *
 * Note: Instagram API requires images to be publicly accessible via HTTPS URL
 */

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_HOST = "https://graph.facebook.com";

/**
 * Custom error class for Instagram API errors
 */
export class InstagramAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: string
  ) {
    super(message);
    this.name = "InstagramAPIError";
  }
}

/**
 * Response from media container creation endpoint
 */
interface CreateContainerResponse {
  id: string; // Container ID
}

/**
 * Response from media publish endpoint
 */
interface PublishMediaResponse {
  id: string; // Media ID (Instagram post ID)
}

/**
 * Instagram error response structure
 */
interface InstagramErrorResponse {
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Instagram Service for posting images to Instagram
 */
export class InstagramService {
  private accessToken: string;
  private igUserId: string;

  constructor() {
    // Load credentials from environment variables
    // Support both INSTAGRAM_ACCESS_TOKEN and FB_PAGE_ACCESS_TOKEN for flexibility
    this.accessToken =
      process.env.INSTAGRAM_ACCESS_TOKEN?.trim() ||
      process.env.FB_PAGE_ACCESS_TOKEN?.trim() ||
      "";
    this.igUserId = process.env.INSTAGRAM_USER_ID?.trim() || "";

    // Validate required credentials
    if (!this.igUserId) {
      throw new Error(
        "INSTAGRAM_USER_ID environment variable is required."
      );
    }

    if (!this.accessToken) {
      throw new Error(
        "INSTAGRAM_ACCESS_TOKEN (or FB_PAGE_ACCESS_TOKEN) environment variable is required."
      );
    }
  }

  /**
   * Make a POST request to Facebook Graph API
   * @private
   * @param path - API endpoint path (e.g., "/123456/media")
   * @param data - Request data to send
   * @returns Parsed JSON response
   * @throws InstagramAPIError if request fails
   */
  private async graphPost<T>(
    path: string,
    data: Record<string, string>
  ): Promise<T> {
    const url = `${GRAPH_API_HOST}/${GRAPH_API_VERSION}${path}`;

    // Build URL-encoded form data with access token
    const formData = new URLSearchParams({
      ...data,
      access_token: this.accessToken,
    });

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const responseText = await response.text();

      if (!response.ok) {
        // Try to parse error response
        let errorMessage = `Instagram API error: ${response.statusText}`;
        try {
          const errorData = JSON.parse(responseText) as InstagramErrorResponse;
          if (errorData.error) {
            errorMessage = `Instagram API error: ${errorData.error.message} (Code: ${errorData.error.code})`;
          }
        } catch {
          errorMessage = `Instagram API error: ${responseText}`;
        }

        throw new InstagramAPIError(
          errorMessage,
          response.status,
          responseText
        );
      }

      // Parse successful response
      const responseData = JSON.parse(responseText) as T;
      return responseData;
    } catch (error) {
      if (error instanceof InstagramAPIError) {
        throw error;
      }
      throw new InstagramAPIError(
        `Failed to make Graph API request: ${error instanceof Error ? error.message : "Unknown error"}`,
        500
      );
    }
  }

  /**
   * Step 1: Create a media container on Instagram
   * Reserves a container for the image and caption
   *
   * @param imageUrl - Publicly accessible HTTPS URL of the image
   * @param caption - Optional caption text for the post
   * @returns Container ID (creation_id)
   * @throws InstagramAPIError if container creation fails
   *
   * @example
   * const containerId = await instagramService.createMediaContainer(
   *   "https://example.com/image.jpg",
   *   "Check out this post!"
   * );
   */
  async createMediaContainer(
    imageUrl: string,
    caption?: string
  ): Promise<string> {
    // Validate image URL
    if (!imageUrl || !imageUrl.trim()) {
      throw new InstagramAPIError(
        "Image URL cannot be empty",
        400
      );
    }

    // Ensure URL is HTTPS (Instagram requirement)
    if (!imageUrl.toLowerCase().startsWith("https://")) {
      throw new InstagramAPIError(
        "Image URL must use HTTPS protocol",
        400
      );
    }

    const path = `/${this.igUserId}/media`;
    const data: Record<string, string> = {
      image_url: imageUrl,
    };

    // Add caption if provided
    if (caption && caption.trim()) {
      data.caption = caption.trim();
    }

    try {
      console.log("Creating Instagram media container...");
      const response = await this.graphPost<CreateContainerResponse>(
        path,
        data
      );

      if (!response.id) {
        throw new InstagramAPIError(
          "No container ID returned from Instagram API",
          500,
          JSON.stringify(response)
        );
      }

      console.log(`Media container created successfully: ${response.id}`);
      return response.id;
    } catch (error) {
      if (error instanceof InstagramAPIError) {
        throw error;
      }
      throw new InstagramAPIError(
        `Failed to create media container: ${error instanceof Error ? error.message : "Unknown error"}`,
        500
      );
    }
  }

  /**
   * Step 2: Publish a media container to Instagram
   * Publishes the previously created container as an Instagram post
   *
   * @param creationId - Container ID from createMediaContainer
   * @returns Instagram media ID (post ID)
   * @throws InstagramAPIError if publishing fails
   *
   * @example
   * const mediaId = await instagramService.publishMedia(containerId);
   */
  async publishMedia(creationId: string): Promise<string> {
    // Validate creation ID
    if (!creationId || !creationId.trim()) {
      throw new InstagramAPIError(
        "Creation ID cannot be empty",
        400
      );
    }

    const path = `/${this.igUserId}/media_publish`;
    const data = {
      creation_id: creationId.trim(),
    };

    try {
      console.log(`Publishing Instagram media container: ${creationId}...`);
      const response = await this.graphPost<PublishMediaResponse>(
        path,
        data
      );

      if (!response.id) {
        throw new InstagramAPIError(
          "No media ID returned from Instagram API",
          500,
          JSON.stringify(response)
        );
      }

      console.log(`Media published successfully: ${response.id}`);
      return response.id;
    } catch (error) {
      if (error instanceof InstagramAPIError) {
        throw error;
      }
      throw new InstagramAPIError(
        `Failed to publish media: ${error instanceof Error ? error.message : "Unknown error"}`,
        500
      );
    }
  }

  /**
   * Complete flow: Post an image to Instagram with optional caption
   * Combines container creation and publishing in a single operation
   *
   * @param imageUrl - Publicly accessible HTTPS URL of the image
   * @param caption - Optional caption text for the post
   * @returns Object containing container ID and published media ID
   * @throws InstagramAPIError if any step fails
   *
   * @example
   * const result = await instagramService.postToInstagram(
   *   "https://example.com/image.jpg",
   *   "Check out this amazing post!"
   * );
   * console.log(`Posted to Instagram: ${result.mediaId}`);
   */
  async postToInstagram(
    imageUrl: string,
    caption?: string
  ): Promise<{ creationId: string; mediaId: string }> {
    // Validate inputs
    if (!imageUrl || !imageUrl.trim()) {
      throw new InstagramAPIError("Image URL cannot be empty", 400);
    }

    try {
      // Step 1: Create media container
      console.log("Starting Instagram post workflow...");
      const creationId = await this.createMediaContainer(imageUrl, caption);

      // Step 2: Publish media
      const mediaId = await this.publishMedia(creationId);

      console.log(
        `Instagram post completed successfully. Media ID: ${mediaId}`
      );

      return {
        creationId,
        mediaId,
      };
    } catch (error) {
      if (error instanceof InstagramAPIError) {
        throw error;
      }
      throw new InstagramAPIError(
        `Failed to post to Instagram: ${error instanceof Error ? error.message : "Unknown error"}`,
        500
      );
    }
  }
}
