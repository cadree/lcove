export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_project_matches: {
        Row: {
          created_at: string
          id: string
          is_dismissed: boolean
          match_reasons: Json | null
          match_score: number
          project_id: string
          role_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_dismissed?: boolean
          match_reasons?: Json | null
          match_score?: number
          project_id: string
          role_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_dismissed?: boolean
          match_reasons?: Json | null
          match_score?: number
          project_id?: string
          role_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_project_matches_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_project_matches_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "project_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      book_bookmarks: {
        Row: {
          created_at: string
          id: string
          page_number: number
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          page_number: number
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          page_number?: number
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      book_highlights: {
        Row: {
          created_at: string
          highlighted_text: string
          id: string
          is_important: boolean | null
          page_number: number
          user_id: string
        }
        Insert: {
          created_at?: string
          highlighted_text: string
          id?: string
          is_important?: boolean | null
          page_number: number
          user_id: string
        }
        Update: {
          created_at?: string
          highlighted_text?: string
          id?: string
          is_important?: boolean | null
          page_number?: number
          user_id?: string
        }
        Relationships: []
      }
      book_notes: {
        Row: {
          created_at: string
          id: string
          note_text: string
          page_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_text: string
          page_number: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_text?: string
          page_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      book_reading_progress: {
        Row: {
          created_at: string
          current_page: number
          id: string
          last_read_at: string
          total_pages: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_page?: number
          id?: string
          last_read_at?: string
          total_pages?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_page?: number
          id?: string
          last_read_at?: string
          total_pages?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      brand_partnerships: {
        Row: {
          brand_logo_url: string | null
          brand_name: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          partnership_type: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          brand_logo_url?: string | null
          brand_name: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          partnership_type?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          brand_logo_url?: string | null
          brand_name?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          partnership_type?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      calendar_reminders: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          personal_item_id: string | null
          project_id: string | null
          reminder_time: string
          sent: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          personal_item_id?: string | null
          project_id?: string | null
          reminder_time: string
          sent?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          personal_item_id?: string | null
          project_id?: string | null
          reminder_time?: string
          sent?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_reminders_personal_item_id_fkey"
            columns: ["personal_item_id"]
            isOneToOne: false
            referencedRelation: "personal_calendar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_reminders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          is_muted: boolean | null
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_muted?: boolean | null
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_muted?: boolean | null
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          id: string
          name: string | null
          type: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          id?: string
          name?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      creative_roles: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      creator_verifications: {
        Row: {
          applied_at: string
          badge_label: string | null
          created_at: string
          id: string
          notes: string | null
          portfolio_urls: string[] | null
          reviewed_at: string | null
          reviewed_by: string | null
          social_links: Json | null
          status: string
          updated_at: string
          user_id: string
          verification_type: string
        }
        Insert: {
          applied_at?: string
          badge_label?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          portfolio_urls?: string[] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_links?: Json | null
          status?: string
          updated_at?: string
          user_id: string
          verification_type?: string
        }
        Update: {
          applied_at?: string
          badge_label?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          portfolio_urls?: string[] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_links?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
          verification_type?: string
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string
          id: string
          reference_id: string | null
          reference_type: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      escrow_holdings: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          milestone_id: string | null
          payee_id: string
          payer_id: string
          project_id: string
          released_at: string | null
          status: string
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          milestone_id?: string | null
          payee_id: string
          payer_id: string
          project_id: string
          released_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          milestone_id?: string | null
          payee_id?: string
          payer_id?: string
          project_id?: string
          released_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_holdings_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "project_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_holdings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          created_at: string
          credits_spent: number | null
          event_id: string
          id: string
          reminder_enabled: boolean | null
          status: string
          stripe_payment_id: string | null
          ticket_purchased: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_spent?: number | null
          event_id: string
          id?: string
          reminder_enabled?: boolean | null
          status?: string
          stripe_payment_id?: string | null
          ticket_purchased?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_spent?: number | null
          event_id?: string
          id?: string
          reminder_enabled?: boolean | null
          status?: string
          stripe_payment_id?: string | null
          ticket_purchased?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          capacity: number | null
          city: string
          country: string | null
          created_at: string
          creator_id: string
          credits_price: number | null
          description: string | null
          end_date: string | null
          id: string
          image_url: string | null
          is_public: boolean | null
          start_date: string
          state: string | null
          ticket_price: number | null
          ticket_type: string
          title: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          city: string
          country?: string | null
          created_at?: string
          creator_id: string
          credits_price?: number | null
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_public?: boolean | null
          start_date: string
          state?: string | null
          ticket_price?: number | null
          ticket_type?: string
          title: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          address?: string | null
          capacity?: number | null
          city?: string
          country?: string | null
          created_at?: string
          creator_id?: string
          credits_price?: number | null
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_public?: boolean | null
          start_date?: string
          state?: string | null
          ticket_price?: number | null
          ticket_type?: string
          title?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      featured_creators: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          display_order: number
          end_date: string | null
          feature_type: string
          id: string
          is_active: boolean
          start_date: string
          title: string | null
          user_id: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          end_date?: string | null
          feature_type?: string
          id?: string
          is_active?: boolean
          start_date?: string
          title?: string | null
          user_id: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          end_date?: string | null
          feature_type?: string
          id?: string
          is_active?: boolean
          start_date?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      live_streams: {
        Row: {
          created_at: string
          description: string | null
          ended_at: string | null
          external_url: string | null
          host_id: string
          id: string
          is_live: boolean | null
          started_at: string | null
          stream_type: string
          thumbnail_url: string | null
          title: string
          total_tips: number | null
          viewer_count: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          external_url?: string | null
          host_id: string
          id?: string
          is_live?: boolean | null
          started_at?: string | null
          stream_type: string
          thumbnail_url?: string | null
          title: string
          total_tips?: number | null
          viewer_count?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          external_url?: string | null
          host_id?: string
          id?: string
          is_live?: boolean | null
          started_at?: string | null
          stream_type?: string
          thumbnail_url?: string | null
          title?: string
          total_tips?: number | null
          viewer_count?: number | null
        }
        Relationships: []
      }
      membership_contributions: {
        Row: {
          allocated_to: Json | null
          amount: number
          created_at: string
          id: string
          membership_id: string | null
          period_end: string
          period_start: string
          stripe_invoice_id: string | null
          user_id: string
        }
        Insert: {
          allocated_to?: Json | null
          amount: number
          created_at?: string
          id?: string
          membership_id?: string | null
          period_end: string
          period_start: string
          stripe_invoice_id?: string | null
          user_id: string
        }
        Update: {
          allocated_to?: Json | null
          amount?: number
          created_at?: string
          id?: string
          membership_id?: string | null
          period_end?: string
          period_start?: string
          stripe_invoice_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_contributions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          grant_eligible: boolean | null
          id: string
          lifetime_contribution: number | null
          monthly_amount: number | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grant_eligible?: boolean | null
          id?: string
          lifetime_contribution?: number | null
          monthly_amount?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grant_eligible?: boolean | null
          id?: string
          lifetime_contribution?: number | null
          monthly_amount?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      message_read_receipts: {
        Row: {
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          id: string
          media_type: string | null
          media_url: string | null
          reply_to_id: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          reply_to_id?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          reply_to_id?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      music_profiles: {
        Row: {
          albums: Json | null
          apple_music_artist_id: string | null
          apple_music_artist_url: string | null
          artist_image_url: string | null
          created_at: string
          display_name: string | null
          genres: string[] | null
          id: string
          latest_release: Json | null
          spotify_artist_id: string | null
          spotify_artist_url: string | null
          top_tracks: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          albums?: Json | null
          apple_music_artist_id?: string | null
          apple_music_artist_url?: string | null
          artist_image_url?: string | null
          created_at?: string
          display_name?: string | null
          genres?: string[] | null
          id?: string
          latest_release?: Json | null
          spotify_artist_id?: string | null
          spotify_artist_url?: string | null
          top_tracks?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          albums?: Json | null
          apple_music_artist_id?: string | null
          apple_music_artist_url?: string | null
          artist_image_url?: string | null
          created_at?: string
          display_name?: string | null
          genres?: string[] | null
          id?: string
          latest_release?: Json | null
          spotify_artist_id?: string | null
          spotify_artist_url?: string | null
          top_tracks?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          comments_enabled: boolean | null
          created_at: string
          email_enabled: boolean | null
          event_reminders_enabled: boolean | null
          id: string
          likes_enabled: boolean | null
          live_streams_enabled: boolean | null
          messages_enabled: boolean | null
          project_invites_enabled: boolean | null
          push_enabled: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comments_enabled?: boolean | null
          created_at?: string
          email_enabled?: boolean | null
          event_reminders_enabled?: boolean | null
          id?: string
          likes_enabled?: boolean | null
          live_streams_enabled?: boolean | null
          messages_enabled?: boolean | null
          project_invites_enabled?: boolean | null
          push_enabled?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comments_enabled?: boolean | null
          created_at?: string
          email_enabled?: boolean | null
          event_reminders_enabled?: boolean | null
          id?: string
          likes_enabled?: boolean | null
          live_streams_enabled?: boolean | null
          messages_enabled?: boolean | null
          project_invites_enabled?: boolean | null
          push_enabled?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      passions: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      payout_methods: {
        Row: {
          brand: string | null
          created_at: string
          id: string
          is_default: boolean
          last_four: string | null
          metadata: Json | null
          stripe_bank_account_id: string | null
          stripe_payment_method_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          last_four?: string | null
          metadata?: Json | null
          stripe_bank_account_id?: string | null
          stripe_payment_method_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          last_four?: string | null
          metadata?: Json | null
          stripe_bank_account_id?: string | null
          stripe_payment_method_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          currency: string
          error_message: string | null
          id: string
          payout_method_id: string | null
          project_id: string | null
          role_id: string | null
          status: string
          stripe_payout_id: string | null
          stripe_transfer_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          error_message?: string | null
          id?: string
          payout_method_id?: string | null
          project_id?: string | null
          role_id?: string | null
          status?: string
          stripe_payout_id?: string | null
          stripe_transfer_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          error_message?: string | null
          id?: string
          payout_method_id?: string | null
          project_id?: string | null
          role_id?: string | null
          status?: string
          stripe_payout_id?: string | null
          stripe_transfer_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_payout_method_id_fkey"
            columns: ["payout_method_id"]
            isOneToOne: false
            referencedRelation: "payout_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_calendar_items: {
        Row: {
          all_day: boolean | null
          color: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          location: string | null
          reminder_minutes: number | null
          start_date: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean | null
          color?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          reminder_minutes?: number | null
          start_date: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean | null
          color?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          reminder_minutes?: number | null
          start_date?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          alt_text: string | null
          collaborators: string[] | null
          comments_enabled: boolean | null
          content: string | null
          created_at: string
          id: string
          location: string | null
          media_type: string | null
          media_url: string | null
          user_id: string
        }
        Insert: {
          alt_text?: string | null
          collaborators?: string[] | null
          comments_enabled?: boolean | null
          content?: string | null
          created_at?: string
          id?: string
          location?: string | null
          media_type?: string | null
          media_url?: string | null
          user_id: string
        }
        Update: {
          alt_text?: string | null
          collaborators?: string[] | null
          comments_enabled?: boolean | null
          content?: string | null
          created_at?: string
          id?: string
          location?: string | null
          media_type?: string | null
          media_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profile_customizations: {
        Row: {
          accent_color_override: string | null
          background_blur: number | null
          background_opacity: number | null
          background_type: string | null
          background_value: string | null
          created_at: string
          custom_font: string | null
          effect_grain: boolean | null
          effect_holographic: boolean | null
          effect_motion_gradient: boolean | null
          effect_neon_glow: boolean | null
          effect_scanlines: boolean | null
          id: string
          music_visualizer_enabled: boolean | null
          overlay_opacity: number | null
          overlay_tint: string | null
          profile_music_album_art_url: string | null
          profile_music_album_name: string | null
          profile_music_artist: string | null
          profile_music_enabled: boolean | null
          profile_music_external_id: string | null
          profile_music_preview_url: string | null
          profile_music_source: string | null
          profile_music_title: string | null
          profile_music_url: string | null
          profile_music_volume: number | null
          section_order: string[] | null
          show_top_friends: boolean | null
          theme_accent_color: string | null
          theme_preset: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_color_override?: string | null
          background_blur?: number | null
          background_opacity?: number | null
          background_type?: string | null
          background_value?: string | null
          created_at?: string
          custom_font?: string | null
          effect_grain?: boolean | null
          effect_holographic?: boolean | null
          effect_motion_gradient?: boolean | null
          effect_neon_glow?: boolean | null
          effect_scanlines?: boolean | null
          id?: string
          music_visualizer_enabled?: boolean | null
          overlay_opacity?: number | null
          overlay_tint?: string | null
          profile_music_album_art_url?: string | null
          profile_music_album_name?: string | null
          profile_music_artist?: string | null
          profile_music_enabled?: boolean | null
          profile_music_external_id?: string | null
          profile_music_preview_url?: string | null
          profile_music_source?: string | null
          profile_music_title?: string | null
          profile_music_url?: string | null
          profile_music_volume?: number | null
          section_order?: string[] | null
          show_top_friends?: boolean | null
          theme_accent_color?: string | null
          theme_preset?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_color_override?: string | null
          background_blur?: number | null
          background_opacity?: number | null
          background_type?: string | null
          background_value?: string | null
          created_at?: string
          custom_font?: string | null
          effect_grain?: boolean | null
          effect_holographic?: boolean | null
          effect_motion_gradient?: boolean | null
          effect_neon_glow?: boolean | null
          effect_scanlines?: boolean | null
          id?: string
          music_visualizer_enabled?: boolean | null
          overlay_opacity?: number | null
          overlay_tint?: string | null
          profile_music_album_art_url?: string | null
          profile_music_album_name?: string | null
          profile_music_artist?: string | null
          profile_music_enabled?: boolean | null
          profile_music_external_id?: string | null
          profile_music_preview_url?: string | null
          profile_music_source?: string | null
          profile_music_title?: string | null
          profile_music_url?: string | null
          profile_music_volume?: number | null
          section_order?: string[] | null
          show_top_friends?: boolean | null
          theme_accent_color?: string | null
          theme_preset?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"] | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string | null
          display_name: string | null
          id: string
          onboarding_completed: boolean | null
          passion_seriousness: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["access_level"] | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          passion_seriousness?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"] | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          passion_seriousness?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      project_applications: {
        Row: {
          applicant_id: string
          created_at: string
          id: string
          message: string | null
          project_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          role_id: string
          status: string
        }
        Insert: {
          applicant_id: string
          created_at?: string
          id?: string
          message?: string | null
          project_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role_id: string
          status?: string
        }
        Update: {
          applicant_id?: string
          created_at?: string
          id?: string
          message?: string | null
          project_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_applications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_applications_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "project_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          currency: string
          description: string | null
          due_date: string | null
          id: string
          paid_at: string | null
          project_id: string
          role_id: string | null
          status: string
          stripe_payment_intent_id: string | null
          submitted_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          id?: string
          paid_at?: string | null
          project_id: string
          role_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          submitted_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          id?: string
          paid_at?: string | null
          project_id?: string
          role_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          submitted_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_milestones_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "project_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_locked: boolean
          payout_amount: number
          project_id: string
          role_name: string
          slots_available: number
          slots_filled: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_locked?: boolean
          payout_amount?: number
          project_id: string
          role_name: string
          slots_available?: number
          slots_filled?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_locked?: boolean
          payout_amount?: number
          project_id?: string
          role_name?: string
          slots_available?: number
          slots_filled?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          cover_image_url: string | null
          created_at: string
          creator_id: string
          currency: string
          description: string | null
          id: string
          status: string
          timeline_end: string | null
          timeline_start: string | null
          title: string
          total_budget: number
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          creator_id: string
          currency?: string
          description?: string | null
          id?: string
          status?: string
          timeline_end?: string | null
          timeline_start?: string | null
          title: string
          total_budget?: number
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          creator_id?: string
          currency?: string
          description?: string | null
          id?: string
          status?: string
          timeline_end?: string | null
          timeline_start?: string | null
          title?: string
          total_budget?: number
          updated_at?: string
        }
        Relationships: []
      }
      questionnaire_responses: {
        Row: {
          created_at: string | null
          id: string
          responses: Json
          total_score: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          responses: Json
          total_score: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          responses?: Json
          total_score?: number
          user_id?: string
        }
        Relationships: []
      }
      rental_inquiries: {
        Row: {
          created_at: string
          id: string
          inquirer_id: string
          item_id: string
          message: string
          preferred_dates: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          inquirer_id: string
          item_id: string
          message: string
          preferred_dates?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          inquirer_id?: string
          item_id?: string
          message?: string
          preferred_dates?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_inquiries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "store_items"
            referencedColumns: ["id"]
          },
        ]
      }
      reputation_scores: {
        Row: {
          completed_projects: number
          created_at: string
          id: string
          last_calculated_at: string
          on_time_delivery_rate: number
          overall_score: number
          response_rate: number
          review_count: number
          review_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_projects?: number
          created_at?: string
          id?: string
          last_calculated_at?: string
          on_time_delivery_rate?: number
          overall_score?: number
          response_rate?: number
          review_count?: number
          review_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_projects?: number
          created_at?: string
          id?: string
          last_calculated_at?: string
          on_time_delivery_rate?: number
          overall_score?: number
          response_rate?: number
          review_count?: number
          review_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_posts: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      store_item_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      store_items: {
        Row: {
          amenities: string[] | null
          category_id: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          credits_price: number | null
          currency: string
          description: string | null
          duration_minutes: number | null
          id: string
          images: string[] | null
          inventory_count: number | null
          is_active: boolean | null
          location: string | null
          price: number
          shopify_product_id: string | null
          shopify_variant_id: string | null
          store_id: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          amenities?: string[] | null
          category_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          credits_price?: number | null
          currency?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          images?: string[] | null
          inventory_count?: number | null
          is_active?: boolean | null
          location?: string | null
          price?: number
          shopify_product_id?: string | null
          shopify_variant_id?: string | null
          store_id: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          amenities?: string[] | null
          category_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          credits_price?: number | null
          currency?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          images?: string[] | null
          inventory_count?: number | null
          is_active?: boolean | null
          location?: string | null
          price?: number
          shopify_product_id?: string | null
          shopify_variant_id?: string | null
          store_id?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "store_item_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_orders: {
        Row: {
          buyer_id: string
          created_at: string
          credits_spent: number | null
          id: string
          item_id: string
          notes: string | null
          payment_type: string
          quantity: number
          status: string
          store_id: string
          stripe_payment_intent_id: string | null
          total_price: number
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          credits_spent?: number | null
          id?: string
          item_id: string
          notes?: string | null
          payment_type: string
          quantity?: number
          status?: string
          store_id: string
          stripe_payment_intent_id?: string | null
          total_price: number
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          credits_spent?: number | null
          id?: string
          item_id?: string
          notes?: string | null
          payment_type?: string
          quantity?: number
          status?: string
          store_id?: string
          stripe_payment_intent_id?: string | null
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_orders_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "store_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          accepts_cash: boolean | null
          accepts_credits: boolean | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          shopify_access_token: string | null
          shopify_store_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accepts_cash?: boolean | null
          accepts_credits?: boolean | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          shopify_access_token?: string | null
          shopify_store_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accepts_cash?: boolean | null
          accepts_credits?: boolean | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          shopify_access_token?: string | null
          shopify_store_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          is_live: boolean | null
          media_type: string
          media_url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          is_live?: boolean | null
          media_type: string
          media_url: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          is_live?: boolean | null
          media_type?: string
          media_url?: string
          user_id?: string
        }
        Relationships: []
      }
      story_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_reactions_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          id: string
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          stream_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          stream_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_reactions_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_tips: {
        Row: {
          amount: number
          created_at: string
          host_id: string
          id: string
          message: string | null
          stream_id: string
          tipper_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          host_id: string
          id?: string
          message?: string | null
          stream_id: string
          tipper_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          host_id?: string
          id?: string
          message?: string | null
          stream_id?: string
          tipper_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_tips_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_viewers: {
        Row: {
          id: string
          joined_at: string
          left_at: string | null
          stream_id: string
          viewer_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          left_at?: string | null
          stream_id: string
          viewer_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          left_at?: string | null
          stream_id?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_viewers_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_bookings: {
        Row: {
          created_at: string
          credits_spent: number | null
          duration_hours: number | null
          end_time: string | null
          id: string
          item_id: string
          message: string | null
          owner_id: string
          owner_notes: string | null
          payment_type: string | null
          requested_date: string
          requester_id: string
          start_time: string | null
          status: string
          stripe_payment_intent_id: string | null
          total_price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits_spent?: number | null
          duration_hours?: number | null
          end_time?: string | null
          id?: string
          item_id: string
          message?: string | null
          owner_id: string
          owner_notes?: string | null
          payment_type?: string | null
          requested_date: string
          requester_id: string
          start_time?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          total_price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits_spent?: number | null
          duration_hours?: number | null
          end_time?: string | null
          id?: string
          item_id?: string
          message?: string | null
          owner_id?: string
          owner_notes?: string | null
          payment_type?: string | null
          requested_date?: string
          requester_id?: string
          start_time?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          total_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_bookings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "store_items"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_reviews: {
        Row: {
          booking_id: string | null
          created_at: string
          id: string
          item_id: string
          rating: number
          review: string | null
          reviewer_id: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          id?: string
          item_id: string
          rating: number
          review?: string | null
          reviewer_id: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          id?: string
          item_id?: string
          rating?: number
          review?: string | null
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "studio_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_reviews_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "store_items"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          id: string
          metadata: Json | null
          status: string
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      typing_indicators: {
        Row: {
          conversation_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "typing_indicators_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      user_creative_roles: {
        Row: {
          created_at: string | null
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_creative_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "creative_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credits: {
        Row: {
          balance: number
          created_at: string
          id: string
          lifetime_earned: number
          lifetime_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          lifetime_earned?: number
          lifetime_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          lifetime_earned?: number
          lifetime_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_passions: {
        Row: {
          created_at: string | null
          id: string
          passion_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          passion_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          passion_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_passions_passion_id_fkey"
            columns: ["passion_id"]
            isOneToOne: false
            referencedRelation: "passions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_skills: {
        Row: {
          created_at: string | null
          id: string
          skill_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          skill_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          skill_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_reputation_score: {
        Args: { p_user_id: string }
        Returns: number
      }
      is_conversation_participant: {
        Args: { conv_id: string; uid: string }
        Returns: boolean
      }
      is_user_blocked: {
        Args: { uid1: string; uid2: string }
        Returns: boolean
      }
    }
    Enums: {
      access_level: "level_1" | "level_2" | "level_3"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      access_level: ["level_1", "level_2", "level_3"],
    },
  },
} as const
