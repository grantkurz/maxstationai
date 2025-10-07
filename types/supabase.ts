export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      announcements: {
        Row: {
          id: number
          created_at: string
          updated_at: string
          user_id: string
          speaker_id: number
          event_id: number
          announcement_text: string
          platform: "linkedin" | "twitter" | "instagram"
          template: "pre-event" | "day-of" | "post-event" | "custom"
          character_count: number
        }
        Insert: {
          id?: number
          created_at?: string
          updated_at?: string
          user_id: string
          speaker_id: number
          event_id: number
          announcement_text: string
          platform: "linkedin" | "twitter" | "instagram"
          template: "pre-event" | "day-of" | "post-event" | "custom"
          character_count: number
        }
        Update: {
          id?: number
          created_at?: string
          updated_at?: string
          user_id?: string
          speaker_id?: number
          event_id?: number
          announcement_text?: string
          platform?: "linkedin" | "twitter" | "instagram"
          template?: "pre-event" | "day-of" | "post-event" | "custom"
          character_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "announcements_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_speaker_id_fkey"
            columns: ["speaker_id"]
            referencedRelation: "speakers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_event_id_fkey"
            columns: ["event_id"]
            referencedRelation: "events"
            referencedColumns: ["id"]
          }
        ]
      }
      credits: {
        Row: {
          created_at: string
          credits: number
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          id?: number
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credits_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      events: {
        Row: {
          id: number
          created_at: string
          updated_at: string
          user_id: string
          title: string
          date: string
          location: string
          start_time: string
          end_time: string
          description: string | null
          timezone: string
          type: string
          ticket_url: string | null
        }
        Insert: {
          id?: number
          created_at?: string
          updated_at?: string
          user_id: string
          title: string
          date: string
          location: string
          start_time: string
          end_time: string
          description?: string | null
          timezone?: string
          type?: string
          ticket_url?: string | null
        }
        Update: {
          id?: number
          created_at?: string
          updated_at?: string
          user_id?: string
          title?: string
          date?: string
          location?: string
          start_time?: string
          end_time?: string
          description?: string | null
          timezone?: string
          type?: string
          ticket_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      images: {
        Row: {
          created_at: string
          id: number
          modelId: number
          uri: string
        }
        Insert: {
          created_at?: string
          id?: number
          modelId: number
          uri: string
        }
        Update: {
          created_at?: string
          id?: number
          modelId?: number
          uri?: string
        }
        Relationships: [
          {
            foreignKeyName: "images_modelId_fkey"
            columns: ["modelId"]
            referencedRelation: "models"
            referencedColumns: ["id"]
          }
        ]
      }
      models: {
        Row: {
          created_at: string
          id: number
          modelId: string | null
          name: string | null
          status: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          modelId?: string | null
          name?: string | null
          status?: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          modelId?: string | null
          name?: string | null
          status?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "models_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      samples: {
        Row: {
          created_at: string
          id: number
          modelId: number
          uri: string
        }
        Insert: {
          created_at?: string
          id?: number
          modelId: number
          uri: string
        }
        Update: {
          created_at?: string
          id?: number
          modelId?: number
          uri?: string
        }
        Relationships: [
          {
            foreignKeyName: "samples_modelId_fkey"
            columns: ["modelId"]
            referencedRelation: "models"
            referencedColumns: ["id"]
          }
        ]
      }
      speakers: {
        Row: {
          id: number
          created_at: string
          updated_at: string
          event_id: number
          name: string
          speaker_title: string
          speaker_bio: string | null
          session_title: string
          session_description: string | null
        }
        Insert: {
          id?: number
          created_at?: string
          updated_at?: string
          event_id: number
          name: string
          speaker_title: string
          speaker_bio?: string | null
          session_title: string
          session_description?: string | null
        }
        Update: {
          id?: number
          created_at?: string
          updated_at?: string
          event_id?: number
          name?: string
          speaker_title?: string
          speaker_bio?: string | null
          session_title?: string
          session_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "speakers_event_id_fkey"
            columns: ["event_id"]
            referencedRelation: "events"
            referencedColumns: ["id"]
          }
        ]
      }
      scheduled_posts: {
        Row: {
          id: number
          created_at: string
          updated_at: string
          user_id: string
          announcement_id: number
          speaker_id: number
          event_id: number
          scheduled_time: string
          timezone: string
          platform: "linkedin" | "twitter" | "instagram"
          status: "pending" | "posted" | "failed" | "cancelled"
          post_text: string
          image_url: string | null
          posted_at: string | null
          posted_urn: string | null
          error_message: string | null
          retry_count: number
          last_retry_at: string | null
        }
        Insert: {
          id?: number
          created_at?: string
          updated_at?: string
          user_id: string
          announcement_id: number
          speaker_id: number
          event_id: number
          scheduled_time: string
          timezone?: string
          platform: "linkedin" | "twitter" | "instagram"
          status?: "pending" | "posted" | "failed" | "cancelled"
          post_text: string
          image_url?: string | null
          posted_at?: string | null
          posted_urn?: string | null
          error_message?: string | null
          retry_count?: number
          last_retry_at?: string | null
        }
        Update: {
          id?: number
          created_at?: string
          updated_at?: string
          user_id?: string
          announcement_id?: number
          speaker_id?: number
          event_id?: number
          scheduled_time?: string
          timezone?: string
          platform?: "linkedin" | "twitter" | "instagram"
          status?: "pending" | "posted" | "failed" | "cancelled"
          post_text?: string
          image_url?: string | null
          posted_at?: string | null
          posted_urn?: string | null
          error_message?: string | null
          retry_count?: number
          last_retry_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_announcement_id_fkey"
            columns: ["announcement_id"]
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_speaker_id_fkey"
            columns: ["speaker_id"]
            referencedRelation: "speakers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_event_id_fkey"
            columns: ["event_id"]
            referencedRelation: "events"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
