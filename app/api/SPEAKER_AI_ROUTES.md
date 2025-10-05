# Speaker Form AI API Routes

Two AI-powered API routes for enhancing the speaker form with text extraction and parsing capabilities.

## Prerequisites

Set the `ANTHROPIC_API_KEY` environment variable in your `.env.local` file:

```bash
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

## Routes

### 1. `/api/extract-text` (POST)

Extracts text from PDF or image files using Claude AI.

**Authentication**: Required (Supabase auth)

**Request**:
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: FormData with a `file` field

**Supported File Types**:
- PDF (`application/pdf`)
- JPEG/JPG (`image/jpeg`, `image/jpg`)
- PNG (`image/png`)
- GIF (`image/gif`)
- WebP (`image/webp`)

**Response**:
```json
{
  "text": "Extracted text from the file..."
}
```

**Error Responses**:
- `401`: Unauthorized (user not authenticated)
- `400`: Invalid file type or no file provided
- `500`: AI service not configured or extraction failed

**Example Usage** (Client-side):
```typescript
const formData = new FormData();
formData.append('file', file);

const response = await fetch('/api/extract-text', {
  method: 'POST',
  body: formData,
});

const { text } = await response.json();
```

---

### 2. `/api/parse-speaker-text` (POST)

Parses raw text into structured speaker and session data using Claude AI.

**Authentication**: Required (Supabase auth)

**Request**:
- Method: `POST`
- Content-Type: `application/json`
- Body:
```json
{
  "text": "Raw text to parse..."
}
```

**Response**:
```json
{
  "name": "John Doe",
  "speaker_title": "Senior Software Engineer at Tech Corp",
  "speaker_bio": "John is a software engineer with 10 years of experience...",
  "session_title": "Building Scalable APIs",
  "session_description": "Learn how to design and build APIs that scale..."
}
```

**Schema**:
- `name`: Speaker's full name
- `speaker_title`: Job title, role, or professional designation
- `speaker_bio`: Biography and expertise description
- `session_title`: Title of the talk/session
- `session_description`: Description of session content

**Error Responses**:
- `401`: Unauthorized (user not authenticated)
- `400`: Missing or invalid text field
- `500`: AI service not configured or parsing failed

**Example Usage** (Client-side):
```typescript
const response = await fetch('/api/parse-speaker-text', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ text: extractedText }),
});

const speakerData = await response.json();
```

---

## Combined Workflow Example

```typescript
// Step 1: Extract text from uploaded file
const formData = new FormData();
formData.append('file', pdfFile);

const extractResponse = await fetch('/api/extract-text', {
  method: 'POST',
  body: formData,
});

const { text } = await extractResponse.json();

// Step 2: Parse extracted text into structured data
const parseResponse = await fetch('/api/parse-speaker-text', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ text }),
});

const speakerData = await parseResponse.json();

// Step 3: Use speakerData to populate form fields
// speakerData will contain: name, speaker_title, speaker_bio, session_title, session_description
```

## Technical Details

- **AI Model**: Claude 3.5 Sonnet (`claude-3-5-sonnet-20241022`)
- **AI SDK**: Vercel AI SDK v5 with Anthropic provider
- **Authentication**: Supabase auth helpers
- **File Processing**: Base64 encoding for AI analysis
- **Structured Output**: Zod schema validation for parsed data

## Error Handling

Both routes include comprehensive error handling:
- Authentication validation
- API key configuration checks
- Input validation
- File type validation
- AI processing error handling
- Detailed error messages for debugging

## Security Considerations

- All routes require authentication via Supabase auth
- API key is validated before processing requests
- File types are strictly validated
- Input is sanitized and validated
- No sensitive data is logged in production errors
