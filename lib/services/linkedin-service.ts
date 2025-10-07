/**
 * LinkedIn API Service
 * Handles posting to LinkedIn with image support using LinkedIn's v2 API
 *
 * Reference: https://docs.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api
 *
 * Authentication Flow:
 * 1. Register upload slot for image
 * 2. Upload binary image data
 * 3. Create UGC post with image reference
 */

const API_VERSION = "2.0.0"; // REST-Li protocol header
const API_HOST = "https://api.linkedin.com";

/**
 * Custom error class for LinkedIn API errors
 */
export class LinkedInAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: string
  ) {
    super(message);
    this.name = "LinkedInAPIError";
  }
}

/**
 * Response from registerUpload endpoint
 */
interface RegisterUploadResponse {
  value: {
    uploadMechanism: {
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": {
        uploadUrl: string;
        headers: Record<string, string>;
      };
    };
    asset: string; // Asset URN
  };
}

/**
 * Response from ugcPosts endpoint
 */
interface UGCPostResponse {
  id: string; // Post URN
}

/**
 * Token refresh response from LinkedIn
 */
interface TokenRefreshResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
}

/**
 * LinkedIn Service for posting announcements with images
 */
export class LinkedInService {
  private accessToken: string;
  private ownerUrn: string;
  private refreshToken: string;
  private clientId: string;
  private clientSecret: string;
  private tokenExpiresAt: number = 0; // Unix timestamp

  constructor() {
    // Load credentials from environment variables
    this.accessToken = process.env.LINKEDIN_ACCESS_TOKEN?.trim() || "";
    this.ownerUrn = process.env.LINKEDIN_OWNER_URN?.trim() || "";
    this.refreshToken = process.env.LINKEDIN_REFRESH_TOKEN?.trim() || "";
    this.clientId = process.env.LINKEDIN_CLIENT_ID?.trim() || "";
    this.clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim() || "";

    // Validate required credentials
    if (!this.ownerUrn) {
      throw new Error(
        "LINKEDIN_OWNER_URN environment variable is required."
      );
    }

    // Check if we have either access token or refresh token
    if (!this.accessToken && !this.refreshToken) {
      throw new Error(
        "Either LINKEDIN_ACCESS_TOKEN or LINKEDIN_REFRESH_TOKEN must be set."
      );
    }

    // If using refresh tokens, validate client credentials
    if (this.refreshToken && (!this.clientId || !this.clientSecret)) {
      throw new Error(
        "LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET are required when using refresh tokens."
      );
    }
  }

  /**
   * Refresh the access token using the refresh token
   * @private
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      throw new LinkedInAPIError(
        "Cannot refresh token: Missing refresh token or client credentials",
        401
      );
    }

    console.log("Refreshing LinkedIn access token...");

    try {
      const params = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });

      const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new LinkedInAPIError(
          `Failed to refresh token: ${response.statusText}`,
          response.status,
          errorText
        );
      }

      const data = (await response.json()) as TokenRefreshResponse;

      // Update tokens
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);

      // Update refresh token if a new one was provided
      if (data.refresh_token) {
        this.refreshToken = data.refresh_token;
        console.warn(
          "⚠️  New refresh token received. Update LINKEDIN_REFRESH_TOKEN in your environment:",
          data.refresh_token
        );
      }

      console.log(
        `✅ Access token refreshed successfully. Expires in ${Math.floor(data.expires_in / 3600)} hours.`
      );
    } catch (error) {
      if (error instanceof LinkedInAPIError) {
        throw error;
      }
      throw new LinkedInAPIError(
        `Failed to refresh access token: ${error instanceof Error ? error.message : "Unknown error"}`,
        500
      );
    }
  }

  /**
   * Ensure we have a valid access token, refreshing if necessary
   * @private
   */
  private async ensureValidToken(): Promise<void> {
    // If we have an access token and haven't tracked expiry, assume it's valid
    if (this.accessToken && this.tokenExpiresAt === 0) {
      return;
    }

    // If token is expired or about to expire (within 5 minutes), refresh it
    const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
    if (this.tokenExpiresAt > 0 && this.tokenExpiresAt < fiveMinutesFromNow) {
      await this.refreshAccessToken();
    }

    // If still no access token, try to refresh
    if (!this.accessToken && this.refreshToken) {
      await this.refreshAccessToken();
    }

    // Final validation
    if (!this.accessToken) {
      throw new LinkedInAPIError(
        "No valid access token available and refresh failed",
        401
      );
    }
  }

  /**
   * Get base authentication headers for LinkedIn API calls
   * @param extra - Additional headers to merge
   * @returns Headers object with authentication and protocol version
   */
  private getAuthHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      "X-Restli-Protocol-Version": API_VERSION,
    };

    if (extra) {
      Object.assign(headers, extra);
    }

    return headers;
  }

  /**
   * Step 1: Register an image upload with LinkedIn
   * Reserves an asset upload slot and returns upload URL
   *
   * @returns Tuple of [uploadUrl, assetUrn]
   * @throws LinkedInAPIError if registration fails
   */
  async registerImageUpload(): Promise<[string, string]> {
    await this.ensureValidToken();
    const url = `${API_HOST}/v2/assets?action=registerUpload`;

    const body = {
      registerUploadRequest: {
        owner: this.ownerUrn,
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        serviceRelationships: [
          {
            relationshipType: "OWNER",
            identifier: "urn:li:userGeneratedContent",
          },
        ],
      },
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new LinkedInAPIError(
          `Failed to register upload: ${response.statusText}`,
          response.status,
          errorText
        );
      }

      const data = (await response.json()) as RegisterUploadResponse;

      const uploadMech =
        data.value.uploadMechanism[
          "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
        ];

      return [uploadMech.uploadUrl, data.value.asset];
    } catch (error) {
      if (error instanceof LinkedInAPIError) {
        throw error;
      }
      throw new LinkedInAPIError(
        `Failed to register image upload: ${error instanceof Error ? error.message : "Unknown error"}`,
        500
      );
    }
  }

  /**
   * Step 2: Upload binary image data to LinkedIn's upload URL
   *
   * @param uploadUrl - Upload URL from registerImageUpload
   * @param fileBuffer - Binary image data as Buffer or Uint8Array
   * @param filename - Original filename (used to determine MIME type)
   * @throws LinkedInAPIError if upload fails
   */
  async uploadBinary(
    uploadUrl: string,
    fileBuffer: Buffer | Uint8Array,
    filename: string
  ): Promise<void> {
    await this.ensureValidToken();
    // Determine MIME type from filename
    const mimeType = this.getMimeType(filename);

    try {
      const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: this.getAuthHeaders({ "Content-Type": mimeType }),
        body: fileBuffer,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new LinkedInAPIError(
          `Failed to upload binary: ${response.statusText}`,
          response.status,
          errorText
        );
      }
    } catch (error) {
      if (error instanceof LinkedInAPIError) {
        throw error;
      }
      throw new LinkedInAPIError(
        `Failed to upload image binary: ${error instanceof Error ? error.message : "Unknown error"}`,
        500
      );
    }
  }

  /**
   * Step 3: Create a LinkedIn UGC post with optional image
   *
   * @param caption - Post text content
   * @param assetUrn - Optional asset URN from registerImageUpload (for image posts)
   * @returns LinkedIn post URN
   * @throws LinkedInAPIError if post creation fails
   */
  async createPost(caption: string, assetUrn?: string): Promise<string> {
    await this.ensureValidToken();
    const url = `${API_HOST}/v2/ugcPosts`;

    // Build post body
    const body: {
      author: string;
      lifecycleState: string;
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: string };
          shareMediaCategory: string;
          media?: Array<{ status: string; media: string }>;
        };
      };
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": string };
    } = {
      author: this.ownerUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: caption },
          shareMediaCategory: assetUrn ? "IMAGE" : "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };

    // Add media if asset URN is provided
    if (assetUrn) {
      body.specificContent["com.linkedin.ugc.ShareContent"].media = [
        { status: "READY", media: assetUrn },
      ];
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new LinkedInAPIError(
          `Failed to create post: ${response.statusText}`,
          response.status,
          errorText
        );
      }

      const data = (await response.json()) as UGCPostResponse;
      return data.id || "";
    } catch (error) {
      if (error instanceof LinkedInAPIError) {
        throw error;
      }
      throw new LinkedInAPIError(
        `Failed to create LinkedIn post: ${error instanceof Error ? error.message : "Unknown error"}`,
        500
      );
    }
  }

  /**
   * Complete flow: Post to LinkedIn with optional image
   *
   * @param caption - Post text content
   * @param imageBuffer - Optional image binary data
   * @param filename - Optional filename (required if imageBuffer is provided)
   * @returns LinkedIn post URN
   * @throws LinkedInAPIError if any step fails
   *
   * @example
   * // Text-only post
   * const urn = await linkedInService.postToLinkedIn("Hello LinkedIn!");
   *
   * @example
   * // Post with image
   * const imageBuffer = await fs.readFile('image.jpg');
   * const urn = await linkedInService.postToLinkedIn(
   *   "Check out this image!",
   *   imageBuffer,
   *   "image.jpg"
   * );
   */
  async postToLinkedIn(
    caption: string,
    imageBuffer?: Buffer | Uint8Array,
    filename?: string
  ): Promise<string> {
    // Validate inputs
    if (!caption || caption.trim().length === 0) {
      throw new LinkedInAPIError("Caption cannot be empty", 400);
    }

    if (imageBuffer && !filename) {
      throw new LinkedInAPIError(
        "Filename is required when uploading an image",
        400
      );
    }

    try {
      let assetUrn: string | undefined;

      // If image is provided, upload it first
      if (imageBuffer && filename) {
        console.log("Registering image upload with LinkedIn...");
        const [uploadUrl, registeredAssetUrn] = await this.registerImageUpload();
        assetUrn = registeredAssetUrn;

        console.log("Uploading image binary to LinkedIn...");
        await this.uploadBinary(uploadUrl, imageBuffer, filename);

        console.log("Image uploaded successfully:", assetUrn);
      }

      // Create the post
      console.log("Creating LinkedIn post...");
      const postUrn = await this.createPost(caption, assetUrn);

      console.log("LinkedIn post created successfully:", postUrn);
      return postUrn;
    } catch (error) {
      if (error instanceof LinkedInAPIError) {
        throw error;
      }
      throw new LinkedInAPIError(
        `Failed to post to LinkedIn: ${error instanceof Error ? error.message : "Unknown error"}`,
        500
      );
    }
  }

  /**
   * Determine MIME type from filename extension
   * @private
   */
  private getMimeType(filename: string): string {
    const extension = filename.toLowerCase().split(".").pop();

    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      bmp: "image/bmp",
      svg: "image/svg+xml",
    };

    return mimeTypes[extension || ""] || "application/octet-stream";
  }
}
