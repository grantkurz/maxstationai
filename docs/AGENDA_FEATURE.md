# Event Agenda Generation Feature

## Overview
This feature allows users to generate AI-powered event agendas by merging speaker announcements and save event page URLs (Luma, Eventbrite, etc.) for future integrations.

## Database Schema

### New Table: `event_agendas`
Stores generated agendas with versioning support.

**Columns:**
- `id` - Primary key
- `event_id` - Foreign key to events table
- `user_id` - Foreign key to auth.users
- `agenda_text` - The generated agenda content
- `agenda_format` - Format type (markdown, html, plain)
- `version` - Version number for tracking iterations
- `is_published` - Boolean flag for published status
- `published_at` - Timestamp of publication
- `included_speaker_ids` - Array of speaker IDs included in this version
- `created_at`, `updated_at` - Timestamps

**Indexes:**
- `idx_event_agendas_event_id` - Quick lookup by event
- `idx_event_agendas_user_id` - Quick lookup by user
- `idx_event_agendas_event_version` - Composite index for event + version queries

**RLS Policies:**
- Users can only view/create/update/delete their own event agendas
- Creation requires ownership of the associated event

### Updated Table: `events`
Added `event_page_url` column to store external event platform URLs.

**New Column:**
- `event_page_url` (TEXT, nullable) - URL to Luma, Eventbrite, or other event pages

## Architecture

### Repository Layer (`lib/repositories/agenda-repository.ts`)
Pure data access layer for event agendas:
- `createAgenda()` - Create new agenda
- `getLatestAgendaByEvent()` - Get most recent version
- `getAllAgendasByEvent()` - Get all versions
- `getAgendaById()` - Get specific agenda
- `updateAgenda()` - Update existing agenda
- `deleteAgenda()` - Remove agenda
- `getNextVersionNumber()` - Calculate next version
- `markAsPublished()` - Mark agenda as published
- `updateEventPageUrl()` - Update event page URL

### Service Layer (`lib/services/agenda-service.ts`)
Business logic and AI integration:
- `generateAgenda()` - Generate agenda using Claude AI
- `getLatestAgenda()` - Retrieve latest with validation
- `getAllAgendaVersions()` - Get all versions with validation
- `publishAgenda()` - Mark as published
- `updateEventPageUrl()` - Update with validation
- `deleteAgenda()` - Delete with authorization

**AI Integration:**
- Uses Claude Sonnet 4.5 via AI SDK
- Leverages `landingPageAgendaPrompt()` for structured output
- Merges speaker bios, session titles, and event details
- Formats output in markdown by default

### API Routes

#### `POST /api/agendas/generate`
Generates a new agenda for an event.

**Request:**
```json
{
  "eventId": 123,
  "format": "markdown",  // optional: markdown, html, plain
  "speakerIds": [1, 2, 3]  // optional: specific speakers to include
}
```

**Response:**
```json
{
  "success": true,
  "agenda": {
    "id": 456,
    "agendaText": "...",
    "version": 2,
    "format": "markdown",
    "createdAt": "2025-10-08T...",
    "includedSpeakerIds": [1, 2, 3]
  }
}
```

#### `GET /api/agendas/[eventId]`
Retrieves agenda(s) for an event.

**Query Parameters:**
- `all=true` - Returns all versions instead of just latest

**Response (latest):**
```json
{
  "success": true,
  "agenda": {
    "id": 456,
    "agendaText": "...",
    "version": 2,
    "format": "markdown",
    "createdAt": "...",
    "updatedAt": "...",
    "isPublished": false,
    "publishedAt": null,
    "includedSpeakerIds": [1, 2, 3]
  }
}
```

#### `POST /api/events/[id]/page-url`
Updates the event page URL.

**Request:**
```json
{
  "eventPageUrl": "https://lu.ma/your-event"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Event page URL updated successfully"
}
```

## UI Components

### `GenerateAgendaDialog` (Client Component)
Modal dialog for generating agendas.

**Features:**
- AI-powered generation button
- Real-time progress indicator
- Generated agenda preview
- Copy to clipboard functionality
- Refresh trigger on generation

**Props:**
- `event` - Event data
- `onAgendaGenerated` - Callback after successful generation

### `EventPageUrlInput` (Client Component)
Input field for event page URLs.

**Features:**
- Live validation
- Save with change detection
- External link button to visit URL
- Platform suggestions (Luma, Eventbrite, etc.)

**Props:**
- `event` - Event data
- `onUrlSaved` - Callback after successful save

### `AgendaViewer` (Client Component)
Display component for viewing agendas.

**Features:**
- Auto-fetch latest agenda
- Version badge display
- Published status indicator
- Copy to clipboard
- Refresh trigger support

**Props:**
- `event` - Event data
- `refreshTrigger` - Optional number to trigger refresh

## Event Detail Page Integration

The event detail page (`/events/[id]/page.tsx`) now includes:

1. **Quick Actions Card** - Generate Agenda button
2. **Event Page Link Card** - URL input for external platforms
3. **Agenda Viewer** - Display generated agendas

Layout updated to include:
- Event Page URL section above tabs
- Agenda viewer in full width below URL input
- Maintains existing Speakers and Scheduled Posts tabs

## Future Enhancements (Not Implemented)

The architecture is designed to support:

1. **Push to External Platforms**
   - Luma API integration
   - Eventbrite API integration
   - Auto-sync agenda updates

2. **Platform-Specific Formatting**
   - Custom formatters per platform
   - HTML output for rich text platforms
   - Plain text for simple platforms

3. **Agenda Templates**
   - Multiple template options
   - Custom template builder
   - Platform-optimized templates

4. **Collaborative Editing**
   - Manual edits to AI-generated agendas
   - Track changes between versions
   - Approval workflows

## Security Considerations

- **RLS Policies**: All database access restricted by user_id
- **Input Validation**: URLs validated for format
- **Authorization**: Event ownership verified before agenda operations
- **API Keys**: ANTHROPIC_API_KEY required for AI generation
- **Rate Limiting**: Consider implementing for AI API calls

## Testing

To test the feature:

1. Navigate to an event detail page
2. Add speakers to the event
3. Click "Generate Luma Agenda" in Quick Actions
4. Review generated agenda in the viewer
5. Add event page URL (e.g., lu.ma/test-event)
6. Copy agenda to clipboard
7. Regenerate to create new version

## Dependencies

- `ai` - Vercel AI SDK for Claude integration
- `@ai-sdk/anthropic` - Anthropic provider
- Supabase client with proper types
- shadcn/ui components (Dialog, Input, Textarea, etc.)

## Migration

Run migration: `supabase/migrations/20251008000000_add_event_agendas_and_page_url.sql`

Then regenerate types:
```bash
supabase gen types typescript --project-id "your-project-id" > types/supabase.ts
```
