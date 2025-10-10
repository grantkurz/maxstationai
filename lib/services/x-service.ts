/**
 * X (Twitter) API Service
 * Handles posting to X/Twitter with image support using OAuth 1.0a and Twitter API v2
 *
 * Reference: https://developer.twitter.com/en/docs/twitter-api
 *
 * Authentication Flow:
 * 1. Generate OAuth 1.0a signature for each request
 * 2. Upload media (if image provided) using v1.1 media upload endpoint
 * 3. Create tweet using v2 tweets endpoint with media reference
 */

import { createHmac, randomBytes } from "crypto";

const UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json";
const TWEET_V2_URL = "https://api.twitter.com/2/tweets";

/**
 * Custom error class for X API errors
 */
export class XAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: string
  ) {
    super(message);
    this.name = "XAPIError";
  }
}

/**
 * Response from media upload endpoint
 */
interface MediaUploadResponse {
  media_id_string: string;
  size: number;
  expires_after_secs: number;
  image?: {
    image_type: string;
    w: number;
    h: number;
  };
}

/**
 * Response from tweets endpoint
 */
interface TweetResponse {
  data: {
    id: string;
    text: string;
  };
}

/**
 * OAuth 1.0a parameters
 */
interface OAuth1Params {
  oauth_consumer_key: string;
  oauth_token: string;
  oauth_signature_method: string;
  oauth_timestamp: string;
  oauth_nonce: string;
  oauth_version: string;
  oauth_signature?: string;
}

/**
 * X (Twitter) Service for posting tweets with images
 */
export class XService {
  private apiKey: string;
  private apiSecret: string;
  private accessToken: string;
  private accessSecret: string;

  constructor() {
    // Load credentials from environment variables
    this.apiKey = process.env.TWITTER_API_KEY?.trim() || "";
    this.apiSecret = process.env.TWITTER_API_SECRET?.trim() || "";
    this.accessToken = process.env.TWITTER_ACCESS_TOKEN?.trim() || "";
    this.accessSecret = process.env.TWITTER_ACCESS_SECRET?.trim() || "";

    // Validate required credentials
    if (!this.apiKey || !this.apiSecret || !this.accessToken || !this.accessSecret) {
      throw new Error(
        "Twitter credentials not configured. Please set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, and TWITTER_ACCESS_SECRET environment variables."
      );
    }
  }

  /**
   * Generate OAuth 1.0a signature
   * @private
   */
  private generateOAuthSignature(
    method: string,
    url: string,
    params: Record<string, string>
  ): string {
    // Sort parameters
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${this.percentEncode(key)}=${this.percentEncode(params[key])}`)
      .join("&");

    // Create signature base string
    const signatureBaseString = [
      method.toUpperCase(),
      this.percentEncode(url),
      this.percentEncode(sortedParams),
    ].join("&");

    // Create signing key
    const signingKey = `${this.percentEncode(this.apiSecret)}&${this.percentEncode(
      this.accessSecret
    )}`;

    // Generate signature
    const signature = createHmac("sha1", signingKey)
      .update(signatureBaseString)
      .digest("base64");

    return signature;
  }

  /**
   * Percent encode according to RFC 3986
   * @private
   */
  private percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/!/g, "%21")
      .replace(/'/g, "%27")
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29")
      .replace(/\*/g, "%2A");
  }

  /**
   * Generate OAuth 1.0a parameters
   * @private
   */
  private generateOAuthParams(): OAuth1Params {
    return {
      oauth_consumer_key: this.apiKey,
      oauth_token: this.accessToken,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: randomBytes(32).toString("base64").replace(/\W/g, ""),
      oauth_version: "1.0",
    };
  }

  /**
   * Generate Authorization header for OAuth 1.0a
   * @private
   */
  private getOAuthHeader(
    method: string,
    url: string,
    additionalParams: Record<string, string> = {}
  ): string {
    const oauthParams = this.generateOAuthParams();

    // Combine OAuth params with additional params for signature
    const allParams = { ...oauthParams, ...additionalParams };

    // Generate signature
    const signature = this.generateOAuthSignature(method, url, allParams);

    // Build Authorization header
    const authParams = {
      ...oauthParams,
      oauth_signature: signature,
    };

    const authHeader =
      "OAuth " +
      Object.keys(authParams)
        .sort()
        .map((key) => `${key}="${this.percentEncode(authParams[key as keyof OAuth1Params]!)}"`)
        .join(", ");

    return authHeader;
  }

  /**
   * Upload media to Twitter
   * @param imageBuffer - Image binary data
   * @param filename - Original filename
   * @returns Media ID string
   * @throws XAPIError if upload fails
   */
  async uploadMedia(imageBuffer: Buffer | Uint8Array, filename: string): Promise<string> {
    try {
      console.log(`Uploading image to Twitter: ${filename} (${imageBuffer.length} bytes)`);

      // Convert to base64 for multipart upload
      const base64Image = Buffer.from(imageBuffer).toString("base64");

      // Create form data manually (Twitter expects specific format)
      const boundary = `----WebKitFormBoundary${randomBytes(16).toString("hex")}`;
      const formData: string[] = [];

      formData.push(`--${boundary}`);
      formData.push(`Content-Disposition: form-data; name="media_data"`);
      formData.push("");
      formData.push(base64Image);
      formData.push(`--${boundary}--`);

      const body = formData.join("\r\n");

      // Generate OAuth header (no additional params for POST body)
      const authHeader = this.getOAuthHeader("POST", UPLOAD_URL);

      const response = await fetch(UPLOAD_URL, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Twitter media upload failed:", response.status, errorText);
        throw new XAPIError(
          `Failed to upload media: ${response.statusText}`,
          response.status,
          errorText
        );
      }

      const data = (await response.json()) as MediaUploadResponse;
      console.log(`Media uploaded successfully: ${data.media_id_string}`);

      return data.media_id_string;
    } catch (error) {
      if (error instanceof XAPIError) {
        throw error;
      }
      throw new XAPIError(
        `Failed to upload media: ${error instanceof Error ? error.message : "Unknown error"}`,
        500
      );
    }
  }

  /**
   * Create a tweet
   * @param text - Tweet text
   * @param mediaId - Optional media ID from uploadMedia
   * @returns Tweet ID
   * @throws XAPIError if tweet creation fails
   */
  async createTweet(text: string, mediaId?: string): Promise<string> {
    try {
      console.log(`Creating tweet: ${text.substring(0, 50)}...`);

      // Build tweet data
      const tweetData: {
        text: string;
        media?: { media_ids: string[] };
      } = {
        text: text,
      };

      if (mediaId) {
        tweetData.media = {
          media_ids: [mediaId],
        };
      }

      const bodyJson = JSON.stringify(tweetData);

      // Generate OAuth header for v2 API
      const authHeader = this.getOAuthHeader("POST", TWEET_V2_URL);

      const response = await fetch(TWEET_V2_URL, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: bodyJson,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Twitter tweet creation failed:", response.status, errorText);
        throw new XAPIError(
          `Failed to create tweet: ${response.statusText}`,
          response.status,
          errorText
        );
      }

      const data = (await response.json()) as TweetResponse;
      console.log(`Tweet created successfully: ${data.data.id}`);

      return data.data.id;
    } catch (error) {
      if (error instanceof XAPIError) {
        throw error;
      }
      throw new XAPIError(
        `Failed to create tweet: ${error instanceof Error ? error.message : "Unknown error"}`,
        500
      );
    }
  }

  /**
   * Complete flow: Post to X/Twitter with optional image
   *
   * @param text - Tweet text content
   * @param imageBuffer - Optional image binary data
   * @param filename - Optional filename (required if imageBuffer is provided)
   * @returns Tweet ID
   * @throws XAPIError if any step fails
   *
   * @example
   * // Text-only tweet
   * const tweetId = await xService.postToX("Hello X/Twitter!");
   *
   * @example
   * // Tweet with image
   * const imageBuffer = await fs.readFile('image.jpg');
   * const tweetId = await xService.postToX(
   *   "Check out this image!",
   *   imageBuffer,
   *   "image.jpg"
   * );
   */
  async postToX(
    text: string,
    imageBuffer?: Buffer | Uint8Array,
    filename?: string
  ): Promise<string> {
    // Validate inputs
    if (!text || text.trim().length === 0) {
      throw new XAPIError("Tweet text cannot be empty", 400);
    }

    // Note: Character limit validation removed to support X Premium subscriptions
    // which allow longer tweets (up to 25,000 characters)

    if (imageBuffer && !filename) {
      throw new XAPIError("Filename is required when uploading an image", 400);
    }

    try {
      let mediaId: string | undefined;

      // If image is provided, upload it first
      if (imageBuffer && filename) {
        console.log("Uploading image to Twitter...");
        mediaId = await this.uploadMedia(imageBuffer, filename);
        console.log("Image uploaded successfully:", mediaId);
      }

      // Create the tweet
      console.log("Creating tweet...");
      const tweetId = await this.createTweet(text, mediaId);

      console.log("Tweet posted successfully:", tweetId);
      return tweetId;
    } catch (error) {
      if (error instanceof XAPIError) {
        throw error;
      }
      throw new XAPIError(
        `Failed to post to X/Twitter: ${error instanceof Error ? error.message : "Unknown error"}`,
        500
      );
    }
  }

  /**
   * Download image from URL
   * @param imageUrl - URL of the image to download
   * @returns Image buffer
   * @throws XAPIError if download fails
   */
  async downloadImage(imageUrl: string): Promise<Buffer> {
    try {
      console.log(`Downloading image from: ${imageUrl}`);

      const response = await fetch(imageUrl);

      if (!response.ok) {
        throw new XAPIError(
          `Failed to download image: ${response.statusText}`,
          response.status
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log(`Downloaded ${buffer.length} bytes`);
      return buffer;
    } catch (error) {
      if (error instanceof XAPIError) {
        throw error;
      }
      throw new XAPIError(
        `Failed to download image: ${error instanceof Error ? error.message : "Unknown error"}`,
        500
      );
    }
  }
}
