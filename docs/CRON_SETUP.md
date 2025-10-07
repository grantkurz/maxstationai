# Cron Job Setup - Scheduled Post Publishing

This project uses **GitHub Actions** to automatically publish scheduled posts every 5 minutes.

## How It Works

- GitHub Actions runs a cron job every 5 minutes
- The workflow calls `/api/cron/publish-scheduled-posts`
- The endpoint publishes all pending posts where `scheduled_time <= now()`
- Posts are marked as `posted` or `failed`

## Setup Instructions

### 1. Add GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Add these two secrets:

**`APP_URL`**
- Your production URL (e.g., `https://yourapp.com`)
- For staging: use your staging URL

**`CRON_SECRET`**
- Generate a secure random string:
  ```bash
  openssl rand -base64 32
  ```
- This same secret must be in your `.env` as `CRON_SECRET`

### 2. Verify the Workflow

The workflow file is at: `.github/workflows/cron-publish-posts.yml`

It runs:
- **Automatically**: Every 5 minutes via cron schedule
- **Manually**: Click "Run workflow" in GitHub Actions tab for testing

### 3. Test It

1. **Local testing**:
   ```bash
   bun run scripts/trigger-cron-locally.ts
   ```

2. **GitHub Actions testing**:
   - Go to Actions tab in your repo
   - Click "Publish Scheduled Posts" workflow
   - Click "Run workflow" → "Run workflow"
   - Check the logs to see results

### 4. Monitor Cron Jobs

View logs in:
- GitHub: Repository → Actions → Publish Scheduled Posts
- Your API logs for the cron endpoint

## Cron Schedule

Current: `*/5 * * * *` (every 5 minutes)

To change frequency, edit `.github/workflows/cron-publish-posts.yml`:

```yaml
schedule:
  - cron: '*/1 * * * *'  # Every minute
  - cron: '*/10 * * * *' # Every 10 minutes
  - cron: '0 * * * *'    # Every hour
```

## Security

- ✅ `CRON_SECRET` stored in GitHub Secrets (encrypted)
- ✅ No secrets in code or database
- ✅ Endpoint validates secret via Authorization header
- ✅ Automatic retries (3 attempts) if endpoint fails

## Troubleshooting

**Cron job not running:**
- Check GitHub Actions is enabled for your repo
- Verify `APP_URL` and `CRON_SECRET` are set in GitHub Secrets
- Check that secrets match between GitHub and your `.env`

**Posts not publishing:**
- Run local test script to debug
- Check API logs for errors
- Verify LinkedIn tokens are valid
- Check scheduled_posts table for pending posts

**Manual trigger:**
```bash
# Production
curl -X POST "https://yourapp.com/api/cron/publish-scheduled-posts" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Local
bun run scripts/trigger-cron-locally.ts
```

## Local Development

For local development, GitHub Actions won't run. Use the manual trigger script:

```bash
bun run scripts/trigger-cron-locally.ts
```

This calls your local endpoint at `http://localhost:3000`.
