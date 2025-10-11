# Local Supabase Setup Guide

This guide walks you through setting up and using Supabase locally for development on this project.

## Prerequisites

- **Docker Desktop**: Required to run Supabase services locally
  - Download from: https://www.docker.com/products/docker-desktop
  - Ensure Docker is running before starting Supabase

- **Homebrew** (macOS): For installing Supabase CLI
  - Install if needed: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`

## Installation

### 1. Install Supabase CLI

Using Homebrew (recommended for macOS):

```bash
brew install supabase/tap/supabase
```

Verify installation:

```bash
supabase --version
```

### 2. Start Local Supabase

From your project root directory:

```bash
supabase start
```

This command will:
- Pull necessary Docker images (first time only - may take a few minutes)
- Start PostgreSQL database
- Start Supabase Auth service
- Start Supabase Realtime service
- Start Supabase Storage service
- Start Supabase Studio (web UI)
- Apply all existing migrations from `supabase/migrations/`

**Important**: Keep Docker Desktop running while using local Supabase.

### 3. Save Your Local Credentials

After `supabase start` completes, you'll see output like:

```
Started supabase local development setup.

         API URL: http://localhost:54321
     GraphQL URL: http://localhost:54321/graphql/v1
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Save these values** - you'll need them for configuration.

### 4. Configure Environment Variables

Update your `.env.local` file to use local Supabase:

```env
# Local Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-local-anon-key-from-output>
SUPABASE_SERVICE_ROLE_KEY=<your-local-service-role-key-from-output>
```

**Pro Tip**: Keep a separate `.env.local.cloud` file with your cloud credentials so you can easily switch between local and cloud environments.

### 5. Access Supabase Studio

Open your browser to: http://localhost:54323

Supabase Studio provides a UI to:
- View and edit database tables
- Run SQL queries
- Manage authentication users
- Configure storage buckets
- Test realtime subscriptions
- View logs

## Daily Development Workflow

### Starting Your Dev Session

```bash
# 1. Start Docker Desktop (if not already running)

# 2. Start Supabase
supabase start

# 3. Start your Next.js app
npm run dev
```

### Stopping Supabase

When you're done for the day:

```bash
supabase stop
```

This preserves your local database state. To completely reset:

```bash
supabase stop --no-backup
```

### Checking Status

See what's running:

```bash
supabase status
```

## Working with Database Migrations

### Creating New Migrations

When you need to change the database schema:

```bash
supabase migration new your_migration_name
```

This creates a new file in `supabase/migrations/`. Edit the file with your SQL:

```sql
-- Example migration
CREATE TABLE new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL
);
```

### Applying Migrations

Reset the database and apply all migrations:

```bash
supabase db reset
```

This will:
- Drop the local database
- Recreate it
- Apply all migrations in order
- Run `supabase/seed.sql` if it exists

### Viewing Migration Status

```bash
supabase migration list
```

## Seeding Test Data

Edit `supabase/seed.sql` to add test data that loads automatically:

```sql
-- Insert test data
INSERT INTO profiles (id, email, name)
VALUES
  ('123e4567-e89b-12d3-a456-426614174000', 'test@example.com', 'Test User');
```

Run seed file manually:

```bash
psql postgresql://postgres:postgres@localhost:54322/postgres < supabase/seed.sql
```

Or reset database (which automatically runs seed):

```bash
supabase db reset
```

## Syncing with Cloud Supabase

### Pull Schema from Cloud

If your cloud project has schema changes you want locally:

```bash
# First time: Link to cloud project
supabase link --project-ref <your-project-ref>

# Pull schema
supabase db pull
```

This creates a new migration file with the cloud schema.

### Push Migrations to Cloud

After testing locally, push to cloud:

```bash
supabase db push
```

**Warning**: Always test migrations locally before pushing to production!

## Testing Authentication Locally

Local Supabase includes a built-in email testing tool called **Inbucket**.

Access it at: http://localhost:54324

When testing auth flows:
1. Sign up or request password reset in your app
2. Open Inbucket at http://localhost:54324
3. View the email that was "sent"
4. Click confirmation links directly from Inbucket

## Common Commands Reference

```bash
# Start local Supabase
supabase start

# Stop local Supabase (preserves data)
supabase stop

# Stop and clear all data
supabase stop --no-backup

# Check status and URLs
supabase status

# Reset database (reapply all migrations)
supabase db reset

# Create new migration
supabase migration new <name>

# View migration history
supabase migration list

# Link to cloud project
supabase link --project-ref <ref>

# Pull schema from cloud
supabase db pull

# Push migrations to cloud
supabase db push

# Generate TypeScript types from database
supabase gen types typescript --local > types/supabase.ts
```

## Troubleshooting

### Docker Not Running

**Error**: `Cannot connect to the Docker daemon`

**Solution**: Start Docker Desktop and wait for it to fully initialize.

### Port Already in Use

**Error**: `Port 54321 is already allocated`

**Solution**:
```bash
# Stop any running Supabase instance
supabase stop

# Or find and kill the process using the port
lsof -ti:54321 | xargs kill -9
```

### Migrations Not Applying

**Error**: Migration fails or database state is inconsistent

**Solution**:
```bash
# Nuclear option - full reset
supabase stop --no-backup
supabase start
```

### Database Connection Issues

If your app can't connect to local Supabase:

1. Verify Supabase is running: `supabase status`
2. Check `.env.local` has correct URL: `http://localhost:54321`
3. Ensure you copied the full anon key (they're very long)
4. Restart your Next.js dev server

## Best Practices

### 1. Always Work Locally First

- Develop and test features locally
- Verify migrations work before pushing to cloud
- Use local for destructive testing (you can always reset)

### 2. Keep Migrations Small and Focused

- One migration per logical change
- Include both `UP` and `DOWN` migrations when possible
- Add descriptive comments in migration files

### 3. Use Seed Data for Testing

- Create realistic test data in `seed.sql`
- Include edge cases in your seed data
- Reset database frequently to ensure seed data stays valid

### 4. Version Control Everything

- Commit all migration files to git
- Commit `supabase/config.toml` changes
- Never commit `.env.local` (it's in `.gitignore`)

### 5. Document Schema Changes

When creating migrations, add comments explaining:
- Why the change is needed
- What data is affected
- Any breaking changes

### 6. Test RLS Policies Locally

Use Supabase Studio to test Row Level Security policies:
1. Insert test data
2. Switch between different user roles
3. Verify policies work as expected

## Switching Between Local and Cloud

### Option 1: Environment Variables

Keep two env files:
- `.env.local` - Local Supabase URLs/keys
- `.env.cloud` - Cloud Supabase URLs/keys

Switch by copying:
```bash
cp .env.local.backup .env.local  # Use local
cp .env.cloud .env.local         # Use cloud
```

### Option 2: Multiple Next.js Configs

Use different env files per environment:
```bash
# Run with local
npm run dev

# Run with cloud
npm run dev -- --env=.env.cloud
```

## Project-Specific Notes

This project includes the following database tables (see migrations):
- `events` - Event management
- `speakers` - Speaker profiles
- `speaker_announcements` - Announcement posts
- `scheduled_posts` - Social media scheduling
- `event_agendas` - Event agenda items
- `speaker_images` - Speaker image management

All migrations are in `supabase/migrations/` and will be automatically applied when you run `supabase start`.

## Additional Resources

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Local Development Guide](https://supabase.com/docs/guides/cli/local-development)
- [Database Migrations](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Supabase CLI GitHub](https://github.com/supabase/cli)

## Need Help?

If you run into issues:
1. Check Docker Desktop is running
2. Run `supabase status` to verify services are up
3. Check logs in Docker Desktop
4. Try `supabase stop` and `supabase start` (restart)
5. Review the Supabase CLI docs linked above
