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
      admin_actions: {
        Row: {
          action_type: string
          admin_id: string
          created_at: string
          id: string
          metadata: Json | null
          reason: string | null
          target_user_id: string
        }
        Insert: {
          action_type: string
          admin_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          target_user_id: string
        }
        Update: {
          action_type?: string
          admin_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      admin_announcements: {
        Row: {
          created_at: string
          id: string
          message: string
          recipient_count: number
          sent_at: string
          sent_by: string
          target_audience: Json
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          recipient_count?: number
          sent_at?: string
          sent_by: string
          target_audience?: Json
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          recipient_count?: number
          sent_at?: string
          sent_by?: string
          target_audience?: Json
          title?: string
        }
        Relationships: []
      }
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
      appointments: {
        Row: {
          contact_id: string | null
          created_at: string
          description: string | null
          ends_at: string
          id: string
          location: string | null
          owner_user_id: string
          starts_at: string
          status: string
          team_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          location?: string | null
          owner_user_id: string
          starts_at: string
          status?: string
          team_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          location?: string | null
          owner_user_id?: string
          starts_at?: string
          status?: string
          team_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          content: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          is_published: boolean | null
          published_at: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      board_item_comments: {
        Row: {
          board_item_id: string
          body: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          board_item_id: string
          body: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          board_item_id?: string
          body?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_item_comments_board_item_id_fkey"
            columns: ["board_item_id"]
            isOneToOne: false
            referencedRelation: "board_items"
            referencedColumns: ["id"]
          },
        ]
      }
      board_items: {
        Row: {
          board_id: string
          content: Json
          created_at: string
          created_by: string | null
          end_anchor: string | null
          end_item_id: string | null
          h: number
          id: string
          is_trashed: boolean
          parent_item_id: string | null
          rotation: number
          start_anchor: string | null
          start_item_id: string | null
          stroke_color: string
          stroke_style: string
          stroke_width: number
          title: string | null
          type: string
          updated_at: string
          w: number
          x: number
          y: number
          z_index: number
        }
        Insert: {
          board_id: string
          content?: Json
          created_at?: string
          created_by?: string | null
          end_anchor?: string | null
          end_item_id?: string | null
          h?: number
          id?: string
          is_trashed?: boolean
          parent_item_id?: string | null
          rotation?: number
          start_anchor?: string | null
          start_item_id?: string | null
          stroke_color?: string
          stroke_style?: string
          stroke_width?: number
          title?: string | null
          type: string
          updated_at?: string
          w?: number
          x?: number
          y?: number
          z_index?: number
        }
        Update: {
          board_id?: string
          content?: Json
          created_at?: string
          created_by?: string | null
          end_anchor?: string | null
          end_item_id?: string | null
          h?: number
          id?: string
          is_trashed?: boolean
          parent_item_id?: string | null
          rotation?: number
          start_anchor?: string | null
          start_item_id?: string | null
          stroke_color?: string
          stroke_style?: string
          stroke_width?: number
          title?: string | null
          type?: string
          updated_at?: string
          w?: number
          x?: number
          y?: number
          z_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "board_items_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_items_end_item_id_fkey"
            columns: ["end_item_id"]
            isOneToOne: false
            referencedRelation: "board_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "board_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_items_start_item_id_fkey"
            columns: ["start_item_id"]
            isOneToOne: false
            referencedRelation: "board_items"
            referencedColumns: ["id"]
          },
        ]
      }
      board_members: {
        Row: {
          board_id: string
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          board_id: string
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          board_id?: string
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_members_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_trashed: boolean
          owner_user_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_trashed?: boolean
          owner_user_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_trashed?: boolean
          owner_user_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      booking_pages: {
        Row: {
          availability: Json
          created_at: string
          id: string
          is_active: boolean
          meeting_length_minutes: number
          owner_user_id: string
          slug: string
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          availability?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          meeting_length_minutes?: number
          owner_user_id: string
          slug: string
          timezone?: string
          title?: string
          updated_at?: string
        }
        Update: {
          availability?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          meeting_length_minutes?: number
          owner_user_id?: string
          slug?: string
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_requests: {
        Row: {
          appointment_id: string | null
          booking_page_id: string
          contact_email: string
          contact_name: string
          created_at: string
          id: string
          requested_end: string
          requested_start: string
          status: string
        }
        Insert: {
          appointment_id?: string | null
          booking_page_id: string
          contact_email: string
          contact_name: string
          created_at?: string
          id?: string
          requested_end: string
          requested_start: string
          status?: string
        }
        Update: {
          appointment_id?: string | null
          booking_page_id?: string
          contact_email?: string
          contact_name?: string
          created_at?: string
          id?: string
          requested_end?: string
          requested_start?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_booking_page_id_fkey"
            columns: ["booking_page_id"]
            isOneToOne: false
            referencedRelation: "booking_pages"
            referencedColumns: ["id"]
          },
        ]
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
      calendar_tasks: {
        Row: {
          created_at: string
          due_at: string | null
          event_id: string | null
          id: string
          is_done: boolean
          personal_item_id: string | null
          project_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_at?: string | null
          event_id?: string | null
          id?: string
          is_done?: boolean
          personal_item_id?: string | null
          project_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_at?: string | null
          event_id?: string | null
          id?: string
          is_done?: boolean
          personal_item_id?: string | null
          project_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_tasks_personal_item_id_fkey"
            columns: ["personal_item_id"]
            isOneToOne: false
            referencedRelation: "personal_calendar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      community_updates: {
        Row: {
          author_id: string
          category: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_pinned: boolean
          is_published: boolean
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          category?: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_pinned?: boolean
          is_published?: boolean
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          category?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_pinned?: boolean
          is_published?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_contracts: {
        Row: {
          additional_parties: Json | null
          client_address: string | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          client_responsibilities: string | null
          client_signature_url: string | null
          client_signed_at: string | null
          confidentiality_duration: string | null
          confidentiality_enabled: boolean | null
          confidentiality_terms: string | null
          contract_number: string
          created_at: string
          deliverables: string | null
          early_termination_fee: number | null
          estimated_completion_date: string | null
          exclusions: string | null
          force_majeure_enabled: boolean | null
          force_majeure_terms: string | null
          governing_law_country: string | null
          governing_law_state: string | null
          id: string
          indemnification_terms: string | null
          late_fee_percentage: number | null
          limitation_of_liability: string | null
          owner_user_id: string
          ownership_after_payment: string | null
          ownership_before_payment: string | null
          payment_methods: string | null
          payment_schedule: string | null
          payment_type: string | null
          pdf_url: string | null
          pipeline_item_id: string
          portfolio_rights: boolean | null
          project_start_date: string | null
          provider_address: string | null
          provider_email: string | null
          provider_name: string | null
          provider_phone: string | null
          provider_signature_url: string | null
          provider_signed_at: string | null
          recipient_email: string | null
          recipient_phone: string | null
          refund_policy: string | null
          revision_cost: number | null
          revisions_included: number | null
          scope_description: string | null
          sent_at: string | null
          sent_via: string | null
          status: string
          termination_notice_days: number | null
          termination_terms: string | null
          timeline_milestones: string | null
          title: string
          total_price: number | null
          updated_at: string
        }
        Insert: {
          additional_parties?: Json | null
          client_address?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          client_responsibilities?: string | null
          client_signature_url?: string | null
          client_signed_at?: string | null
          confidentiality_duration?: string | null
          confidentiality_enabled?: boolean | null
          confidentiality_terms?: string | null
          contract_number: string
          created_at?: string
          deliverables?: string | null
          early_termination_fee?: number | null
          estimated_completion_date?: string | null
          exclusions?: string | null
          force_majeure_enabled?: boolean | null
          force_majeure_terms?: string | null
          governing_law_country?: string | null
          governing_law_state?: string | null
          id?: string
          indemnification_terms?: string | null
          late_fee_percentage?: number | null
          limitation_of_liability?: string | null
          owner_user_id: string
          ownership_after_payment?: string | null
          ownership_before_payment?: string | null
          payment_methods?: string | null
          payment_schedule?: string | null
          payment_type?: string | null
          pdf_url?: string | null
          pipeline_item_id: string
          portfolio_rights?: boolean | null
          project_start_date?: string | null
          provider_address?: string | null
          provider_email?: string | null
          provider_name?: string | null
          provider_phone?: string | null
          provider_signature_url?: string | null
          provider_signed_at?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          refund_policy?: string | null
          revision_cost?: number | null
          revisions_included?: number | null
          scope_description?: string | null
          sent_at?: string | null
          sent_via?: string | null
          status?: string
          termination_notice_days?: number | null
          termination_terms?: string | null
          timeline_milestones?: string | null
          title: string
          total_price?: number | null
          updated_at?: string
        }
        Update: {
          additional_parties?: Json | null
          client_address?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          client_responsibilities?: string | null
          client_signature_url?: string | null
          client_signed_at?: string | null
          confidentiality_duration?: string | null
          confidentiality_enabled?: boolean | null
          confidentiality_terms?: string | null
          contract_number?: string
          created_at?: string
          deliverables?: string | null
          early_termination_fee?: number | null
          estimated_completion_date?: string | null
          exclusions?: string | null
          force_majeure_enabled?: boolean | null
          force_majeure_terms?: string | null
          governing_law_country?: string | null
          governing_law_state?: string | null
          id?: string
          indemnification_terms?: string | null
          late_fee_percentage?: number | null
          limitation_of_liability?: string | null
          owner_user_id?: string
          ownership_after_payment?: string | null
          ownership_before_payment?: string | null
          payment_methods?: string | null
          payment_schedule?: string | null
          payment_type?: string | null
          pdf_url?: string | null
          pipeline_item_id?: string
          portfolio_rights?: boolean | null
          project_start_date?: string | null
          provider_address?: string | null
          provider_email?: string | null
          provider_name?: string | null
          provider_phone?: string | null
          provider_signature_url?: string | null
          provider_signed_at?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          refund_policy?: string | null
          revision_cost?: number | null
          revisions_included?: number | null
          scope_description?: string | null
          sent_at?: string | null
          sent_via?: string | null
          status?: string
          termination_notice_days?: number | null
          termination_terms?: string | null
          timeline_milestones?: string | null
          title?: string
          total_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_contracts_pipeline_item_id_fkey"
            columns: ["pipeline_item_id"]
            isOneToOne: false
            referencedRelation: "pipeline_items"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_invoices: {
        Row: {
          attached_images: string[] | null
          created_at: string
          currency: string
          description: string | null
          due_date: string | null
          id: string
          invoice_number: string
          line_items: Json
          owner_user_id: string
          paid_at: string | null
          pipeline_item_id: string
          recipient_email: string | null
          recipient_phone: string | null
          sent_at: string | null
          sent_via: string | null
          status: string
          subtotal: number
          tax_amount: number | null
          tax_rate: number | null
          title: string
          total: number
          updated_at: string
        }
        Insert: {
          attached_images?: string[] | null
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          line_items?: Json
          owner_user_id: string
          paid_at?: string | null
          pipeline_item_id: string
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          sent_via?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          title: string
          total?: number
          updated_at?: string
        }
        Update: {
          attached_images?: string[] | null
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          line_items?: Json
          owner_user_id?: string
          paid_at?: string | null
          pipeline_item_id?: string
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          sent_via?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          title?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_invoices_pipeline_item_id_fkey"
            columns: ["pipeline_item_id"]
            isOneToOne: false
            referencedRelation: "pipeline_items"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_media: {
        Row: {
          created_at: string
          id: string
          media_type: string
          media_url: string
          notes: string | null
          owner_user_id: string
          pipeline_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_type?: string
          media_url: string
          notes?: string | null
          owner_user_id: string
          pipeline_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          media_type?: string
          media_url?: string
          notes?: string | null
          owner_user_id?: string
          pipeline_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_media_pipeline_item_id_fkey"
            columns: ["pipeline_item_id"]
            isOneToOne: false
            referencedRelation: "pipeline_items"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_quotes: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          id: string
          owner_user_id: string
          pipeline_item_id: string
          status: string
          title: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          owner_user_id: string
          pipeline_item_id: string
          status?: string
          title: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          owner_user_id?: string
          pipeline_item_id?: string
          status?: string
          title?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_quotes_pipeline_item_id_fkey"
            columns: ["pipeline_item_id"]
            isOneToOne: false
            referencedRelation: "pipeline_items"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tasks: {
        Row: {
          created_at: string
          due_at: string | null
          id: string
          is_done: boolean
          owner_user_id: string
          pipeline_item_id: string
          title: string
        }
        Insert: {
          created_at?: string
          due_at?: string | null
          id?: string
          is_done?: boolean
          owner_user_id: string
          pipeline_item_id: string
          title: string
        }
        Update: {
          created_at?: string
          due_at?: string | null
          id?: string
          is_done?: boolean
          owner_user_id?: string
          pipeline_item_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tasks_pipeline_item_id_fkey"
            columns: ["pipeline_item_id"]
            isOneToOne: false
            referencedRelation: "pipeline_items"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_timeline: {
        Row: {
          contact_id: string
          created_at: string
          data: Json | null
          id: string
          type: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          data?: Json | null
          id?: string
          type: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          data?: Json | null
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_timeline_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          owner_user_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          owner_user_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          owner_user_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      content_genres: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      content_submissions: {
        Row: {
          cast_members: string[] | null
          content_type: Database["public"]["Enums"]["network_content_type"]
          cover_art_url: string | null
          created_at: string
          credits: Json | null
          description: string | null
          director: string | null
          external_video_url: string | null
          id: string
          network_id: string
          pitch_notes: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          runtime_minutes: number | null
          status: Database["public"]["Enums"]["submission_status"]
          submitter_id: string
          title: string
          trailer_url: string | null
          video_url: string | null
        }
        Insert: {
          cast_members?: string[] | null
          content_type: Database["public"]["Enums"]["network_content_type"]
          cover_art_url?: string | null
          created_at?: string
          credits?: Json | null
          description?: string | null
          director?: string | null
          external_video_url?: string | null
          id?: string
          network_id: string
          pitch_notes?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          runtime_minutes?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitter_id: string
          title: string
          trailer_url?: string | null
          video_url?: string | null
        }
        Update: {
          cast_members?: string[] | null
          content_type?: Database["public"]["Enums"]["network_content_type"]
          cover_art_url?: string | null
          created_at?: string
          credits?: Json | null
          description?: string | null
          director?: string | null
          external_video_url?: string | null
          id?: string
          network_id?: string
          pitch_notes?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          runtime_minutes?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitter_id?: string
          title?: string
          trailer_url?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_submissions_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
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
          project_role_name: string | null
          role: Database["public"]["Enums"]["group_member_role"] | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_muted?: boolean | null
          joined_at?: string
          last_read_at?: string | null
          project_role_name?: string | null
          role?: Database["public"]["Enums"]["group_member_role"] | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_muted?: boolean | null
          joined_at?: string
          last_read_at?: string | null
          project_role_name?: string | null
          role?: Database["public"]["Enums"]["group_member_role"] | null
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
          description: string | null
          id: string
          is_community_hub: boolean | null
          max_members: number | null
          name: string | null
          project_id: string | null
          topic: string | null
          type: string
          updated_at: string
          visibility: Database["public"]["Enums"]["group_visibility"] | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_community_hub?: boolean | null
          max_members?: number | null
          name?: string | null
          project_id?: string | null
          topic?: string | null
          type: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["group_visibility"] | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_community_hub?: boolean | null
          max_members?: number | null
          name?: string | null
          project_id?: string | null
          topic?: string | null
          type?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["group_visibility"] | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      creator_applications: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          portfolio_url: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          portfolio_url?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          portfolio_url?: string | null
          status?: string
        }
        Relationships: []
      }
      creator_roles: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          role_type: Database["public"]["Enums"]["creator_role_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          role_type: Database["public"]["Enums"]["creator_role_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          role_type?: Database["public"]["Enums"]["creator_role_type"]
          user_id?: string
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
      dance_videos: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_choreography: boolean
          song_artist: string | null
          song_title: string | null
          style: string | null
          thumbnail_url: string | null
          title: string
          user_id: string
          video_url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_choreography?: boolean
          song_artist?: string | null
          song_title?: string | null
          style?: string | null
          thumbnail_url?: string | null
          title: string
          user_id: string
          video_url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_choreography?: boolean
          song_artist?: string | null
          song_title?: string | null
          style?: string | null
          thumbnail_url?: string | null
          title?: string
          user_id?: string
          video_url?: string
        }
        Relationships: []
      }
      dj_mixes: {
        Row: {
          audio_url: string | null
          cover_art_url: string | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          genre: string | null
          id: string
          is_live: boolean
          recorded_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          cover_art_url?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          genre?: string | null
          id?: string
          is_live?: boolean
          recorded_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          audio_url?: string | null
          cover_art_url?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          genre?: string | null
          id?: string
          is_live?: boolean
          recorded_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      energy_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          source: string
          source_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description?: string | null
          id?: string
          source: string
          source_id?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          source?: string
          source_id?: string | null
          transaction_type?: string
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
          external_url: string | null
          id: string
          image_url: string | null
          is_public: boolean | null
          project_id: string | null
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
          external_url?: string | null
          id?: string
          image_url?: string | null
          is_public?: boolean | null
          project_id?: string | null
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
          external_url?: string | null
          id?: string
          image_url?: string | null
          is_public?: boolean | null
          project_id?: string | null
          start_date?: string
          state?: string | null
          ticket_price?: number | null
          ticket_type?: string
          title?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_friends: {
        Row: {
          created_at: string
          friend_user_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_user_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_user_id?: string
          id?: string
          user_id?: string
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
      group_expense_contributions: {
        Row: {
          amount_owed: number
          amount_paid: number
          created_at: string
          expense_id: string
          id: string
          paid_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_owed: number
          amount_paid?: number
          created_at?: string
          expense_id: string
          id?: string
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_owed?: number
          amount_paid?: number
          created_at?: string
          expense_id?: string
          id?: string
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_expense_contributions_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "group_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      group_expenses: {
        Row: {
          conversation_id: string
          created_at: string
          created_by: string
          currency: string
          description: string | null
          id: string
          title: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          id?: string
          title: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          id?: string
          title?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_expenses_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      group_itineraries: {
        Row: {
          conversation_id: string
          created_at: string
          created_by: string
          end_date: string
          id: string
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          created_by: string
          end_date: string
          id?: string
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          created_by?: string
          end_date?: string
          id?: string
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_itineraries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_items: {
        Row: {
          created_at: string
          created_by: string
          day_number: number
          description: string | null
          end_time: string | null
          id: string
          itinerary_id: string
          location: string | null
          start_time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          day_number: number
          description?: string | null
          end_time?: string | null
          id?: string
          itinerary_id: string
          location?: string | null
          start_time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          day_number?: number
          description?: string | null
          end_time?: string | null
          id?: string
          itinerary_id?: string
          location?: string | null
          start_time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_items_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "group_itineraries"
            referencedColumns: ["id"]
          },
        ]
      }
      live_streams: {
        Row: {
          created_at: string
          description: string | null
          ended_at: string | null
          event_type: string | null
          external_url: string | null
          host_id: string
          id: string
          is_live: boolean | null
          is_virtual_event: boolean | null
          max_attendees: number | null
          mux_live_stream_id: string | null
          mux_playback_id: string | null
          parent_event_id: string | null
          playback_url: string | null
          replay_available: boolean | null
          replay_url: string | null
          requires_ticket: boolean | null
          rtmp_ingest_url: string | null
          rtmp_stream_key: string | null
          started_at: string | null
          stream_type: string
          thumbnail_url: string | null
          ticket_price: number | null
          title: string
          total_tips: number | null
          viewer_count: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          event_type?: string | null
          external_url?: string | null
          host_id: string
          id?: string
          is_live?: boolean | null
          is_virtual_event?: boolean | null
          max_attendees?: number | null
          mux_live_stream_id?: string | null
          mux_playback_id?: string | null
          parent_event_id?: string | null
          playback_url?: string | null
          replay_available?: boolean | null
          replay_url?: string | null
          requires_ticket?: boolean | null
          rtmp_ingest_url?: string | null
          rtmp_stream_key?: string | null
          started_at?: string | null
          stream_type: string
          thumbnail_url?: string | null
          ticket_price?: number | null
          title: string
          total_tips?: number | null
          viewer_count?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          event_type?: string | null
          external_url?: string | null
          host_id?: string
          id?: string
          is_live?: boolean | null
          is_virtual_event?: boolean | null
          max_attendees?: number | null
          mux_live_stream_id?: string | null
          mux_playback_id?: string | null
          parent_event_id?: string | null
          playback_url?: string | null
          replay_available?: boolean | null
          replay_url?: string | null
          requires_ticket?: boolean | null
          rtmp_ingest_url?: string | null
          rtmp_stream_key?: string | null
          started_at?: string | null
          stream_type?: string
          thumbnail_url?: string | null
          ticket_price?: number | null
          title?: string
          total_tips?: number | null
          viewer_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "live_streams_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_streams_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "live_streams_public"
            referencedColumns: ["id"]
          },
        ]
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
      menu_items: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          price: number | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          price?: number | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          price?: number | null
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
      network_content: {
        Row: {
          cast_members: string[] | null
          content_type: Database["public"]["Enums"]["network_content_type"]
          cover_art_url: string | null
          created_at: string
          creator_id: string
          credits: Json | null
          description: string | null
          director: string | null
          external_video_url: string | null
          genre_tags: string[] | null
          id: string
          is_featured: boolean | null
          is_published: boolean | null
          network_id: string
          release_date: string | null
          runtime_minutes: number | null
          title: string
          trailer_url: string | null
          updated_at: string
          video_url: string | null
          view_count: number | null
        }
        Insert: {
          cast_members?: string[] | null
          content_type: Database["public"]["Enums"]["network_content_type"]
          cover_art_url?: string | null
          created_at?: string
          creator_id: string
          credits?: Json | null
          description?: string | null
          director?: string | null
          external_video_url?: string | null
          genre_tags?: string[] | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          network_id: string
          release_date?: string | null
          runtime_minutes?: number | null
          title: string
          trailer_url?: string | null
          updated_at?: string
          video_url?: string | null
          view_count?: number | null
        }
        Update: {
          cast_members?: string[] | null
          content_type?: Database["public"]["Enums"]["network_content_type"]
          cover_art_url?: string | null
          created_at?: string
          creator_id?: string
          credits?: Json | null
          description?: string | null
          director?: string | null
          external_video_url?: string | null
          genre_tags?: string[] | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          network_id?: string
          release_date?: string | null
          runtime_minutes?: number | null
          title?: string
          trailer_url?: string | null
          updated_at?: string
          video_url?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "network_content_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      network_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          network_id: string
          status: string
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          network_id: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          network_id?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "network_subscriptions_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      networks: {
        Row: {
          banner_url: string | null
          created_at: string
          description: string | null
          genre: string | null
          id: string
          is_paid: boolean
          is_public: boolean
          logo_url: string | null
          name: string
          owner_id: string
          payout_enabled: boolean | null
          payout_method: string | null
          stripe_connect_account_id: string | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          subscriber_count: number | null
          subscription_price: number | null
          total_views: number | null
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          genre?: string | null
          id?: string
          is_paid?: boolean
          is_public?: boolean
          logo_url?: string | null
          name: string
          owner_id: string
          payout_enabled?: boolean | null
          payout_method?: string | null
          stripe_connect_account_id?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          subscriber_count?: number | null
          subscription_price?: number | null
          total_views?: number | null
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          genre?: string | null
          id?: string
          is_paid?: boolean
          is_public?: boolean
          logo_url?: string | null
          name?: string
          owner_id?: string
          payout_enabled?: boolean | null
          payout_method?: string | null
          stripe_connect_account_id?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          subscriber_count?: number | null
          subscription_price?: number | null
          total_views?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_signups: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          admin_enabled: boolean | null
          application_updates_enabled: boolean | null
          comments_enabled: boolean | null
          created_at: string
          email_enabled: boolean | null
          event_reminders_enabled: boolean | null
          id: string
          likes_enabled: boolean | null
          live_streams_enabled: boolean | null
          messages_enabled: boolean | null
          new_events_enabled: boolean | null
          new_projects_enabled: boolean | null
          project_invites_enabled: boolean | null
          push_enabled: boolean | null
          sms_enabled: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_enabled?: boolean | null
          application_updates_enabled?: boolean | null
          comments_enabled?: boolean | null
          created_at?: string
          email_enabled?: boolean | null
          event_reminders_enabled?: boolean | null
          id?: string
          likes_enabled?: boolean | null
          live_streams_enabled?: boolean | null
          messages_enabled?: boolean | null
          new_events_enabled?: boolean | null
          new_projects_enabled?: boolean | null
          project_invites_enabled?: boolean | null
          push_enabled?: boolean | null
          sms_enabled?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_enabled?: boolean | null
          application_updates_enabled?: boolean | null
          comments_enabled?: boolean | null
          created_at?: string
          email_enabled?: boolean | null
          event_reminders_enabled?: boolean | null
          id?: string
          likes_enabled?: boolean | null
          live_streams_enabled?: boolean | null
          messages_enabled?: boolean | null
          new_events_enabled?: boolean | null
          new_projects_enabled?: boolean | null
          project_invites_enabled?: boolean | null
          push_enabled?: boolean | null
          sms_enabled?: boolean | null
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
      partner_applications: {
        Row: {
          address: string | null
          business_name: string
          category: string
          city: string
          contact_email: string
          contact_phone: string | null
          contribution: string
          country: string
          created_at: string
          description: string
          id: string
          member_benefits: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state: string | null
          status: string
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          address?: string | null
          business_name: string
          category: string
          city: string
          contact_email: string
          contact_phone?: string | null
          contribution: string
          country: string
          created_at?: string
          description: string
          id?: string
          member_benefits: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string
          category?: string
          city?: string
          contact_email?: string
          contact_phone?: string | null
          contribution?: string
          country?: string
          created_at?: string
          description?: string
          id?: string
          member_benefits?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Relationships: []
      }
      partners: {
        Row: {
          address: string | null
          category: Database["public"]["Enums"]["partner_category"]
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          is_verified: boolean
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          member_benefits: string | null
          name: string
          owner_user_id: string | null
          state: string | null
          terms: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          address?: string | null
          category: Database["public"]["Enums"]["partner_category"]
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_verified?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          member_benefits?: string | null
          name: string
          owner_user_id?: string | null
          state?: string | null
          terms?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          address?: string | null
          category?: Database["public"]["Enums"]["partner_category"]
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_verified?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          member_benefits?: string | null
          name?: string
          owner_user_id?: string | null
          state?: string | null
          terms?: string | null
          updated_at?: string
          website_url?: string | null
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
      pipeline_events: {
        Row: {
          created_at: string
          data: Json
          id: string
          item_id: string
          owner_user_id: string
          type: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          item_id: string
          owner_user_id: string
          type: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          item_id?: string
          owner_user_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pipeline_items"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_items: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          instagram_url: string | null
          linked_user_id: string | null
          linkedin_url: string | null
          name: string
          notes: string | null
          owner_user_id: string
          phone: string | null
          priority: string | null
          role: string | null
          sort_order: number
          stage_id: string
          status: string | null
          tags: string[] | null
          tiktok_url: string | null
          twitter_url: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instagram_url?: string | null
          linked_user_id?: string | null
          linkedin_url?: string | null
          name: string
          notes?: string | null
          owner_user_id: string
          phone?: string | null
          priority?: string | null
          role?: string | null
          sort_order?: number
          stage_id: string
          status?: string | null
          tags?: string[] | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instagram_url?: string | null
          linked_user_id?: string | null
          linkedin_url?: string | null
          name?: string
          notes?: string | null
          owner_user_id?: string
          phone?: string | null
          priority?: string | null
          role?: string | null
          sort_order?: number
          stage_id?: string
          status?: string | null
          tags?: string[] | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_items_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          owner_user_id: string
          pipeline_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          pipeline_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          pipeline_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          owner_user_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_user_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_user_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_reviews: {
        Row: {
          content: string
          created_at: string
          id: string
          is_approved: boolean
          is_featured: boolean
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_approved?: boolean
          is_featured?: boolean
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_approved?: boolean
          is_featured?: boolean
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolio_folders: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          is_featured: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_featured?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_featured?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolio_items: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          external_url: string | null
          folder_id: string | null
          id: string
          media_type: string
          media_url: string
          tags: string[] | null
          thumbnail_url: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          external_url?: string | null
          folder_id?: string | null
          id?: string
          media_type?: string
          media_url: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          external_url?: string | null
          folder_id?: string | null
          id?: string
          media_type?: string
          media_url?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_items_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "portfolio_folders"
            referencedColumns: ["id"]
          },
        ]
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
          folder_id: string | null
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
          folder_id?: string | null
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
          folder_id?: string | null
          id?: string
          location?: string | null
          media_type?: string | null
          media_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "portfolio_folders"
            referencedColumns: ["id"]
          },
        ]
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
          profile_layout: Json | null
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
          profile_layout?: Json | null
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
          profile_layout?: Json | null
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
          access_status: string | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          city_display: string | null
          city_key: string | null
          created_at: string | null
          display_name: string | null
          id: string
          is_suspended: boolean | null
          mindset_level: number | null
          onboarding_completed: boolean | null
          onboarding_level: number | null
          onboarding_score: number | null
          passion_seriousness: number | null
          phone: string | null
          social_links: Json | null
          suspended_at: string | null
          suspension_reason: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["access_level"] | null
          access_status?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          city_display?: string | null
          city_key?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_suspended?: boolean | null
          mindset_level?: number | null
          onboarding_completed?: boolean | null
          onboarding_level?: number | null
          onboarding_score?: number | null
          passion_seriousness?: number | null
          phone?: string | null
          social_links?: Json | null
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"] | null
          access_status?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          city_display?: string | null
          city_key?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_suspended?: boolean | null
          mindset_level?: number | null
          onboarding_completed?: boolean | null
          onboarding_level?: number | null
          onboarding_score?: number | null
          passion_seriousness?: number | null
          phone?: string | null
          social_links?: Json | null
          suspended_at?: string | null
          suspension_reason?: string | null
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
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
          {
            foreignKeyName: "stream_reactions_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams_public"
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
          {
            foreignKeyName: "stream_tips_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams_public"
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
          {
            foreignKeyName: "stream_viewers_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams_public"
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
      team_members: {
        Row: {
          created_at: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
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
      tv_episodes: {
        Row: {
          created_at: string
          description: string | null
          episode_number: number
          external_video_url: string | null
          id: string
          runtime_minutes: number | null
          season_id: string
          thumbnail_url: string | null
          title: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          episode_number: number
          external_video_url?: string | null
          id?: string
          runtime_minutes?: number | null
          season_id: string
          thumbnail_url?: string | null
          title: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          episode_number?: number
          external_video_url?: string | null
          id?: string
          runtime_minutes?: number | null
          season_id?: string
          thumbnail_url?: string | null
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tv_episodes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "tv_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_seasons: {
        Row: {
          content_id: string
          cover_art_url: string | null
          created_at: string
          description: string | null
          id: string
          season_number: number
          title: string | null
        }
        Insert: {
          content_id: string
          cover_art_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          season_number: number
          title?: string | null
        }
        Update: {
          content_id?: string
          cover_art_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          season_number?: number
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tv_seasons_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "network_content"
            referencedColumns: ["id"]
          },
        ]
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
      user_energy: {
        Row: {
          created_at: string
          current_energy: number
          id: string
          last_activity_at: string | null
          last_regen_at: string
          max_energy: number
          streak_days: number
          streak_multiplier: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_energy?: number
          id?: string
          last_activity_at?: string | null
          last_regen_at?: string
          max_energy?: number
          streak_days?: number
          streak_multiplier?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_energy?: number
          id?: string
          last_activity_at?: string | null
          last_regen_at?: string
          max_energy?: number
          streak_days?: number
          streak_multiplier?: number
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
      user_reviews: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_verified: boolean
          project_id: string | null
          rating: number
          reviewed_user_id: string
          reviewer_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_verified?: boolean
          project_id?: string | null
          rating: number
          reviewed_user_id: string
          reviewer_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_verified?: boolean
          project_id?: string | null
          rating?: number
          reviewed_user_id?: string
          reviewer_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
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
      watch_history: {
        Row: {
          completed: boolean | null
          content_id: string | null
          created_at: string
          duration_seconds: number | null
          episode_id: string | null
          id: string
          last_watched_at: string
          progress_seconds: number | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          content_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          episode_id?: string | null
          id?: string
          last_watched_at?: string
          progress_seconds?: number | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          content_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          episode_id?: string | null
          id?: string
          last_watched_at?: string
          progress_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_history_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "network_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_history_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "tv_episodes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      live_streams_public: {
        Row: {
          created_at: string | null
          description: string | null
          ended_at: string | null
          event_type: string | null
          external_url: string | null
          host_id: string | null
          id: string | null
          is_live: boolean | null
          is_virtual_event: boolean | null
          max_attendees: number | null
          mux_live_stream_id: string | null
          mux_playback_id: string | null
          parent_event_id: string | null
          playback_url: string | null
          replay_available: boolean | null
          replay_url: string | null
          requires_ticket: boolean | null
          rtmp_ingest_url: string | null
          rtmp_stream_key: string | null
          started_at: string | null
          stream_type: string | null
          thumbnail_url: string | null
          ticket_price: number | null
          title: string | null
          total_tips: number | null
          viewer_count: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          ended_at?: string | null
          event_type?: string | null
          external_url?: string | null
          host_id?: string | null
          id?: string | null
          is_live?: boolean | null
          is_virtual_event?: boolean | null
          max_attendees?: number | null
          mux_live_stream_id?: string | null
          mux_playback_id?: string | null
          parent_event_id?: string | null
          playback_url?: string | null
          replay_available?: boolean | null
          replay_url?: string | null
          requires_ticket?: boolean | null
          rtmp_ingest_url?: never
          rtmp_stream_key?: never
          started_at?: string | null
          stream_type?: string | null
          thumbnail_url?: string | null
          ticket_price?: number | null
          title?: string | null
          total_tips?: number | null
          viewer_count?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          ended_at?: string | null
          event_type?: string | null
          external_url?: string | null
          host_id?: string | null
          id?: string | null
          is_live?: boolean | null
          is_virtual_event?: boolean | null
          max_attendees?: number | null
          mux_live_stream_id?: string | null
          mux_playback_id?: string | null
          parent_event_id?: string | null
          playback_url?: string | null
          replay_available?: boolean | null
          replay_url?: string | null
          requires_ticket?: boolean | null
          rtmp_ingest_url?: never
          rtmp_stream_key?: never
          started_at?: string | null
          stream_type?: string | null
          thumbnail_url?: string | null
          ticket_price?: number | null
          title?: string | null
          total_tips?: number | null
          viewer_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "live_streams_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_streams_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "live_streams_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_reputation_score: {
        Args: { p_user_id: string }
        Returns: number
      }
      ensure_default_pipeline: {
        Args: { p_pipeline_id?: string; p_user_id: string }
        Returns: string
      }
      get_admin_user_data: {
        Args: never
        Returns: {
          access_status: string
          city: string
          created_at: string
          display_name: string
          email: string
          mindset_level: number
          phone: string
          user_id: string
        }[]
      }
      get_platform_stats: {
        Args: never
        Returns: {
          total_cities: number
          total_creators: number
          total_events: number
          total_projects: number
        }[]
      }
      get_user_emails_for_admin: {
        Args: never
        Returns: {
          email: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_board_member: {
        Args: { p_board_id: string; p_user_id: string }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { conv_id: string; uid: string }
        Returns: boolean
      }
      is_team_admin: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      is_user_blocked: {
        Args: { uid1: string; uid2: string }
        Returns: boolean
      }
    }
    Enums: {
      access_level: "level_1" | "level_2" | "level_3"
      app_role: "admin" | "moderator" | "user"
      creator_role_type:
        | "model"
        | "chef"
        | "dj"
        | "dancer"
        | "filmmaker"
        | "photographer"
        | "musician"
        | "artist"
      group_member_role: "owner" | "moderator" | "member"
      group_visibility: "public" | "private" | "discoverable"
      network_content_type: "short_film" | "feature_film" | "tv_show"
      partner_category:
        | "studio"
        | "venue"
        | "cafe"
        | "housing"
        | "equipment"
        | "transport"
        | "service"
        | "other"
      submission_status: "pending" | "approved" | "rejected"
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
      app_role: ["admin", "moderator", "user"],
      creator_role_type: [
        "model",
        "chef",
        "dj",
        "dancer",
        "filmmaker",
        "photographer",
        "musician",
        "artist",
      ],
      group_member_role: ["owner", "moderator", "member"],
      group_visibility: ["public", "private", "discoverable"],
      network_content_type: ["short_film", "feature_film", "tv_show"],
      partner_category: [
        "studio",
        "venue",
        "cafe",
        "housing",
        "equipment",
        "transport",
        "service",
        "other",
      ],
      submission_status: ["pending", "approved", "rejected"],
    },
  },
} as const
