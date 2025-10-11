# Speaker Announcement Prompts - Usage Guide

This guide explains how to use the two announcement prompt templates for creating initial and follow-up speaker announcements.

## Available Prompts

### 1. Initial Announcement (`speaker-announcement.ts`)
Use this for the **first announcement** about a speaker/session.

### 2. Follow-Up/Reminder Announcement (`speaker-announcement-reminder.ts`)
Use this for **subsequent announcements** that remind people about the upcoming event with urgency messaging.

---

## How to Use the Reminder Prompt

### Basic Usage

```typescript
import { speakerAnnouncementReminderPrompt } from "@/app/prompts/announcements/speaker-announcement-reminder";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

// Calculate days until event
const eventDate = new Date(event.date);
const today = new Date();
const daysUntilEvent = Math.ceil(
  (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
);

// Get the original announcement (from database or previous generation)
const originalAnnouncement = "..."; // Fetch from your announcements table

// Generate the reminder prompt
const prompt = speakerAnnouncementReminderPrompt(
  speaker,
  event,
  daysUntilEvent,
  originalAnnouncement
);

// Generate the follow-up announcement
const { text } = await generateText({
  model: anthropic("claude-sonnet-4-5-20250929"),
  messages: [
    {
      role: "user",
      content: prompt,
    },
  ],
});

console.log("Follow-up announcement:", text);
```

---

## API Route Example

Here's how to extend the existing `/api/announcements/generate` route to support reminder announcements:

```typescript
// app/api/announcements/generate/route.ts

import { speakerAnnouncementPrompt } from "@/app/prompts/announcements/speaker-announcement";
import { speakerAnnouncementReminderPrompt } from "@/app/prompts/announcements/speaker-announcement-reminder";

interface GenerateAnnouncementRequest {
  speaker: SpeakerType;
  event: EventType;
  platform?: "linkedin" | "twitter" | "instagram";
  template?: "pre-event" | "day-of" | "post-event" | "custom";
  save?: boolean;
  // New fields for reminder announcements
  isReminder?: boolean;
  originalAnnouncementId?: number; // ID of the first announcement
}

export async function POST(req: NextRequest) {
  // ... authentication code ...

  const {
    speaker,
    event,
    platform = "linkedin",
    template = "pre-event",
    save = false,
    isReminder = false,
    originalAnnouncementId,
  } = body;

  let prompt: string;

  if (isReminder && originalAnnouncementId) {
    // Calculate days until event
    const eventDate = new Date(event.date);
    const today = new Date();
    const daysUntilEvent = Math.ceil(
      (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Fetch original announcement from database
    const { data: originalAnnouncement } = await supabase
      .from("announcements")
      .select("announcement_text")
      .eq("id", originalAnnouncementId)
      .single();

    if (!originalAnnouncement) {
      return NextResponse.json(
        { error: "Original announcement not found" },
        { status: 404 }
      );
    }

    // Use reminder prompt
    prompt = speakerAnnouncementReminderPrompt(
      speaker,
      event,
      daysUntilEvent,
      originalAnnouncement.announcement_text
    );
  } else {
    // Use standard prompt for initial announcement
    prompt = speakerAnnouncementPrompt(speaker, event);
  }

  // Generate announcement using Claude
  const { text } = await generateText({
    model: anthropic(ANTHROPIC_MODELS["claude-sonnet-4.5"]),
    messages: [{ role: "user", content: prompt }],
  });

  // ... rest of the code ...
}
```

---

## Recommended Announcement Schedule

For maximum engagement, send multiple announcements with decreasing intervals:

| Days Before Event | Announcement Type | Tone |
|-------------------|-------------------|------|
| 14 days | Initial | Informative, exciting |
| 7 days | Reminder #1 | Building excitement |
| 3 days | Reminder #2 | Urgent, FOMO |
| 1 day | Final Reminder | Very urgent, last call |

### Example Schedule Implementation

```typescript
async function scheduleAnnouncementCampaign(
  speaker: SpeakerType,
  event: EventType,
  platform: "linkedin" | "twitter" | "instagram"
) {
  const eventDate = new Date(event.date);

  // 1. Generate initial announcement (14 days before)
  const initialPrompt = speakerAnnouncementPrompt(speaker, event);
  const { text: initialAnnouncement } = await generateText({
    model: anthropic("claude-sonnet-4-5-20250929"),
    messages: [{ role: "user", content: initialPrompt }],
  });

  // Save initial announcement
  const savedInitial = await announcementService.createAnnouncement({
    speakerId: speaker.id,
    eventId: event.id,
    announcementText: initialAnnouncement,
    platform,
    template: "pre-event",
    userId: user.id,
  });

  // 2. Schedule 7-day reminder
  const reminder7Days = speakerAnnouncementReminderPrompt(
    speaker,
    event,
    7,
    initialAnnouncement
  );
  const { text: reminder7Text } = await generateText({
    model: anthropic("claude-sonnet-4-5-20250929"),
    messages: [{ role: "user", content: reminder7Days }],
  });

  await scheduledPostService.schedulePost({
    announcementId: savedInitial.id,
    speakerId: speaker.id,
    eventId: event.id,
    scheduledTime: new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000),
    platform,
    postText: reminder7Text,
    userId: user.id,
  });

  // 3. Schedule 3-day reminder
  const reminder3Days = speakerAnnouncementReminderPrompt(
    speaker,
    event,
    3,
    initialAnnouncement
  );
  const { text: reminder3Text } = await generateText({
    model: anthropic("claude-sonnet-4-5-20250929"),
    messages: [{ role: "user", content: reminder3Days }],
  });

  await scheduledPostService.schedulePost({
    announcementId: savedInitial.id,
    speakerId: speaker.id,
    eventId: event.id,
    scheduledTime: new Date(eventDate.getTime() - 3 * 24 * 60 * 60 * 1000),
    platform,
    postText: reminder3Text,
    userId: user.id,
  });

  // 4. Schedule 1-day reminder
  const reminder1Day = speakerAnnouncementReminderPrompt(
    speaker,
    event,
    1,
    initialAnnouncement
  );
  const { text: reminder1Text } = await generateText({
    model: anthropic("claude-sonnet-4-5-20250929"),
    messages: [{ role: "user", content: reminder1Day }],
  });

  await scheduledPostService.schedulePost({
    announcementId: savedInitial.id,
    speakerId: speaker.id,
    eventId: event.id,
    scheduledTime: new Date(eventDate.getTime() - 1 * 24 * 60 * 60 * 1000),
    platform,
    postText: reminder1Text,
    userId: user.id,
  });

  return {
    initialAnnouncement: savedInitial,
    scheduledReminders: 3,
  };
}
```

---

## Key Differences Between Prompts

| Feature | Initial Prompt | Reminder Prompt |
|---------|---------------|-----------------|
| **Time urgency** | Not emphasized | **REQUIRED** in first sentence |
| **Original announcement** | N/A | Provided for reference (do not copy) |
| **Tone** | Informative, exciting | Urgent, FOMO-driven |
| **Phrasing** | Fresh content | Must reword original |
| **Examples** | 1 comprehensive example | 3 examples (7-day, 3-day, 1-day) |

---

## Best Practices

1. **Always save the initial announcement** - You'll need it for generating reminders
2. **Calculate days dynamically** - Don't hardcode the days until event
3. **Vary the platform** - Different platforms may need different announcement styles
4. **Test character limits** - Each platform has different limits (LinkedIn: 3000, X: 25000, Instagram: 2200)
5. **Space out announcements** - Don't spam your audience
6. **Personalize timing** - Consider your audience's timezone and habits

---

## Error Handling

```typescript
try {
  const daysUntilEvent = Math.ceil(
    (new Date(event.date).getTime() - new Date().getTime()) /
    (1000 * 60 * 60 * 24)
  );

  // Don't send reminders for past events
  if (daysUntilEvent < 0) {
    throw new Error("Event date has passed");
  }

  // Don't send reminders for events too far in the future
  if (daysUntilEvent > 30) {
    throw new Error("Event is too far in the future for a reminder");
  }

  const prompt = speakerAnnouncementReminderPrompt(
    speaker,
    event,
    daysUntilEvent,
    originalAnnouncement
  );

  // ... generate text ...
} catch (error) {
  console.error("Error generating reminder:", error);
  // Handle error appropriately
}
```

---

## Testing

```typescript
// Test with different day values
const testCases = [
  { days: 7, expected: "One week from today" },
  { days: 3, expected: "Just 3 days left" },
  { days: 1, expected: "TOMORROW" },
];

for (const { days, expected } of testCases) {
  const prompt = speakerAnnouncementReminderPrompt(
    mockSpeaker,
    mockEvent,
    days,
    mockOriginalAnnouncement
  );

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-5-20250929"),
    messages: [{ role: "user", content: prompt }],
  });

  console.log(`\n=== ${days} days test ===`);
  console.log(text);

  // Verify urgency language is present
  const hasUrgency =
    text.toLowerCase().includes(days.toString()) ||
    text.toLowerCase().includes("tomorrow") ||
    text.toLowerCase().includes("today");

  console.assert(hasUrgency, `Missing urgency language for ${days} days`);
}
```

---

## Next Steps

1. Integrate the reminder prompt into your drip campaign service
2. Update your API routes to support reminder generation
3. Create a UI for users to preview and schedule reminders
4. Test with real events and speakers
5. Monitor engagement metrics to optimize timing

For questions or issues, refer to the inline documentation in the prompt files.
