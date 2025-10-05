/**
 * Example usage of the Speaker AI API routes
 * This file demonstrates how to use both endpoints from a client component
 */

// ============================================================================
// EXAMPLE 1: Extract text from a PDF file
// ============================================================================

export async function extractTextFromFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/extract-text', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to extract text');
    }

    const { text } = await response.json();
    return text;
  } catch (error) {
    console.error('Error extracting text:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 2: Parse speaker text into structured data
// ============================================================================

export interface SpeakerData {
  name: string;
  speaker_title: string;
  speaker_bio: string;
  session_title: string;
  session_description: string;
}

export async function parseSpeakerText(text: string): Promise<SpeakerData> {
  try {
    const response = await fetch('/api/parse-speaker-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to parse speaker text');
    }

    const speakerData = await response.json();
    return speakerData;
  } catch (error) {
    console.error('Error parsing speaker text:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 3: Complete workflow - Upload file and parse into speaker data
// ============================================================================

export async function processUploadedFile(
  file: File
): Promise<SpeakerData | null> {
  try {
    // Step 1: Extract text from the uploaded file
    console.log('Extracting text from file...');
    const extractedText = await extractTextFromFile(file);

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No text could be extracted from the file');
    }

    // Step 2: Parse the extracted text into structured speaker data
    console.log('Parsing speaker information...');
    const speakerData = await parseSpeakerText(extractedText);

    return speakerData;
  } catch (error) {
    console.error('Error processing file:', error);
    return null;
  }
}

// ============================================================================
// EXAMPLE 4: React Hook for form integration
// ============================================================================

import { useState } from 'react';

export function useSpeakerAI() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractAndParse = async (file: File): Promise<SpeakerData | null> => {
    setError(null);
    setIsExtracting(true);

    try {
      // Extract text
      const text = await extractTextFromFile(file);
      setIsExtracting(false);

      // Parse text
      setIsParsing(true);
      const speakerData = await parseSpeakerText(text);
      setIsParsing(false);

      return speakerData;
    } catch (err) {
      setIsExtracting(false);
      setIsParsing(false);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return null;
    }
  };

  const parseTextOnly = async (text: string): Promise<SpeakerData | null> => {
    setError(null);
    setIsParsing(true);

    try {
      const speakerData = await parseSpeakerText(text);
      setIsParsing(false);
      return speakerData;
    } catch (err) {
      setIsParsing(false);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return null;
    }
  };

  return {
    extractAndParse,
    parseTextOnly,
    isExtracting,
    isParsing,
    isLoading: isExtracting || isParsing,
    error,
  };
}

// ============================================================================
// EXAMPLE 5: React Component Usage
// ============================================================================

/*
'use client';

import { useState } from 'react';
import { useSpeakerAI } from './USAGE_EXAMPLE';

export function SpeakerForm() {
  const { extractAndParse, parseTextOnly, isLoading, error } = useSpeakerAI();
  const [formData, setFormData] = useState({
    name: '',
    speaker_title: '',
    speaker_bio: '',
    session_title: '',
    session_description: '',
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const speakerData = await extractAndParse(file);
    if (speakerData) {
      setFormData(speakerData);
    }
  };

  const handleTextParse = async (text: string) => {
    const speakerData = await parseTextOnly(text);
    if (speakerData) {
      setFormData(speakerData);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept=".pdf,image/*"
        onChange={handleFileUpload}
        disabled={isLoading}
      />

      {isLoading && <p>Processing...</p>}
      {error && <p className="text-red-500">{error}</p>}

      <form>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Speaker Name"
        />
        // ... other form fields
      </form>
    </div>
  );
}
*/
