/**
 * Local Development Script: Trigger Cron Job
 *
 * This script manually triggers the publish scheduled posts cron job
 * for local testing without needing pg_cron or a public domain.
 *
 * Usage:
 *   npx tsx scripts/trigger-cron-locally.ts
 *   or
 *   bun run scripts/trigger-cron-locally.ts
 */

async function triggerCron() {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("❌ CRON_SECRET not found in environment variables");
    console.error("Please add CRON_SECRET to your .env.local file");
    process.exit(1);
  }

  const localUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const endpoint = `${localUrl}/api/cron/publish-scheduled-posts`;

  console.log("🚀 Triggering cron job locally...");
  console.log(`📍 Endpoint: ${endpoint}`);
  console.log("");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cronSecret}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Cron job failed:");
      console.error(JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log("✅ Cron job completed successfully!");
    console.log("");
    console.log("📊 Results:");
    console.log(`   Total pending posts: ${data.total}`);
    console.log(`   Successfully published: ${data.published}`);
    console.log(`   Failed: ${data.failed}`);

    if (data.errors && data.errors.length > 0) {
      console.log("");
      console.log("⚠️  Errors:");
      data.errors.forEach((error: string) => {
        console.log(`   - ${error}`);
      });
    }

    if (data.total === 0) {
      console.log("");
      console.log("ℹ️  No pending posts found to publish");
      console.log("   Schedule some posts first to test the cron job");
    }

  } catch (error) {
    console.error("❌ Error triggering cron job:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the script
triggerCron();
