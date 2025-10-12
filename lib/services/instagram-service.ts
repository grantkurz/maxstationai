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
 * Response from container status check
 */
interface ContainerStatusResponse {
  status_code: string; // IN_PROGRESS, FINISHED, ERROR, EXPIRED
  status?: string; // Additional status info
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
  private appId: string;
  private appSecret: string;

  constructor() {
    // Load credentials from environment variables
    // Support multiple naming conventions for flexibility
    this.accessToken =
      process.env.INSTAGRAM_ACCESS_TOKEN?.trim() ||
      process.env.FB_PAGE_ACCESS_TOKEN?.trim() ||
      "";
    this.igUserId =
      process.env.INSTAGRAM_USER_ID?.trim() ||
      process.env.IG_USER_ID?.trim() ||
      "";
    this.appId =
      process.env.IG_APP_ID?.trim() ||
      process.env.INSTAGRAM_APP_ID?.trim() ||
      "";
    this.appSecret =
      process.env.IG_APP_SECRET?.trim() ||
      process.env.INSTAGRAM_APP_SECRET?.trim() ||
      "";

    // Validate required credentials
    if (!this.igUserId) {
      throw new Error(
        "IG_USER_ID (or INSTAGRAM_USER_ID) environment variable is required."
      );
    }

    if (!this.accessToken) {
      throw new Error(
        "FB_PAGE_ACCESS_TOKEN (or INSTAGRAM_ACCESS_TOKEN) environment variable is required."
      );
    }

    if (!this.appId || !this.appSecret) {
      console.warn(
        "IG_APP_ID and IG_APP_SECRET not found. Token refresh will not be available."
      );
    }
  }

  /**
   * Exchange a short-lived token for a long-lived token (60 days)
   * @private
   * @param shortLivedToken - The short-lived access token
   * @returns Long-lived access token
   */
  private async exchangeForLongLivedToken(
    shortLivedToken: string
  ): Promise<string> {
    if (!this.appId || !this.appSecret) {
      throw new Error(
        "IG_APP_ID and IG_APP_SECRET are required for token exchange"
      );
    }

    const url = `${GRAPH_API_HOST}/${GRAPH_API_VERSION}/oauth/access_token`;
    const params = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: shortLivedToken,
    });

    try {
      const response = await fetch(`${url}?${params.toString()}`);
      const data = await response.json();

      if (!response.ok || !data.access_token) {
        throw new Error(
          `Token exchange failed: ${data.error?.message || "Unknown error"}`
        );
      }

      console.log("Successfully exchanged for long-lived token");
      return data.access_token;
    } catch (error) {
      throw new Error(
        `Failed to exchange token: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Refresh the current access token
   * Attempts to exchange the current token for a new long-lived token
   */
  async refreshAccessToken(): Promise<string> {
    console.log("Attempting to refresh Instagram access token...");

    try {
      const newToken = await this.exchangeForLongLivedToken(this.accessToken);
      this.accessToken = newToken;

      console.log("Access token refreshed successfully");
      console.warn(
        "⚠️  Update your .env.local with the new token:\nFB_PAGE_ACCESS_TOKEN=" + newToken
      );

      return newToken;
    } catch (error) {
      throw new Error(
        `Failed to refresh token: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Make a POST request to Facebook Graph API
   * @private
   * @param path - API endpoint path (e.g., "/123456/media")
   * @param data - Request data to send
   * @param retryOnExpired - Whether to retry with refreshed token on expiration
   * @returns Parsed JSON response
   * @throws InstagramAPIError if request fails
   */
  private async graphPost<T>(
    path: string,
    data: Record<string, string>,
    retryOnExpired: boolean = true
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
        let isTokenExpired = false;

        try {
          const errorData = JSON.parse(responseText) as InstagramErrorResponse;
          if (errorData.error) {
            errorMessage = `Instagram API error: ${errorData.error.message} (Code: ${errorData.error.code})`;

            // Check if it's a token expiration error
            // Error codes: 190 = Access token expired, 2500 = Error validating token
            if (
              errorData.error.code === 190 ||
              errorData.error.code === 2500 ||
              errorData.error.message?.toLowerCase().includes("token") ||
              errorData.error.message?.toLowerCase().includes("expired") ||
              errorData.error.message?.toLowerCase().includes("session")
            ) {
              isTokenExpired = true;
            }
          }
        } catch {
          errorMessage = `Instagram API error: ${responseText}`;
        }

        // If token expired and we have app credentials, try to refresh and retry
        if (isTokenExpired && retryOnExpired && this.appId && this.appSecret) {
          console.log("Access token expired. Attempting to refresh...");
          try {
            await this.refreshAccessToken();
            console.log("Token refreshed. Retrying request...");
            // Retry once with new token (retryOnExpired = false to prevent infinite loop)
            return await this.graphPost<T>(path, data, false);
          } catch (refreshError) {
            throw new InstagramAPIError(
              `Token expired and refresh failed: ${refreshError instanceof Error ? refreshError.message : "Unknown error"}. Please update FB_PAGE_ACCESS_TOKEN in your .env.local file.`,
              401,
              responseText
            );
          }
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
   * Make a GET request to Facebook Graph API
   * @private
   * @param path - API endpoint path (e.g., "/123456")
   * @param params - Query parameters
   * @returns Parsed JSON response
   * @throws InstagramAPIError if request fails
   */
  private async graphGet<T>(
    path: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    const url = `${GRAPH_API_HOST}/${GRAPH_API_VERSION}${path}`;

    // Build query parameters with access token
    const queryParams = new URLSearchParams({
      ...params,
      access_token: this.accessToken,
    });

    try {
      const response = await fetch(`${url}?${queryParams.toString()}`, {
        method: "GET",
      });

      const responseText = await response.text();

      if (!response.ok) {
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
   * Sleep utility for async delays
   * @private
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check the status of a media container
   * @private
   * @param containerId - The container ID to check
   * @returns Container status response
   */
  private async checkContainerStatus(
    containerId: string
  ): Promise<ContainerStatusResponse> {
    const path = `/${containerId}`;
    const params = {
      fields: "status_code",
    };

    return await this.graphGet<ContainerStatusResponse>(path, params);
  }

  /**
   * Wait for a media container to be ready for publishing
   * Polls the container status until it's FINISHED or times out
   * @private
   * @param containerId - The container ID to wait for
   * @param maxWaitSeconds - Maximum time to wait in seconds (default: 60)
   * @returns true when ready, throws if error or timeout
   */
  private async waitForContainerReady(
    containerId: string,
    maxWaitSeconds: number = 60
  ): Promise<void> {
    console.log(`Waiting for container ${containerId} to be ready...`);

    const startTime = Date.now();
    const maxWaitMs = maxWaitSeconds * 1000;
    let attempt = 0;

    while (Date.now() - startTime < maxWaitMs) {
      attempt++;

      try {
        const status = await this.checkContainerStatus(containerId);
        console.log(
          `Container status check #${attempt}: ${status.status_code}`
        );

        if (status.status_code === "FINISHED") {
          console.log(`Container ${containerId} is ready!`);
          return;
        }

        if (status.status_code === "ERROR") {
          throw new InstagramAPIError(
            "Container processing failed with ERROR status",
            400
          );
        }

        if (status.status_code === "EXPIRED") {
          throw new InstagramAPIError(
            "Container expired before it could be published",
            400
          );
        }

        // Status is IN_PROGRESS, wait before checking again
        // Use exponential backoff: 2s, 4s, 6s, 8s, 10s, then 10s intervals
        const waitTime = Math.min(2000 * attempt, 10000);
        console.log(`Container still processing, waiting ${waitTime}ms...`);
        await this.sleep(waitTime);
      } catch (error) {
        if (error instanceof InstagramAPIError) {
          throw error;
        }
        // If status check fails, wait and retry
        console.warn(`Status check failed: ${error}, retrying...`);
        await this.sleep(2000);
      }
    }

    throw new InstagramAPIError(
      `Container did not become ready within ${maxWaitSeconds} seconds. Try publishing manually later.`,
      408
    );
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

      // Step 2: Wait for container to be ready
      // Instagram needs time to download and process the image
      await this.waitForContainerReady(creationId);

      // Step 3: Publish media
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
