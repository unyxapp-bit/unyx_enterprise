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
      ai_agent_actions: {
        Row: {
          action_result: Json
          approved_at: string | null
          approved_by: string | null
          arguments: Json
          branch_id: string | null
          confidence: number
          confirmation_required: boolean
          context_snapshot: Json
          created_at: string
          created_by: string | null
          description: string
          id: string
          intent: string
          mode: string
          organization_id: string
          reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          snapshot_id: string | null
          source: string
          status: string
          target: Json | null
          title: string
          tool_name: string | null
          updated_at: string
        }
        Insert: {
          action_result?: Json
          approved_at?: string | null
          approved_by?: string | null
          arguments?: Json
          branch_id?: string | null
          confidence?: number
          confirmation_required?: boolean
          context_snapshot?: Json
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          intent?: string
          mode?: string
          organization_id: string
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          snapshot_id?: string | null
          source?: string
          status?: string
          target?: Json | null
          title: string
          tool_name?: string | null
          updated_at?: string
        }
        Update: {
          action_result?: Json
          approved_at?: string | null
          approved_by?: string | null
          arguments?: Json
          branch_id?: string | null
          confidence?: number
          confirmation_required?: boolean
          context_snapshot?: Json
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          intent?: string
          mode?: string
          organization_id?: string
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          snapshot_id?: string | null
          source?: string
          status?: string
          target?: Json | null
          title?: string
          tool_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_actions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_actions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_actions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_actions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_actions_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_snapshots: {
        Row: {
          action_status: string | null
          action_tool: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          intent: string
          model: string | null
          organization_id: string
          provider: string | null
          question: string | null
          result: Json
          target: Json | null
        }
        Insert: {
          action_status?: string | null
          action_tool?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          intent?: string
          model?: string | null
          organization_id: string
          provider?: string | null
          question?: string | null
          result: Json
          target?: Json | null
        }
        Update: {
          action_status?: string | null
          action_tool?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          intent?: string
          model?: string | null
          organization_id?: string
          provider?: string | null
          question?: string | null
          result?: Json
          target?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_snapshots_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_snapshots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_events: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          employee_id: string
          event_time: string
          event_type: Database["public"]["Enums"]["attendance_event_type"]
          id: string
          notes: string | null
          organization_id: string
          schedule_id: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          employee_id: string
          event_time?: string
          event_type: Database["public"]["Enums"]["attendance_event_type"]
          id?: string
          notes?: string | null
          organization_id: string
          schedule_id?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string
          event_time?: string
          event_type?: Database["public"]["Enums"]["attendance_event_type"]
          id?: string
          notes?: string | null
          organization_id?: string
          schedule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          branch_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
          organization_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          branch_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          organization_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          branch_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          organization_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          active: boolean
          address: string | null
          city: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          state: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          allocation_id: string | null
          branch_id: string
          confirmed_at: string
          confirmed_by: string | null
          created_at: string
          employee_id: string
          id: string
          movement_type: Database["public"]["Enums"]["cash_movement_type"]
          notes: string | null
          organization_id: string
          post_id: string
        }
        Insert: {
          allocation_id?: string | null
          branch_id: string
          confirmed_at?: string
          confirmed_by?: string | null
          created_at?: string
          employee_id: string
          id?: string
          movement_type: Database["public"]["Enums"]["cash_movement_type"]
          notes?: string | null
          organization_id: string
          post_id: string
        }
        Update: {
          allocation_id?: string | null
          branch_id?: string
          confirmed_at?: string
          confirmed_by?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          movement_type?: Database["public"]["Enums"]["cash_movement_type"]
          notes?: string | null
          organization_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "post_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "operational_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          branch_id: string
          closed_at: string | null
          created_at: string
          difference_amount: number | null
          employee_id: string | null
          expected_amount: number
          final_amount: number | null
          id: string
          initial_amount: number
          notes: string | null
          opened_at: string
          organization_id: string
          post_id: string | null
          status: Database["public"]["Enums"]["cash_session_status"]
          updated_at: string
          user_profile_id: string | null
        }
        Insert: {
          branch_id: string
          closed_at?: string | null
          created_at?: string
          difference_amount?: number | null
          employee_id?: string | null
          expected_amount?: number
          final_amount?: number | null
          id?: string
          initial_amount?: number
          notes?: string | null
          opened_at?: string
          organization_id: string
          post_id?: string | null
          status?: Database["public"]["Enums"]["cash_session_status"]
          updated_at?: string
          user_profile_id?: string | null
        }
        Update: {
          branch_id?: string
          closed_at?: string | null
          created_at?: string
          difference_amount?: number | null
          employee_id?: string | null
          expected_amount?: number
          final_amount?: number | null
          id?: string
          initial_amount?: number
          notes?: string | null
          opened_at?: string
          organization_id?: string
          post_id?: string | null
          status?: Database["public"]["Enums"]["cash_session_status"]
          updated_at?: string
          user_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "operational_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_procedures: {
        Row: {
          active: boolean
          branch_id: string | null
          category: string | null
          checklist_items: string[]
          created_at: string
          created_by: string | null
          estimated_minutes: number | null
          frequency: string
          id: string
          instructions: string | null
          organization_id: string
          owner_role: string | null
          sector_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id?: string | null
          category?: string | null
          checklist_items?: string[]
          created_at?: string
          created_by?: string | null
          estimated_minutes?: number | null
          frequency?: string
          id?: string
          instructions?: string | null
          organization_id: string
          owner_role?: string | null
          sector_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string | null
          category?: string | null
          checklist_items?: string[]
          created_at?: string
          created_by?: string | null
          estimated_minutes?: number | null
          frequency?: string
          id?: string
          instructions?: string | null
          organization_id?: string
          owner_role?: string | null
          sector_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_procedures_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_procedures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_procedures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_procedures_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_runs: {
        Row: {
          branch_id: string | null
          checked_items: string[]
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          procedure_id: string
          started_at: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          checked_items?: string[]
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          procedure_id: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          checked_items?: string[]
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          procedure_id?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_runs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_runs_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "checklist_procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comms_post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comms_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "comms_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comms_post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comms_post_reads: {
        Row: {
          post_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          post_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          post_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comms_post_reads_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "comms_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comms_post_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comms_posts: {
        Row: {
          author_id: string | null
          branch_id: string | null
          content: string
          created_at: string
          id: string
          organization_id: string
          pinned: boolean
          sector_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          branch_id?: string | null
          content: string
          created_at?: string
          id?: string
          organization_id: string
          pinned?: boolean
          sector_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          branch_id?: string | null
          content?: string
          created_at?: string
          id?: string
          organization_id?: string
          pinned?: boolean
          sector_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comms_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comms_posts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comms_posts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comms_posts_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_code_counters: {
        Row: {
          next_number: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          next_number?: number
          organization_id: string
          updated_at?: string
        }
        Update: {
          next_number?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_code_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_line: string | null
          address_number: string | null
          birth_date: string | null
          branch_id: string | null
          city: string | null
          complement: string | null
          created_at: string
          created_by: string | null
          customer_code: string
          document: string | null
          email: string | null
          id: string
          marketing_opt_in: boolean
          name: string
          neighborhood: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          postal_code: string | null
          reference: string | null
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address_line?: string | null
          address_number?: string | null
          birth_date?: string | null
          branch_id?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          created_by?: string | null
          customer_code: string
          document?: string | null
          email?: string | null
          id?: string
          marketing_opt_in?: boolean
          name: string
          neighborhood?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          postal_code?: string | null
          reference?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address_line?: string | null
          address_number?: string | null
          birth_date?: string | null
          branch_id?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          created_by?: string | null
          customer_code?: string
          document?: string | null
          email?: string | null
          id?: string
          marketing_opt_in?: boolean
          name?: string
          neighborhood?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          postal_code?: string | null
          reference?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_orders: {
        Row: {
          address_line: string
          address_number: string | null
          assigned_employee_id: string | null
          branch_id: string
          cancelled_at: string | null
          city: string | null
          complement: string | null
          courier_name: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          delivered_at: string | null
          delivery_fee: number
          dispatched_at: string | null
          estimated_delivery_at: string | null
          id: string
          items: Json
          neighborhood: string | null
          notes: string | null
          order_amount: number
          organization_id: string
          payment_status: string
          postal_code: string | null
          priority: string
          reference: string | null
          sale_id: string | null
          scheduled_for: string | null
          source: string
          state: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          address_line: string
          address_number?: string | null
          assigned_employee_id?: string | null
          branch_id: string
          cancelled_at?: string | null
          city?: string | null
          complement?: string | null
          courier_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_fee?: number
          dispatched_at?: string | null
          estimated_delivery_at?: string | null
          id?: string
          items?: Json
          neighborhood?: string | null
          notes?: string | null
          order_amount?: number
          organization_id: string
          payment_status?: string
          postal_code?: string | null
          priority?: string
          reference?: string | null
          sale_id?: string | null
          scheduled_for?: string | null
          source?: string
          state?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          address_line?: string
          address_number?: string | null
          assigned_employee_id?: string | null
          branch_id?: string
          cancelled_at?: string | null
          city?: string | null
          complement?: string | null
          courier_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_fee?: number
          dispatched_at?: string | null
          estimated_delivery_at?: string | null
          id?: string
          items?: Json
          neighborhood?: string | null
          notes?: string | null
          order_amount?: number
          organization_id?: string
          payment_status?: string
          postal_code?: string | null
          priority?: string
          reference?: string | null
          sale_id?: string | null
          scheduled_for?: string | null
          source?: string
          state?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_orders_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_pos_credentials: {
        Row: {
          active: boolean
          created_at: string
          employee_id: string
          organization_id: string
          pin_hash: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          employee_id: string
          organization_id: string
          pin_hash: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          employee_id?: string
          organization_id?: string
          pin_hash?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_pos_credentials_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_pos_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_pos_credentials_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          branch_id: string
          created_at: string
          document: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          role: string | null
          sector_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id: string
          created_at?: string
          document?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          role?: string | null
          sector_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string
          created_at?: string
          document?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          role?: string | null
          sector_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_document_counters: {
        Row: {
          branch_id: string
          created_at: string
          doc_type: string
          id: string
          next_number: number
          organization_id: string
          series: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          doc_type: string
          id?: string
          next_number?: number
          organization_id: string
          series?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          doc_type?: string
          id?: string
          next_number?: number
          organization_id?: string
          series?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_document_counters_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_document_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_documents: {
        Row: {
          branch_id: string
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          customer_snapshot: Json
          doc_type: string
          fiscal_key: string
          id: string
          issued_at: string
          issuer_snapshot: Json
          notes: string | null
          number: number
          operation_mode: string
          organization_id: string
          sale_id: string
          sefaz_authorized_at: string | null
          sefaz_protocol: string | null
          sefaz_rejection_reason: string | null
          series: string
          status: string
          totals_snapshot: Json
          updated_at: string
        }
        Insert: {
          branch_id: string
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_snapshot?: Json
          doc_type: string
          fiscal_key: string
          id?: string
          issued_at?: string
          issuer_snapshot?: Json
          notes?: string | null
          number: number
          operation_mode?: string
          organization_id: string
          sale_id: string
          sefaz_authorized_at?: string | null
          sefaz_protocol?: string | null
          sefaz_rejection_reason?: string | null
          series?: string
          status?: string
          totals_snapshot?: Json
          updated_at?: string
        }
        Update: {
          branch_id?: string
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_snapshot?: Json
          doc_type?: string
          fiscal_key?: string
          id?: string
          issued_at?: string
          issuer_snapshot?: Json
          notes?: string | null
          number?: number
          operation_mode?: string
          organization_id?: string
          sale_id?: string
          sefaz_authorized_at?: string | null
          sefaz_protocol?: string | null
          sefaz_rejection_reason?: string | null
          series?: string
          status?: string
          totals_snapshot?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_documents_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documents_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          branch_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          status: string
          token: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          token?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          key: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          name?: string
        }
        Relationships: []
      }
      operational_form_responses: {
        Row: {
          answers: Json
          branch_id: string | null
          created_at: string
          form_id: string
          id: string
          notes: string | null
          organization_id: string
          submitted_at: string
          user_id: string | null
        }
        Insert: {
          answers?: Json
          branch_id?: string | null
          created_at?: string
          form_id: string
          id?: string
          notes?: string | null
          organization_id: string
          submitted_at?: string
          user_id?: string | null
        }
        Update: {
          answers?: Json
          branch_id?: string | null
          created_at?: string
          form_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          submitted_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operational_form_responses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_form_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "operational_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_form_responses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_form_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_forms: {
        Row: {
          active: boolean
          branch_id: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          organization_id: string
          questions: string[]
          sector_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id: string
          questions?: string[]
          sector_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          questions?: string[]
          sector_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_forms_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_forms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_forms_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_notes: {
        Row: {
          active: boolean
          branch_id: string | null
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          due_at: string | null
          id: string
          organization_id: string
          priority: string
          resolved_at: string | null
          sector_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id?: string | null
          category?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          organization_id: string
          priority?: string
          resolved_at?: string | null
          sector_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string | null
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          organization_id?: string
          priority?: string
          resolved_at?: string | null
          sector_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_notes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_notes_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_posts: {
        Row: {
          active: boolean
          branch_id: string
          created_at: string
          id: string
          name: string
          organization_id: string
          sector_id: string | null
          type: Database["public"]["Enums"]["operational_post_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          sector_id?: string | null
          type?: Database["public"]["Enums"]["operational_post_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          sector_id?: string | null
          type?: Database["public"]["Enums"]["operational_post_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_posts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_posts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_posts_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_queue: {
        Row: {
          active_posts: number | null
          branch_id: string
          created_at: string
          created_by: string | null
          customer_count: number
          id: string
          notes: string | null
          organization_id: string
          post_id: string | null
          queue_type: string
          required_posts: number | null
          resolved_at: string | null
          resolved_by: string | null
          sector_id: string | null
          severity: string
          status: string
          title: string
          updated_at: string
          wait_minutes: number
        }
        Insert: {
          active_posts?: number | null
          branch_id: string
          created_at?: string
          created_by?: string | null
          customer_count?: number
          id?: string
          notes?: string | null
          organization_id: string
          post_id?: string | null
          queue_type?: string
          required_posts?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          sector_id?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
          wait_minutes?: number
        }
        Update: {
          active_posts?: number | null
          branch_id?: string
          created_at?: string
          created_by?: string | null
          customer_count?: number
          id?: string
          notes?: string | null
          organization_id?: string
          post_id?: string | null
          queue_type?: string
          required_posts?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          sector_id?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
          wait_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "operational_queue_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_queue_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_queue_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "operational_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_queue_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_queue_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_settings: {
        Row: {
          block_break_on_peak_hours: boolean
          branch_id: string | null
          break_tolerance_minutes: number
          cash_count_alert_amount: number
          coffee_break_duration_minutes: number
          coffee_break_enabled: boolean
          coffee_order: string | null
          coffee_window_end: string | null
          coffee_window_start: string | null
          created_at: string
          id: string
          late_tolerance_minutes: number
          mode: Database["public"]["Enums"]["business_segment"]
          organization_id: string
          peak_hours_end: string | null
          peak_hours_start: string | null
          queue_attention_threshold: number
          queue_critical_threshold: number
          require_cashier_cash_count: boolean
          require_coverage_before_break: boolean
          require_responsible_presence: boolean
          updated_at: string
        }
        Insert: {
          block_break_on_peak_hours?: boolean
          branch_id?: string | null
          break_tolerance_minutes?: number
          cash_count_alert_amount?: number
          coffee_break_duration_minutes?: number
          coffee_break_enabled?: boolean
          coffee_order?: string | null
          coffee_window_end?: string | null
          coffee_window_start?: string | null
          created_at?: string
          id?: string
          late_tolerance_minutes?: number
          mode?: Database["public"]["Enums"]["business_segment"]
          organization_id: string
          peak_hours_end?: string | null
          peak_hours_start?: string | null
          queue_attention_threshold?: number
          queue_critical_threshold?: number
          require_cashier_cash_count?: boolean
          require_coverage_before_break?: boolean
          require_responsible_presence?: boolean
          updated_at?: string
        }
        Update: {
          block_break_on_peak_hours?: boolean
          branch_id?: string | null
          break_tolerance_minutes?: number
          cash_count_alert_amount?: number
          coffee_break_duration_minutes?: number
          coffee_break_enabled?: boolean
          coffee_order?: string | null
          coffee_window_end?: string | null
          coffee_window_start?: string | null
          created_at?: string
          id?: string
          late_tolerance_minutes?: number
          mode?: Database["public"]["Enums"]["business_segment"]
          organization_id?: string
          peak_hours_end?: string | null
          peak_hours_start?: string | null
          queue_attention_threshold?: number
          queue_critical_threshold?: number
          require_cashier_cash_count?: boolean
          require_coverage_before_break?: boolean
          require_responsible_presence?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_status: {
        Row: {
          branch_id: string
          current_status: Database["public"]["Enums"]["operational_status_type"]
          delay_minutes: number
          employee_id: string
          id: string
          organization_id: string
          priority_level: number
          schedule_id: string | null
          status_reason: string | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          current_status?: Database["public"]["Enums"]["operational_status_type"]
          delay_minutes?: number
          employee_id: string
          id?: string
          organization_id: string
          priority_level?: number
          schedule_id?: string | null
          status_reason?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          current_status?: Database["public"]["Enums"]["operational_status_type"]
          delay_minutes?: number
          employee_id?: string
          id?: string
          organization_id?: string
          priority_level?: number
          schedule_id?: string | null
          status_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_status_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_status_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_status_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_status_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_modules: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          module_id: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          module_id: string
          organization_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          module_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_modules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          document: string | null
          id: string
          name: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          segment: Database["public"]["Enums"]["business_segment"]
          status: Database["public"]["Enums"]["organization_status"]
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document?: string | null
          id?: string
          name: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          segment?: Database["public"]["Enums"]["business_segment"]
          status?: Database["public"]["Enums"]["organization_status"]
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: string | null
          id?: string
          name?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          segment?: Database["public"]["Enums"]["business_segment"]
          status?: Database["public"]["Enums"]["organization_status"]
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pos_cash_movements: {
        Row: {
          amount: number
          branch_id: string
          cash_session_id: string
          created_at: string
          created_by: string | null
          id: string
          movement_type: Database["public"]["Enums"]["pos_cash_movement_type"]
          notes: string | null
          occurred_at: string
          organization_id: string
          post_id: string | null
        }
        Insert: {
          amount: number
          branch_id: string
          cash_session_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: Database["public"]["Enums"]["pos_cash_movement_type"]
          notes?: string | null
          occurred_at?: string
          organization_id: string
          post_id?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string
          cash_session_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: Database["public"]["Enums"]["pos_cash_movement_type"]
          notes?: string | null
          occurred_at?: string
          organization_id?: string
          post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_cash_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_cash_movements_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_cash_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_cash_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_cash_movements_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "operational_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_allocations: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          employee_id: string
          ended_at: string | null
          ended_by: string | null
          id: string
          notes: string | null
          organization_id: string
          post_id: string
          schedule_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["post_allocation_status"]
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          employee_id: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          post_id: string
          schedule_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["post_allocation_status"]
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          post_id?: string
          schedule_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["post_allocation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_allocations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_allocations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_allocations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_allocations_ended_by_fkey"
            columns: ["ended_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_allocations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_allocations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "operational_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_allocations_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          active: boolean
          branch_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          segment: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          segment?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          segment?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          active: boolean
          barcode: string | null
          cost_price: number | null
          created_at: string
          id: string
          name: string
          organization_id: string
          price: number
          product_id: string
          sku: string | null
          sort_order: number
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          barcode?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          price?: number
          product_id: string
          sku?: string | null
          sort_order?: number
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          barcode?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          price?: number
          product_id?: string
          sku?: string | null
          sort_order?: number
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_order_items: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          product_id: string | null
          product_name: string
          production_order_id: string
          quantity: number
          sort_order: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          product_id?: string | null
          product_name: string
          production_order_id: string
          quantity?: number
          sort_order?: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          product_id?: string | null
          product_name?: string
          production_order_id?: string
          quantity?: number
          sort_order?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_items_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          notes: string | null
          order_code: string
          ordered_at: string
          organization_id: string
          priority: string
          promised_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          notes?: string | null
          order_code: string
          ordered_at?: string
          organization_id: string
          priority?: string
          promised_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          notes?: string | null
          order_code?: string
          ordered_at?: string
          organization_id?: string
          priority?: string
          promised_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          allow_fractional_quantity: boolean
          barcode: string | null
          branch_id: string | null
          brand: string | null
          category: string | null
          category_id: string | null
          controlled_substance: boolean
          cost_price: number | null
          created_at: string
          description: string | null
          dosage: string | null
          id: string
          min_stock_quantity: number
          name: string
          organization_id: string
          perishable: boolean
          preparation_time_minutes: number | null
          prescription_required: boolean
          price: number
          product_kind: string
          size_label: string | null
          sku: string | null
          stock_quantity: number
          track_inventory: boolean
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          allow_fractional_quantity?: boolean
          barcode?: string | null
          branch_id?: string | null
          brand?: string | null
          category?: string | null
          category_id?: string | null
          controlled_substance?: boolean
          cost_price?: number | null
          created_at?: string
          description?: string | null
          dosage?: string | null
          id?: string
          min_stock_quantity?: number
          name: string
          organization_id: string
          perishable?: boolean
          preparation_time_minutes?: number | null
          prescription_required?: boolean
          price?: number
          product_kind?: string
          size_label?: string | null
          sku?: string | null
          stock_quantity?: number
          track_inventory?: boolean
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          allow_fractional_quantity?: boolean
          barcode?: string | null
          branch_id?: string | null
          brand?: string | null
          category?: string | null
          category_id?: string | null
          controlled_substance?: boolean
          cost_price?: number | null
          created_at?: string
          description?: string | null
          dosage?: string | null
          id?: string
          min_stock_quantity?: number
          name?: string
          organization_id?: string
          perishable?: boolean
          preparation_time_minutes?: number | null
          prescription_required?: boolean
          price?: number
          product_kind?: string
          size_label?: string | null
          sku?: string | null
          stock_quantity?: number
          track_inventory?: boolean
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          discount_amount: number
          id: string
          organization_id: string
          product_id: string | null
          product_name: string
          quantity: number
          sale_id: string
          total_amount: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          discount_amount?: number
          id?: string
          organization_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          sale_id: string
          total_amount?: number
          unit_price?: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          discount_amount?: number
          id?: string
          organization_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_id?: string
          total_amount?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_payments: {
        Row: {
          amount: number
          change_amount: number
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          organization_id: string
          paid_at: string
          sale_id: string
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          change_amount?: number
          created_at?: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          organization_id: string
          paid_at?: string
          sale_id: string
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          change_amount?: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          organization_id?: string
          paid_at?: string
          sale_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          branch_id: string
          cancel_reason: string | null
          cancelled_at: string | null
          cash_session_id: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          discount_amount: number
          employee_id: string | null
          id: string
          manager_authorization: string | null
          notes: string | null
          organization_id: string
          post_id: string | null
          sale_mode: Database["public"]["Enums"]["business_segment"] | null
          sold_at: string
          status: Database["public"]["Enums"]["sale_status"]
          subtotal: number
          total_amount: number
          updated_at: string
          user_profile_id: string | null
        }
        Insert: {
          branch_id: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cash_session_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          discount_amount?: number
          employee_id?: string | null
          id?: string
          manager_authorization?: string | null
          notes?: string | null
          organization_id: string
          post_id?: string | null
          sale_mode?: Database["public"]["Enums"]["business_segment"] | null
          sold_at?: string
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          total_amount?: number
          updated_at?: string
          user_profile_id?: string | null
        }
        Update: {
          branch_id?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cash_session_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          discount_amount?: number
          employee_id?: string | null
          id?: string
          manager_authorization?: string | null
          notes?: string | null
          organization_id?: string
          post_id?: string | null
          sale_mode?: Database["public"]["Enums"]["business_segment"] | null
          sold_at?: string
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          total_amount?: number
          updated_at?: string
          user_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "operational_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          branch_id: string
          break_end: string | null
          break_start: string | null
          created_at: string
          employee_id: string
          end_time: string | null
          id: string
          notes: string | null
          organization_id: string
          start_time: string | null
          status: Database["public"]["Enums"]["schedule_status"]
          updated_at: string
          work_date: string
        }
        Insert: {
          branch_id: string
          break_end?: string | null
          break_start?: string | null
          created_at?: string
          employee_id: string
          end_time?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
          work_date: string
        }
        Update: {
          branch_id?: string
          break_end?: string | null
          break_start?: string | null
          created_at?: string
          employee_id?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          active: boolean
          branch_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sectors_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sectors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          max_branches: number
          max_employees: number
          organization_id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          max_branches?: number
          max_employees?: number
          organization_id: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          max_branches?: number
          max_employees?: number
          organization_id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_items: {
        Row: {
          active: boolean
          content_url: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          organization_id: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          content_url?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          organization_id: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          content_url?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          organization_id?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          training_id: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          training_id: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          training_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_progress_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "training_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          active: boolean
          auth_user_id: string
          branch_id: string | null
          created_at: string
          custom_permissions: string[] | null
          email: string
          id: string
          name: string
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          auth_user_id: string
          branch_id?: string | null
          created_at?: string
          custom_permissions?: string[] | null
          email: string
          id?: string
          name: string
          organization_id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          auth_user_id?: string
          branch_id?: string | null
          created_at?: string
          custom_permissions?: string[] | null
          email?: string
          id?: string
          name?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_operational_dashboard: {
        Row: {
          branch_id: string | null
          branch_name: string | null
          break_end: string | null
          break_start: string | null
          current_status:
            | Database["public"]["Enums"]["operational_status_type"]
            | null
          delay_minutes: number | null
          employee_id: string | null
          employee_name: string | null
          employee_role: string | null
          end_time: string | null
          id: string | null
          organization_id: string | null
          priority_level: number | null
          sector_name: string | null
          start_time: string | null
          status_reason: string | null
          updated_at: string | null
          work_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      allocate_post: {
        Args: {
          p_employee_id: string
          p_notes?: string
          p_post_id: string
          p_schedule_id?: string
        }
        Returns: {
          branch_id: string
          created_at: string
          created_by: string | null
          employee_id: string
          ended_at: string | null
          ended_by: string | null
          id: string
          notes: string | null
          organization_id: string
          post_id: string
          schedule_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["post_allocation_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "post_allocations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_manage_branch: {
        Args: { target_branch_id: string }
        Returns: boolean
      }
      cancel_invitation: { Args: { p_invitation_id: string }; Returns: boolean }
      complete_current_user_onboarding: {
        Args: {
          p_address?: string
          p_branch_name?: string
          p_city?: string
          p_document?: string
          p_organization_name: string
          p_profile_name: string
          p_segment?: Database["public"]["Enums"]["business_segment"]
          p_state?: string
          p_trade_name?: string
        }
        Returns: string
      }
      confirm_cash_movement: {
        Args: {
          p_allocation_id: string
          p_movement_type: Database["public"]["Enums"]["cash_movement_type"]
          p_notes?: string
        }
        Returns: {
          allocation_id: string | null
          branch_id: string
          confirmed_at: string
          confirmed_by: string | null
          created_at: string
          employee_id: string
          id: string
          movement_type: Database["public"]["Enums"]["cash_movement_type"]
          notes: string | null
          organization_id: string
          post_id: string
        }
        SetofOptions: {
          from: "*"
          to: "cash_movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_operational_post: {
        Args: {
          p_active?: boolean
          p_branch_id: string
          p_name: string
          p_sector_id?: string
          p_type?: Database["public"]["Enums"]["operational_post_type"]
        }
        Returns: string
      }
      current_branch_id: { Args: never; Returns: string }
      current_organization_id: { Args: never; Returns: string }
      current_user_profile_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      finalize_post_allocation: {
        Args: { p_allocation_id: string; p_notes?: string }
        Returns: {
          branch_id: string
          created_at: string
          created_by: string | null
          employee_id: string
          ended_at: string | null
          ended_by: string | null
          id: string
          notes: string | null
          organization_id: string
          post_id: string
          schedule_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["post_allocation_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "post_allocations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fiscal_create_document_from_sale: {
        Args: {
          p_doc_type?: string
          p_notes?: string
          p_sale_id: string
          p_series?: string
        }
        Returns: {
          branch_id: string
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          customer_snapshot: Json
          doc_type: string
          fiscal_key: string
          id: string
          issued_at: string
          issuer_snapshot: Json
          notes: string | null
          number: number
          operation_mode: string
          organization_id: string
          sale_id: string
          sefaz_authorized_at: string | null
          sefaz_protocol: string | null
          sefaz_rejection_reason: string | null
          series: string
          status: string
          totals_snapshot: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "fiscal_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      invite_user: {
        Args: {
          p_branch_id?: string
          p_email: string
          p_role?: Database["public"]["Enums"]["user_role"]
        }
        Returns: string
      }
      is_org_admin: { Args: never; Returns: boolean }
      mark_invitation_accepted: { Args: { p_email: string }; Returns: boolean }
      pos_close_cash_session: {
        Args: { p_final_amount: number; p_notes?: string; p_session_id: string }
        Returns: undefined
      }
      pos_complete_sale: {
        Args: {
          p_branch_id: string
          p_customer_id?: string
          p_customer_name?: string
          p_discount_amount?: number
          p_items?: Json
          p_manager_authorization?: string
          p_notes?: string
          p_operator_employee_id?: string
          p_operator_password?: string
          p_payments?: Json
          p_post_id?: string
          p_sale_mode?: Database["public"]["Enums"]["business_segment"]
          p_session_id: string
        }
        Returns: string
      }
      pos_create_cash_movement: {
        Args: {
          p_amount: number
          p_movement_type: Database["public"]["Enums"]["pos_cash_movement_type"]
          p_notes?: string
          p_session_id: string
        }
        Returns: string
      }
      pos_open_cash_session: {
        Args: {
          p_branch_id: string
          p_employee_id?: string
          p_initial_amount?: number
          p_notes?: string
          p_post_id?: string
        }
        Returns: string
      }
      pos_set_operator_password: {
        Args: { p_active?: boolean; p_employee_id: string; p_password: string }
        Returns: undefined
      }
      pos_verify_operator: {
        Args: {
          p_employee_id: string
          p_password: string
          p_session_id: string
        }
        Returns: {
          employee_id: string
          employee_name: string
        }[]
      }
      record_break_already_done: {
        Args: {
          p_branch_id: string
          p_employee_id: string
          p_notes?: string
          p_schedule_id: string
        }
        Returns: {
          branch_id: string
          created_at: string
          created_by: string | null
          employee_id: string
          event_time: string
          event_type: Database["public"]["Enums"]["attendance_event_type"]
          id: string
          notes: string | null
          organization_id: string
          schedule_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "attendance_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_operational_action: {
        Args: {
          p_branch_id: string
          p_delay_minutes?: number
          p_employee_id: string
          p_event_type: Database["public"]["Enums"]["attendance_event_type"]
          p_notes?: string
          p_schedule_id: string
        }
        Returns: {
          branch_id: string
          created_at: string
          created_by: string | null
          employee_id: string
          event_time: string
          event_type: Database["public"]["Enums"]["attendance_event_type"]
          id: string
          notes: string | null
          organization_id: string
          schedule_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "attendance_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_user_from_org: { Args: { p_profile_id: string }; Returns: boolean }
      set_user_active: {
        Args: { p_active: boolean; p_profile_id: string }
        Returns: boolean
      }
      set_user_branch: {
        Args: { p_branch_id: string; p_profile_id: string }
        Returns: boolean
      }
      setup_segment_defaults: {
        Args: {
          p_branch_id: string
          p_post_definitions: Json
          p_sector_names: string[]
        }
        Returns: Json
      }
      transfer_post_allocation: {
        Args: {
          p_allocation_id: string
          p_next_employee_id: string
          p_next_schedule_id?: string
          p_notes?: string
        }
        Returns: {
          branch_id: string
          created_at: string
          created_by: string | null
          employee_id: string
          ended_at: string | null
          ended_by: string | null
          id: string
          notes: string | null
          organization_id: string
          post_id: string
          schedule_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["post_allocation_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "post_allocations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_current_user_profile: {
        Args: { p_branch_id?: string; p_email: string; p_name: string }
        Returns: {
          active: boolean
          auth_user_id: string
          branch_id: string | null
          created_at: string
          custom_permissions: string[] | null
          email: string
          id: string
          name: string
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "user_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_operational_post_record: {
        Args: {
          p_active?: boolean
          p_clear_sector?: boolean
          p_name?: string
          p_post_id: string
          p_sector_id?: string
          p_type?: Database["public"]["Enums"]["operational_post_type"]
        }
        Returns: boolean
      }
      update_organization_plan: {
        Args: { p_plan: Database["public"]["Enums"]["subscription_plan"] }
        Returns: {
          created_at: string
          document: string | null
          id: string
          name: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          segment: Database["public"]["Enums"]["business_segment"]
          status: Database["public"]["Enums"]["organization_status"]
          trade_name: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      attendance_event_type:
        | "entrada_confirmada"
        | "atraso_detectado"
        | "falta_detectada"
        | "intervalo_solicitado"
        | "sangria_confirmada"
        | "troca_caixa_confirmada"
        | "intervalo_iniciado"
        | "retorno_confirmado"
        | "saida_confirmada"
        | "ocorrencia_registrada"
      business_segment:
        | "retail_store"
        | "supermarket"
        | "restaurant"
        | "pharmacy"
        | "other"
      cash_movement_type:
        | "sangria_confirmada"
        | "abertura_caixa"
        | "fechamento_caixa"
        | "troco_reforco"
      cash_session_status: "open" | "closed" | "cancelled"
      operational_post_type:
        | "cashier"
        | "self_checkout"
        | "counter"
        | "service_desk"
        | "delivery"
        | "stock"
        | "kitchen"
        | "reception"
        | "other"
      operational_status_type:
        | "trabalhando"
        | "deve_sair"
        | "aguardando_sangria"
        | "troca_de_caixa"
        | "em_intervalo"
        | "voltou"
        | "folga"
        | "alerta_critico"
        | "aguardando_evento"
        | "finalizado"
        | "pico"
        | "apoio_operacional"
        | "fechamento"
      organization_status:
        | "active"
        | "inactive"
        | "trial"
        | "suspended"
        | "cancelled"
      payment_method:
        | "cash"
        | "pix"
        | "debit_card"
        | "credit_card"
        | "voucher"
        | "other"
      payment_status: "pending" | "confirmed" | "cancelled"
      pos_cash_movement_type:
        | "sale_cash_in"
        | "cash_out"
        | "cash_in"
        | "sangria"
        | "change_reinforcement"
        | "adjustment"
      post_allocation_status:
        | "alocado"
        | "aguardando_troca"
        | "em_troca"
        | "finalizado"
        | "sem_cobertura"
      sale_status: "draft" | "completed" | "cancelled" | "refunded"
      schedule_status:
        | "scheduled"
        | "working"
        | "on_break"
        | "returned"
        | "finished"
        | "absent"
        | "day_off"
        | "cancelled"
        | "banked_hours"
      subscription_plan: "starter" | "growth" | "enterprise"
      subscription_status:
        | "trial"
        | "active"
        | "past_due"
        | "cancelled"
        | "suspended"
      user_role:
        | "owner"
        | "admin"
        | "branch_manager"
        | "supervisor"
        | "operator"
        | "employee"
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
      attendance_event_type: [
        "entrada_confirmada",
        "atraso_detectado",
        "falta_detectada",
        "intervalo_solicitado",
        "sangria_confirmada",
        "troca_caixa_confirmada",
        "intervalo_iniciado",
        "retorno_confirmado",
        "saida_confirmada",
        "ocorrencia_registrada",
      ],
      business_segment: [
        "retail_store",
        "supermarket",
        "restaurant",
        "pharmacy",
        "other",
      ],
      cash_movement_type: [
        "sangria_confirmada",
        "abertura_caixa",
        "fechamento_caixa",
        "troco_reforco",
      ],
      cash_session_status: ["open", "closed", "cancelled"],
      operational_post_type: [
        "cashier",
        "self_checkout",
        "counter",
        "service_desk",
        "delivery",
        "stock",
        "kitchen",
        "reception",
        "other",
      ],
      operational_status_type: [
        "trabalhando",
        "deve_sair",
        "aguardando_sangria",
        "troca_de_caixa",
        "em_intervalo",
        "voltou",
        "folga",
        "alerta_critico",
        "aguardando_evento",
        "finalizado",
        "pico",
        "apoio_operacional",
        "fechamento",
      ],
      organization_status: [
        "active",
        "inactive",
        "trial",
        "suspended",
        "cancelled",
      ],
      payment_method: [
        "cash",
        "pix",
        "debit_card",
        "credit_card",
        "voucher",
        "other",
      ],
      payment_status: ["pending", "confirmed", "cancelled"],
      pos_cash_movement_type: [
        "sale_cash_in",
        "cash_out",
        "cash_in",
        "sangria",
        "change_reinforcement",
        "adjustment",
      ],
      post_allocation_status: [
        "alocado",
        "aguardando_troca",
        "em_troca",
        "finalizado",
        "sem_cobertura",
      ],
      sale_status: ["draft", "completed", "cancelled", "refunded"],
      schedule_status: [
        "scheduled",
        "working",
        "on_break",
        "returned",
        "finished",
        "absent",
        "day_off",
        "cancelled",
        "banked_hours",
      ],
      subscription_plan: ["starter", "growth", "enterprise"],
      subscription_status: [
        "trial",
        "active",
        "past_due",
        "cancelled",
        "suspended",
      ],
      user_role: [
        "owner",
        "admin",
        "branch_manager",
        "supervisor",
        "operator",
        "employee",
      ],
    },
  },
} as const
