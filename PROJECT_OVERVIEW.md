# Project Overview: Event Speaker Management & Social Media Platform

## Executive Summary

This is a **Next.js 15 (App Router)** application built for event organizers to manage speakers and automate social media announcements across LinkedIn, Instagram, and X (Twitter). The platform uses **Supabase** for database, authentication, and storage, with **AI SDK 5** for content generation capabilities.

**Core Value Proposition:** Streamline event promotion by generating AI-powered speaker announcements and automatically posting them to multiple social media platforms with proper speaker images.

---

## Tech Stack

### Frontend
- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS with shadcn/ui components
- **Language:** TypeScript
- **State Management:** React hooks
- **UI Library:** Radix UI components via shadcn/ui

### Backend
- **Database:** PostgreSQL via Supabase
- **Authentication:** Supabase Auth
- **Storage:** Supabase Storage (CDN-backed)
- **API Routes:** Next.js API routes
- **Architecture:** Clean architecture (Repository → Service → API layers)

### AI & Integrations
- **AI:** Vercel AI SDK 5 with Claude Sonnet 4.5
- **Social Media:**
  - Instagram (Facebook Graph API v21.0)
  - LinkedIn (LinkedIn API)
  - X/Twitter (X API)

### Infrastructure
- **Deployment:** Vercel
- **Database:** Supabase PostgreSQL
- **Storage:** Supabase Storage
- **Version Control:** Git

---

## Core Data Models

### 1. **Events**
Primary entity for event management
- **Key Fields:** title, date, location, start_time, end_time, timezone, description, ticket_url
- **Relationships:** Has many speakers, has many agendas
- **Ownership:** Belongs to user_id

### 2. **Speakers**
Speaker profiles for events
- **Key Fields:** name, speaker_title, speaker_bio, session_title, session_description
- **Relationships:**
  - Belongs to event
  - Has many speaker_images
  - Has one primary_image_id (reference to speaker_images)
  - Has many announcements
- **Special:** Includes drip campaign fields (days_before_event_to_post, drip_content)

### 3. **Speaker Images**
Image management for speakers with CDN delivery
- **Key Fields:** storage_path, public_url, filename, mime_type, size_bytes, is_primary
- **Relationships:** Belongs to speaker
- **Features:**
  - First image auto-set as primary
  - Auto-promotion on deletion
  - Used for social media posts

### 4. **Announcements**
AI-generated or custom social media announcements
- **Key Fields:** announcement_text, character_count, platform, template
- **Platforms:** linkedin, twitter, instagram
- **Templates:** pre-event, day-of, post-event, custom
- **Relationships:** Belongs to speaker and event

### 5. **Scheduled Posts**
Scheduled social media posts with retry logic
- **Key Fields:** scheduled_time, post_text, platform, status, image_url, timezone
- **Status Values:** pending, posted, failed
- **Relationships:** Belongs to announcement, speaker, and event
- **Features:** Retry mechanism, error tracking, posted_urn for tracking

### 6. **Event Agendas**
Generated event agendas with speaker information
- **Key Fields:** agenda_text, agenda_format, included_speaker_ids, version, is_published
- **Relationships:** Belongs to event
- **Features:** Version control, publishing workflow

### 7. **Profiles**
User profile with OAuth tokens
- **Key Fields:** full_name, avatar_url, instagram_access_token, linkedin_access_token
- **Relationships:** Links to auth.users
- **Purpose:** Store social media credentials per user

---

## Architecture Overview

### Clean Architecture Layers

```
┌─────────────────────────────────────────┐
│         Frontend (React/Next.js)        │
│  - Components (shadcn/ui)               │
│  - Pages (App Router)                   │
│  - Client State                         │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│         API Routes (Next.js)            │
│  - Authentication (Supabase)            │
│  - Request Validation                   │
│  - Response Formatting                  │
│  - Error Handling                       │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│         Service Layer                   │
│  - Business Logic                       │
│  - Orchestration                        │
│  - Validation                           │
│  - External API Integration             │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│      Repository Layer                   │
│  - Database Queries                     │
│  - Data Access                          │
│  - Ownership Validation                 │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│   Supabase (Database & Storage)         │
│  - PostgreSQL with RLS                  │
│  - Storage Buckets                      │
│  - Authentication                       │
└─────────────────────────────────────────┘
```

### Key Services

1. **AnnouncementService** - Generate and manage speaker announcements
2. **SpeakerImageService** - Upload, manage, and retrieve speaker images
3. **InstagramService** - Post images to Instagram
4. **LinkedInService** - Post images to LinkedIn
5. **XService** - Post to X/Twitter
6. **ScheduledPostService** - Schedule and execute social media posts
7. **DripCampaignService** - Manage automated post campaigns
8. **AgendaService** - Generate event agendas

---

## Core Features

### 1. Event Management
- Create and manage events
- Add speakers to events
- Set event details (date, time, location, timezone)
- Ticket URL integration

### 2. Speaker Management
- Add speaker profiles with bio and session details
- Upload speaker images (CDN-backed)
- Set primary image for social media
- Multiple images per speaker
- Drip campaign configuration

### 3. AI-Powered Announcements
- Generate speaker announcements using Claude Sonnet 4.5
- Platform-specific templates (LinkedIn, Instagram, X)
- Template types: pre-event, day-of, post-event, custom
- Character count validation per platform
- Custom editing capabilities

### 4. Image Management System
- Upload speaker images to Supabase Storage
- Automatic CDN delivery via public URLs
- Primary image auto-selection
- Image validation (type, size, format)
- Auto-promotion on deletion
- Max 10MB per image
- Supported formats: JPEG, PNG, GIF, WebP

### 5. Social Media Integration

**Instagram:**
- Two-step posting (create container → publish)
- HTTPS image URL requirement
- Automatic image fetching from speaker's primary image
- Caption support
- Post tracking via creation_id and media_id

**LinkedIn:**
- Image upload via registerUpload API
- Post creation with image URN
- Caption support
- Post tracking via post URN
- Refresh token support

**X/Twitter:**
- Media upload and posting
- Character limit: 25,000 (X Premium)
- Caption support

### 6. Scheduled Posting
- Schedule posts for future dates/times
- Timezone-aware scheduling
- Retry logic for failed posts
- Status tracking (pending, posted, failed)
- Error message storage
- Cron job execution

### 7. Event Agendas
- Auto-generate event agendas from speakers
- Multiple format support
- Version control
- Publishing workflow
- Include/exclude specific speakers

### 8. Drip Campaigns
- Automated posting campaigns
- Configure days before event to post
- Custom drip content per speaker
- Integration with scheduled posting

---

## API Routes

### Events
- `GET/POST /api/events` - List/create events
- `GET/PUT/DELETE /api/events/[id]` - Manage event

### Speakers
- `GET/POST /api/speakers` - List/create speakers
- `GET/PUT/DELETE /api/speakers/[id]` - Manage speaker
- `POST /api/speakers/[id]/post` - Post speaker to social media

### Speaker Images
- `GET /api/speakers/[id]/images` - List images
- `POST /api/speakers/[id]/images` - Upload image
- `DELETE /api/speakers/[id]/images/[imageId]` - Delete image
- `PUT /api/speakers/[id]/images/[imageId]/primary` - Set primary

### Announcements
- `GET/POST /api/announcements` - List/create announcements
- `GET/PUT/DELETE /api/announcements/[id]` - Manage announcement

### Scheduled Posts
- `GET/POST /api/posts` - List/create scheduled posts
- `GET/PUT/DELETE /api/posts/[id]` - Manage post

### Social Media
- `POST /api/instagram/post` - Post to Instagram
- `POST /api/linkedin/post` - Post to LinkedIn
- `POST /api/x/post` - Post to X

### Agendas
- `GET/POST /api/agendas` - List/create agendas
- `GET/PUT/DELETE /api/agendas/[id]` - Manage agenda

### Drip Campaigns
- `POST /api/drip-campaigns/generate` - Generate campaign posts
- `GET /api/drip-campaigns/[id]` - View campaign

### Cron
- `POST /api/cron/process-scheduled-posts` - Process pending posts

---

## Security Features

### Authentication & Authorization
- Supabase JWT-based authentication
- Row Level Security (RLS) on all tables
- User ownership validation at API layer
- Service layer authorization checks

### Data Security
- RLS policies enforce user isolation
- Storage bucket policies (user-specific folders)
- SQL injection prevention (parameterized queries)
- File type and size validation
- HTTPS-only image URLs

### API Security
- Authentication required on all endpoints
- Ownership verification before operations
- Input validation and sanitization
- Rate limiting (via platform APIs)
- Environment variable protection

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Instagram
INSTAGRAM_USER_ID=
INSTAGRAM_ACCESS_TOKEN=

# LinkedIn
LINKEDIN_OWNER_URN=
LINKEDIN_ACCESS_TOKEN=
# Or use refresh token flow
LINKEDIN_REFRESH_TOKEN=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# X/Twitter
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=

# AI SDK
ANTHROPIC_API_KEY=
```

---

## Database Schema Summary

```sql
-- Core tables
events (id, user_id, title, date, location, start_time, end_time, timezone, ...)
speakers (id, event_id, name, speaker_title, speaker_bio, session_title, primary_image_id, ...)
speaker_images (id, speaker_id, storage_path, public_url, is_primary, ...)
announcements (id, speaker_id, event_id, announcement_text, platform, template, ...)
scheduled_posts (id, announcement_id, scheduled_time, platform, status, ...)
event_agendas (id, event_id, agenda_text, version, is_published, ...)
profiles (id, full_name, instagram_access_token, linkedin_access_token, ...)

-- Key indexes
idx_speakers_event_id
idx_speaker_images_speaker_id
idx_speaker_images_is_primary
idx_scheduled_posts_status_scheduled_time
idx_announcements_speaker_id

-- Foreign key relationships with CASCADE
- speakers → events (ON DELETE CASCADE)
- speaker_images → speakers (ON DELETE CASCADE)
- announcements → speakers, events (ON DELETE CASCADE)
- scheduled_posts → announcements, speakers, events (ON DELETE CASCADE)
```

---

## User Workflows

### 1. Create Event & Speakers
```
1. User creates event
2. Adds speakers with bio/session details
3. Uploads speaker images
4. Sets primary image (auto-selected if first)
```

### 2. Generate Announcements
```
1. Select speaker
2. Choose platform (LinkedIn/Instagram/X)
3. Choose template (pre-event/day-of/post-event)
4. AI generates announcement text
5. Edit if needed
6. Save announcement
```

### 3. Schedule Posts
```
1. Select announcement
2. Choose date/time (timezone-aware)
3. Schedule post
4. Cron job processes at scheduled time
5. Fetches speaker's primary image
6. Posts to platform with image
7. Updates status (posted/failed)
```

### 4. Immediate Posting
```
1. Select speaker
2. Choose platforms (can select multiple)
3. Provide caption
4. System fetches primary image
5. Posts to selected platforms
6. Returns results
```

### 5. Drip Campaign
```
1. Configure speaker drip settings
2. Set days_before_event_to_post
3. Add drip_content
4. Generate scheduled posts automatically
5. Posts execute on schedule
```

---

## AI Integration Points

### Current AI Usage
- **Announcement Generation:** Claude Sonnet 4.5 generates platform-specific speaker announcements based on speaker bio, session details, and template type

### Potential AI Enhancements (Analysis)

**Should the app include AI-generated blogs?**

**✅ YES - Strong Case For:**
1. **Content Marketing Value:** Event organizers need long-form content for:
   - Event landing pages
   - Speaker spotlight blogs
   - Post-event recaps
   - SEO benefits

2. **Natural Extension:** Already have data model with:
   - Speaker bios and session details
   - Event information
   - Multiple speakers per event
   - Could generate "Meet Our Speakers" series

3. **Workflow Fit:**
   - Use same AI (Claude) for consistency
   - Leverage existing event/speaker data
   - Export options (Markdown, HTML)
   - Could integrate with CMS platforms

4. **User Need:** Event organizers often need:
   - Blog posts announcing speakers
   - Speaker interview-style content
   - Event preview articles
   - Post-event summaries

**Implementation Approach:**
```typescript
// New table: blog_posts
{
  id, event_id, speaker_ids[],
  title, content, format (markdown/html),
  status (draft/published),
  published_url?, seo_metadata
}

// New service: BlogGenerationService
- generateSpeakerSpotlight(speakerId)
- generateEventPreview(eventId)
- generateMultiSpeakerArticle(eventId, speakerIds[])
- generatePostEventRecap(eventId)
```

**Should the app include AI-generated social media posts?**

**✅ ALREADY IMPLEMENTED** - The app currently generates:
- Speaker announcements via AI
- Platform-specific content
- Template-based generation

**🔄 COULD ENHANCE WITH:**

1. **Visual Post Generation:**
   - AI-generated quote cards
   - Speaker highlight graphics
   - Event countdown images
   - Using speaker images + overlay text

2. **Carousel/Thread Generation:**
   - Instagram carousels
   - X/Twitter threads
   - LinkedIn document posts
   - Multi-slide content

3. **Smart Scheduling Suggestions:**
   - AI recommends best posting times
   - Optimal posting frequency
   - Platform-specific strategies

4. **Content Variation:**
   - Generate multiple versions
   - A/B testing suggestions
   - Hashtag optimization
   - Emoji suggestions

5. **Cross-Platform Optimization:**
   - Same content, optimized per platform
   - LinkedIn: professional tone
   - Instagram: visual-first, hashtags
   - X: concise, thread-aware

**Implementation Example:**
```typescript
// Enhanced announcement generation
interface EnhancedAnnouncementRequest {
  speaker_id: number
  platforms: ['linkedin', 'instagram', 'x']
  options: {
    generate_variations: boolean  // Generate 3 versions
    include_hashtags: boolean
    tone: 'professional' | 'casual' | 'enthusiastic'
    include_cta: boolean
    visual_suggestion?: boolean  // AI suggests image overlays
  }
}

// New: Visual content generation
interface VisualPostRequest {
  speaker_id: number
  style: 'quote-card' | 'speaker-highlight' | 'countdown'
  template?: 'minimal' | 'bold' | 'gradient'
}
```

---

## Recommendations

### 1. Add AI Blog Generation
**Priority: HIGH**
- Natural extension of existing functionality
- High value for event organizers
- Leverages existing data model
- Differentiator from other tools

**MVP Features:**
- Speaker spotlight blog generation
- Event preview articles
- Export to Markdown/HTML
- Basic SEO metadata

### 2. Enhance Social Media AI
**Priority: MEDIUM**
- Build on existing announcement system
- Add content variations (3-5 versions)
- Platform-specific optimization
- Hashtag suggestions
- Emoji recommendations

### 3. Visual Content Generation
**Priority: LOW (Future)**
- Requires image generation service
- More complex implementation
- Could use speaker images + AI overlay text
- Quote cards, highlight graphics

### 4. Smart Scheduling
**Priority: MEDIUM**
- AI suggests optimal posting times
- Based on platform best practices
- Audience engagement patterns
- Could integrate with scheduling system

---

## Technical Debt & Future Enhancements

### Current Gaps
1. No visual content generation (quote cards, graphics)
2. Limited analytics (post tracking exists, but no insights)
3. No content variation/A/B testing
4. Manual timezone handling (could be smarter)
5. No bulk operations (upload 10 speakers at once)

### Recommended Next Steps
1. **Blog Generation System** - High ROI, natural extension
2. **Enhanced AI Variations** - Multiple announcement versions
3. **Analytics Dashboard** - Track post performance
4. **Bulk Import** - CSV upload for speakers
5. **Template Library** - User-created reusable templates
6. **Webhook Integration** - Connect to Zapier, Make.com

---

## Conclusion

This is a **well-architected, production-ready platform** for event organizers with:
- ✅ Clean architecture (Repository → Service → API)
- ✅ Strong security (RLS, auth, validation)
- ✅ AI-powered content generation
- ✅ Multi-platform social media integration
- ✅ Robust image management
- ✅ Scheduled posting with retry logic

**Key Opportunity:** **Add AI blog generation** - This would significantly increase value by providing long-form content for event marketing, leveraging all existing data and infrastructure.

**Current AI Social Posts:** Already implemented and working well. Could be enhanced with variations, visual generation, and smarter scheduling.

The foundation is solid for expanding into AI-generated blogs and more sophisticated social media content creation.
