-- Create speaker_images table
CREATE TABLE speaker_images (
  id BIGSERIAL PRIMARY KEY,
  speaker_id BIGINT NOT NULL REFERENCES speakers(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_speaker_images_speaker_id ON speaker_images(speaker_id);
CREATE INDEX idx_speaker_images_is_primary ON speaker_images(is_primary) WHERE is_primary = true;
CREATE INDEX idx_speaker_images_user_id ON speaker_images(user_id);

-- Create updated_at trigger
CREATE TRIGGER update_speaker_images_updated_at
  BEFORE UPDATE ON speaker_images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE speaker_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own speaker images
CREATE POLICY "Users can view their own speaker images"
  ON speaker_images FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own speaker images"
  ON speaker_images FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own speaker images"
  ON speaker_images FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own speaker images"
  ON speaker_images FOR DELETE
  USING (auth.uid() = user_id);

-- Add primary_image_id to speakers table
ALTER TABLE speakers
  ADD COLUMN primary_image_id BIGINT REFERENCES speaker_images(id) ON DELETE SET NULL;

CREATE INDEX idx_speakers_primary_image_id ON speakers(primary_image_id);

-- Create storage bucket for speaker images
INSERT INTO storage.buckets (id, name, public)
VALUES ('speaker-images', 'speaker-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: Allow authenticated users to upload to their own folders
CREATE POLICY "Users can upload speaker images to their own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'speaker-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to read all speaker images (bucket is public)
CREATE POLICY "Public can view speaker images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'speaker-images');

-- Allow users to delete their own speaker images
CREATE POLICY "Users can delete their own speaker images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'speaker-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to update their own speaker images
CREATE POLICY "Users can update their own speaker images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'speaker-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
