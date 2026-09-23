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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_secrets: {
        Row: {
          name: string
          updated_at: string
          value: string
        }
        Insert: {
          name: string
          updated_at?: string
          value: string
        }
        Update: {
          name?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      automations: {
        Row: {
          active: boolean
          auto_publish: boolean
          cadence: string
          created_at: string
          day_of_week: number
          employee_id: string
          hour: number
          id: string
          label: string
          last_run_at: string | null
          last_status: string | null
          locked_at: string | null
          next_run_at: string
          skill_id: string
          timezone: string
          updated_at: string
          values: Json
          workspace_id: string
        }
        Insert: {
          active?: boolean
          auto_publish?: boolean
          cadence?: string
          created_at?: string
          day_of_week?: number
          employee_id?: string
          hour?: number
          id?: string
          label: string
          last_run_at?: string | null
          last_status?: string | null
          locked_at?: string | null
          next_run_at?: string
          skill_id: string
          timezone?: string
          updated_at?: string
          values?: Json
          workspace_id: string
        }
        Update: {
          active?: boolean
          auto_publish?: boolean
          cadence?: string
          created_at?: string
          day_of_week?: number
          employee_id?: string
          hour?: number
          id?: string
          label?: string
          last_run_at?: string | null
          last_status?: string | null
          locked_at?: string | null
          next_run_at?: string
          skill_id?: string
          timezone?: string
          updated_at?: string
          values?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_items: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          meta: string | null
          title: string
          used_by: string[]
          workspace_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          meta?: string | null
          title: string
          used_by?: string[]
          workspace_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          meta?: string | null
          title?: string
          used_by?: string[]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_memories: {
        Row: {
          confidence: number
          content: string
          conversation_id: string | null
          created_at: string
          employee_id: string | null
          id: string
          kind: string
          last_used_at: string | null
          source_message_id: string | null
          superseded_by: string | null
          updated_at: string
          valid_from: string
          valid_until: string | null
          workspace_id: string
        }
        Insert: {
          confidence?: number
          content: string
          conversation_id?: string | null
          created_at?: string
          employee_id?: string | null
          id?: string
          kind?: string
          last_used_at?: string | null
          source_message_id?: string | null
          superseded_by?: string | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          workspace_id: string
        }
        Update: {
          confidence?: number
          content?: string
          conversation_id?: string | null
          created_at?: string
          employee_id?: string | null
          id?: string
          kind?: string
          last_used_at?: string | null
          source_message_id?: string | null
          superseded_by?: string | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_memories_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_memories_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_memories_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "brand_memories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_memories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      briefings: {
        Row: {
          content: Json
          created_at: string
          day: string
          employee_id: string
          id: string
          workspace_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          day?: string
          employee_id?: string
          id?: string
          workspace_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          day?: string
          employee_id?: string
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      command_drafts: {
        Row: {
          body: string
          channel: string
          created_at: string
          employee_id: string
          external_id: string
          id: string
          image_url: string | null
          last_error: string | null
          providers: string[]
          request: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          body?: string
          channel?: string
          created_at?: string
          employee_id?: string
          external_id: string
          id?: string
          image_url?: string | null
          last_error?: string | null
          providers?: string[]
          request?: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          employee_id?: string
          external_id?: string
          id?: string
          image_url?: string | null
          last_error?: string | null
          providers?: string[]
          request?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "command_drafts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      command_link_codes: {
        Row: {
          channel: string
          code: string
          created_at: string
          expires_at: string
          label: string | null
          role: string
          used_at: string | null
          workspace_id: string
        }
        Insert: {
          channel?: string
          code: string
          created_at?: string
          expires_at: string
          label?: string | null
          role?: string
          used_at?: string | null
          workspace_id: string
        }
        Update: {
          channel?: string
          code?: string
          created_at?: string
          expires_at?: string
          label?: string | null
          role?: string
          used_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "command_link_codes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      command_links: {
        Row: {
          channel: string
          created_at: string
          external_id: string
          id: string
          label: string | null
          last_seen_at: string | null
          role: string
          status: string
          workspace_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          external_id: string
          id?: string
          label?: string | null
          last_seen_at?: string | null
          role?: string
          status?: string
          workspace_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          external_id?: string
          id?: string
          label?: string | null
          last_seen_at?: string | null
          role?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "command_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          title?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          conversation_id: string | null
          created_at: string
          decision: string
          employee_id: string
          id: string
          kind: string
          rationale: string | null
          status: string
          superseded_by: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          decision: string
          employee_id: string
          id?: string
          kind?: string
          rationale?: string | null
          status?: string
          superseded_by?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          decision?: string
          employee_id?: string
          id?: string
          kind?: string
          rationale?: string | null
          status?: string
          superseded_by?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_evaluations: {
        Row: {
          baseline_score: number | null
          candidate_score: number | null
          created_at: string
          details: Json
          employee_id: string
          id: string
          improvement: number | null
          lesson_id: string
          safety_passed: boolean
          sample_size: number
          workspace_id: string
        }
        Insert: {
          baseline_score?: number | null
          candidate_score?: number | null
          created_at?: string
          details?: Json
          employee_id: string
          id?: string
          improvement?: number | null
          lesson_id: string
          safety_passed?: boolean
          sample_size?: number
          workspace_id: string
        }
        Update: {
          baseline_score?: number | null
          candidate_score?: number | null
          created_at?: string
          details?: Json
          employee_id?: string
          id?: string
          improvement?: number | null
          lesson_id?: string
          safety_passed?: boolean
          sample_size?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_evaluations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "employee_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_evaluations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_feedback: {
        Row: {
          created_at: string
          edited_text: string | null
          employee_id: string
          id: string
          kind: string
          metrics: Json
          original_text: string | null
          reason: string | null
          run_id: string | null
          task_id: string | null
          weight: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          edited_text?: string | null
          employee_id: string
          id?: string
          kind: string
          metrics?: Json
          original_text?: string | null
          reason?: string | null
          run_id?: string | null
          task_id?: string | null
          weight?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          edited_text?: string | null
          employee_id?: string
          id?: string
          kind?: string
          metrics?: Json
          original_text?: string | null
          reason?: string | null
          run_id?: string | null
          task_id?: string | null
          weight?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_feedback_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "employee_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_feedback_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_feedback_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_learning_settings: {
        Row: {
          auto_promote_low_risk: boolean
          created_at: string
          enabled: boolean
          experiment_percent: number
          minimum_evidence: number
          minimum_improvement: number
          paused_reason: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          auto_promote_low_risk?: boolean
          created_at?: string
          enabled?: boolean
          experiment_percent?: number
          minimum_evidence?: number
          minimum_improvement?: number
          paused_reason?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          auto_promote_low_risk?: boolean
          created_at?: string
          enabled?: boolean
          experiment_percent?: number
          minimum_evidence?: number
          minimum_improvement?: number
          paused_reason?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_learning_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_lessons: {
        Row: {
          activated_at: string | null
          confidence: number
          created_at: string
          employee_id: string
          evidence: Json
          evidence_count: number
          expires_at: string | null
          failure_count: number
          id: string
          instruction: string
          risk_level: string
          scope: string
          source_kind: string
          status: string
          success_count: number
          supersedes_id: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          activated_at?: string | null
          confidence?: number
          created_at?: string
          employee_id: string
          evidence?: Json
          evidence_count?: number
          expires_at?: string | null
          failure_count?: number
          id?: string
          instruction: string
          risk_level?: string
          scope?: string
          source_kind?: string
          status?: string
          success_count?: number
          supersedes_id?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          activated_at?: string | null
          confidence?: number
          created_at?: string
          employee_id?: string
          evidence?: Json
          evidence_count?: number
          expires_at?: string | null
          failure_count?: number
          id?: string
          instruction?: string
          risk_level?: string
          scope?: string
          source_kind?: string
          status?: string
          success_count?: number
          supersedes_id?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_lessons_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "employee_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_lessons_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_runs: {
        Row: {
          applied_lesson_ids: string[]
          capability: string | null
          conversation_id: string | null
          created_at: string
          employee_id: string
          final_output: string
          id: string
          message_id: string | null
          original_output: string
          outcome: string
          policy_version: number
          quality_issues: Json
          quality_score: number | null
          request_text: string
          task_id: string | null
          updated_at: string
          was_revised: boolean
          workspace_id: string
        }
        Insert: {
          applied_lesson_ids?: string[]
          capability?: string | null
          conversation_id?: string | null
          created_at?: string
          employee_id: string
          final_output: string
          id?: string
          message_id?: string | null
          original_output: string
          outcome?: string
          policy_version?: number
          quality_issues?: Json
          quality_score?: number | null
          request_text: string
          task_id?: string | null
          updated_at?: string
          was_revised?: boolean
          workspace_id: string
        }
        Update: {
          applied_lesson_ids?: string[]
          capability?: string | null
          conversation_id?: string | null
          created_at?: string
          employee_id?: string
          final_output?: string
          id?: string
          message_id?: string | null
          original_output?: string
          outcome?: string
          policy_version?: number
          quality_issues?: Json
          quality_score?: number | null
          request_text?: string
          task_id?: string | null
          updated_at?: string
          was_revised?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_runs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_runs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credentials: {
        Row: {
          config: Json
          created_at: string
          id: string
          provider: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          provider: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          provider?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_credentials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_events: {
        Row: {
          action: string
          created_at: string
          detail: Json | null
          event_key: string
          id: string
          provider: string
          status: string
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string
          detail?: Json | null
          event_key: string
          id?: string
          provider: string
          status?: string
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string
          detail?: Json | null
          event_key?: string
          id?: string
          provider?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          account: string | null
          created_at: string
          employee_id: string
          id: string
          provider: string
          status: string
          workspace_id: string
        }
        Insert: {
          account?: string | null
          created_at?: string
          employee_id: string
          id?: string
          provider: string
          status?: string
          workspace_id: string
        }
        Update: {
          account?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          provider?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      live_snapshots: {
        Row: {
          captured_at: string
          key: string
          kind: string
          payload: Json
        }
        Insert: {
          captured_at?: string
          key: string
          kind: string
          payload?: Json
        }
        Update: {
          captured_at?: string
          key?: string
          kind?: string
          payload?: Json
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string | null
          created_at: string
          employee_id: string
          id: string
          role: string
          workspace_id: string
        }
        Insert: {
          body: string
          conversation_id?: string | null
          created_at?: string
          employee_id: string
          id?: string
          role: string
          workspace_id: string
        }
        Update: {
          body?: string
          conversation_id?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          role?: string
          workspace_id?: string
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
            foreignKeyName: "messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_connections: {
        Row: {
          created_at: string
          id: string
          ig_user_id: string | null
          ig_username: string | null
          kind: string
          last_error: string | null
          page_access_token: string
          page_id: string
          page_name: string | null
          scopes: string[]
          status: string
          token_expires_at: string | null
          updated_at: string
          user_access_token: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ig_user_id?: string | null
          ig_username?: string | null
          kind: string
          last_error?: string | null
          page_access_token: string
          page_id: string
          page_name?: string | null
          scopes?: string[]
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_access_token?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ig_user_id?: string | null
          ig_username?: string | null
          kind?: string
          last_error?: string | null
          page_access_token?: string
          page_id?: string
          page_name?: string | null
          scopes?: string[]
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_access_token?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          approval_ready: boolean
          created_at: string
          digest_frequency: string
          integration_disconnected: boolean
          publishing_failed: boolean
          task_digest: boolean
          timezone: string
          updated_at: string
          user_id: string
          weekly_summary: boolean
        }
        Insert: {
          approval_ready?: boolean
          created_at?: string
          digest_frequency?: string
          integration_disconnected?: boolean
          publishing_failed?: boolean
          task_digest?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
          weekly_summary?: boolean
        }
        Update: {
          approval_ready?: boolean
          created_at?: string
          digest_frequency?: string
          integration_disconnected?: boolean
          publishing_failed?: boolean
          task_digest?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
          weekly_summary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pipedream_accounts: {
        Row: {
          account_id: string
          account_name: string | null
          app_slug: string
          connected_at: string
          healthy: boolean
          id: string
          instagram_business_id: string | null
          last_error: string | null
          page_id: string | null
          provider: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id: string
          account_name?: string | null
          app_slug: string
          connected_at?: string
          healthy?: boolean
          id?: string
          instagram_business_id?: string | null
          last_error?: string | null
          page_id?: string | null
          provider: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_id?: string
          account_name?: string | null
          app_slug?: string
          connected_at?: string
          healthy?: boolean
          id?: string
          instagram_business_id?: string | null
          last_error?: string | null
          page_id?: string | null
          provider?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipedream_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          dialect: string
          full_name: string | null
          id: string
          job_title: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          dialect?: string
          full_name?: string | null
          id: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          dialect?: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          impact: string | null
          priority: number
          reason: string
          signal: string
          skill_id: string | null
          status: string
          task_id: string | null
          title: string
          updated_at: string
          values: Json
          workspace_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          impact?: string | null
          priority?: number
          reason: string
          signal: string
          skill_id?: string | null
          status?: string
          task_id?: string | null
          title: string
          updated_at?: string
          values?: Json
          workspace_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          impact?: string | null
          priority?: number
          reason?: string
          signal?: string
          skill_id?: string | null
          status?: string
          task_id?: string | null
          title?: string
          updated_at?: string
          values?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rank_snapshots: {
        Row: {
          captured_at: string
          clicks: number | null
          competitors: Json | null
          id: string
          impressions: number | null
          keyword_id: string
          position: number | null
          source: string
          url: string | null
          workspace_id: string
        }
        Insert: {
          captured_at?: string
          clicks?: number | null
          competitors?: Json | null
          id?: string
          impressions?: number | null
          keyword_id: string
          position?: number | null
          source?: string
          url?: string | null
          workspace_id: string
        }
        Update: {
          captured_at?: string
          clicks?: number | null
          competitors?: Json | null
          id?: string
          impressions?: number | null
          keyword_id?: string
          position?: number | null
          source?: string
          url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rank_snapshots_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "tracked_keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rank_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          bucket: string
          hits: number
          id: string
          identifier: string
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          id?: string
          identifier: string
          window_start?: string
        }
        Update: {
          bucket?: string
          hits?: number
          id?: string
          identifier?: string
          window_start?: string
        }
        Relationships: []
      }
      serp_cache: {
        Row: {
          cache_key: string
          created_at: string
          payload: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          payload: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          payload?: Json
        }
        Relationships: []
      }
      site_assets: {
        Row: {
          alt: string | null
          created_at: string
          id: string
          kind: string
          page_url: string | null
          source: string
          url: string
          weight: number
          workspace_id: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          id?: string
          kind?: string
          page_url?: string | null
          source?: string
          url: string
          weight?: number
          workspace_id: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          id?: string
          kind?: string
          page_url?: string | null
          source?: string
          url?: string
          weight?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visits: {
        Row: {
          country: string | null
          created_at: string
          host: string | null
          id: string
          path: string
          referrer: string | null
          source: string | null
          visitor_hash: string | null
          workspace_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          host?: string | null
          id?: string
          path?: string
          referrer?: string | null
          source?: string | null
          visitor_hash?: string | null
          workspace_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          host?: string | null
          id?: string
          path?: string
          referrer?: string | null
          source?: string | null
          visitor_hash?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_visits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_autopilot: {
        Row: {
          active: boolean
          brief: string
          created_at: string
          days: number[]
          dialect: string
          employee_id: string
          hours: number[]
          id: string
          last_run_at: string | null
          last_status: string | null
          locked_at: string | null
          mode: string
          next_run_at: string
          paused_reason: string | null
          posts_per_day: number
          providers: string[]
          slots: string[]
          timezone: string
          updated_at: string
          with_image: boolean
          workspace_id: string
        }
        Insert: {
          active?: boolean
          brief?: string
          created_at?: string
          days?: number[]
          dialect?: string
          employee_id?: string
          hours?: number[]
          id?: string
          last_run_at?: string | null
          last_status?: string | null
          locked_at?: string | null
          mode?: string
          next_run_at?: string
          paused_reason?: string | null
          posts_per_day?: number
          providers?: string[]
          slots?: string[]
          timezone?: string
          updated_at?: string
          with_image?: boolean
          workspace_id: string
        }
        Update: {
          active?: boolean
          brief?: string
          created_at?: string
          days?: number[]
          dialect?: string
          employee_id?: string
          hours?: number[]
          id?: string
          last_run_at?: string | null
          last_status?: string | null
          locked_at?: string | null
          mode?: string
          next_run_at?: string
          paused_reason?: string | null
          posts_per_day?: number
          providers?: string[]
          slots?: string[]
          timezone?: string
          updated_at?: string
          with_image?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_autopilot_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          attempts: number
          body: string
          created_at: string
          employee_id: string
          id: string
          image_url: string | null
          last_error: string | null
          locked_at: string | null
          meta: Json
          metrics: Json | null
          provider: string
          published_at: string | null
          remote_ref: string | null
          scheduled_at: string
          status: string
          task_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attempts?: number
          body: string
          created_at?: string
          employee_id?: string
          id?: string
          image_url?: string | null
          last_error?: string | null
          locked_at?: string | null
          meta?: Json
          metrics?: Json | null
          provider: string
          published_at?: string | null
          remote_ref?: string | null
          scheduled_at?: string
          status?: string
          task_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attempts?: number
          body?: string
          created_at?: string
          employee_id?: string
          id?: string
          image_url?: string | null
          last_error?: string | null
          locked_at?: string | null
          meta?: Json
          metrics?: Json | null
          provider?: string
          published_at?: string | null
          remote_ref?: string | null
          scheduled_at?: string
          status?: string
          task_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          channel: string
          created_at: string
          detail: string | null
          employee_id: string
          id: string
          kind: string
          output: string | null
          scheduled: string | null
          status: string
          steps: Json
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          detail?: string | null
          employee_id: string
          id?: string
          kind?: string
          output?: string | null
          scheduled?: string | null
          status?: string
          steps?: Json
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          detail?: string | null
          employee_id?: string
          id?: string
          kind?: string
          output?: string | null
          scheduled?: string | null
          status?: string
          steps?: Json
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tracked_keywords: {
        Row: {
          active: boolean
          country: string
          created_at: string
          domain: string
          id: string
          keyword: string
          last_checked_at: string | null
          market: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          country?: string
          created_at?: string
          domain: string
          id?: string
          keyword: string
          last_checked_at?: string | null
          market?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          country?: string
          created_at?: string
          domain?: string
          id?: string
          keyword?: string
          last_checked_at?: string | null
          market?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracked_keywords_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          banned_words: string[]
          country: string | null
          created_at: string
          id: string
          industry: string
          initials: string
          name: string
          owner_id: string
          profile: Json
          tone: string
          updated_at: string
          website: string | null
        }
        Insert: {
          banned_words?: string[]
          country?: string | null
          created_at?: string
          id?: string
          industry?: string
          initials?: string
          name: string
          owner_id: string
          profile?: Json
          tone?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          banned_words?: string[]
          country?: string | null
          created_at?: string
          id?: string
          industry?: string
          initials?: string
          name?: string
          owner_id?: string
          profile?: Json
          tone?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bump_rate_limit: {
        Args: { _bucket: string; _identifier: string; _window_seconds: number }
        Returns: number
      }
      owns_workspace: { Args: { _workspace_id: string }; Returns: boolean }
      verify_cron_token: {
        Args: { _name: string; _token: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
