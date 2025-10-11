// @ts-nocheck - Standalone script with external dependencies
/**
 * Script to refresh LinkedIn access token using a refresh token
 *
 * Usage:
 * 1. Set environment variables in .env.local:
 *    - LINKEDIN_CLIENT_ID
 *    - LINKEDIN_CLIENT_SECRET
 *    - LINKEDIN_REFRESH_TOKEN
 *
 * 2. Run: npx tsx scripts/refresh-linkedin-token.ts
 */

import { config } from 'dotenv';

config({ path: '.env.local' });

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const LINKEDIN_REFRESH_TOKEN = process.env.LINKEDIN_REFRESH_TOKEN;

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
}

async function refreshLinkedInToken(): Promise<void> {
  if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET || !LINKEDIN_REFRESH_TOKEN) {
    console.error('❌ Missing required environment variables:');
    console.error('   - LINKEDIN_CLIENT_ID');
    console.error('   - LINKEDIN_CLIENT_SECRET');
    console.error('   - LINKEDIN_REFRESH_TOKEN');
    console.error('\nPlease add these to your .env.local file');
    process.exit(1);
  }

  console.log('🔄 Refreshing LinkedIn access token...\n');

  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: LINKEDIN_REFRESH_TOKEN,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
    });

    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to refresh token: ${response.status} ${errorText}`);
    }

    const data: TokenResponse = await response.json();

    console.log('✅ Successfully refreshed LinkedIn token!\n');
    console.log('📋 Add these to your .env.local file:\n');
    console.log('─'.repeat(60));
    console.log(`LINKEDIN_ACCESS_TOKEN=${data.access_token}`);

    if (data.refresh_token) {
      console.log(`LINKEDIN_REFRESH_TOKEN=${data.refresh_token}`);
    }
    console.log('─'.repeat(60));

    console.log(`\n⏱️  Access token expires in: ${data.expires_in} seconds (${Math.floor(data.expires_in / 3600)} hours)`);

    if (data.refresh_token_expires_in) {
      console.log(`⏱️  Refresh token expires in: ${data.refresh_token_expires_in} seconds (${Math.floor(data.refresh_token_expires_in / 86400)} days)`);
    }

    console.log('\n💡 Tip: LinkedIn access tokens typically expire in 60 days');
    console.log('💡 Tip: Set up a cron job to refresh the token before it expires\n');

  } catch (error) {
    console.error('❌ Error refreshing token:', error);

    if (error instanceof Error) {
      if (error.message.includes('400')) {
        console.error('\n💡 Possible causes:');
        console.error('   - Refresh token has expired');
        console.error('   - Incorrect client ID or secret');
        console.error('   - Refresh token has already been used (they are single-use)');
        console.error('\nYou may need to re-authenticate to get a new refresh token.');
      }
    }

    process.exit(1);
  }
}

refreshLinkedInToken();
