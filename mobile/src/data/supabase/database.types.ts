// GENERATED from the Supabase schema. Do not edit by hand.
// Regenerate after every migration (Supabase MCP `generate_typescript_types`, or
// `npx supabase gen types typescript --project-id <ref>`), then run `npm run typecheck`:
// src/data/supabase/schemaDrift.ts fails to compile if the Zod row contracts drift.
//
// Data layer only. Domain and UI code must never import these types.

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
      affiliation_records: {
        Row: {
          affiliation_type: Database["public"]["Enums"]["affiliation_type"]
          approved_by: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          organization_id: string
          person_id: string
          publication_status: Database["public"]["Enums"]["publication_status"]
          published_at: string | null
          published_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          affiliation_type: Database["public"]["Enums"]["affiliation_type"]
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          organization_id: string
          person_id: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          affiliation_type?: Database["public"]["Enums"]["affiliation_type"]
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          organization_id?: string
          person_id?: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliation_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "political_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliation_records_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_disclosure_records: {
        Row: {
          approved_by: string | null
          created_at: string
          created_by: string | null
          currency: Database["public"]["Enums"]["currency_code"] | null
          disclosure_type: string
          id: string
          net_worth_amount: number | null
          person_id: string
          publication_status: Database["public"]["Enums"]["publication_status"]
          published_at: string | null
          published_by: string | null
          reporting_date: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"] | null
          disclosure_type: string
          id?: string
          net_worth_amount?: number | null
          person_id: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reporting_date?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"] | null
          disclosure_type?: string
          id?: string
          net_worth_amount?: number | null
          person_id?: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reporting_date?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_disclosure_records_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      award_records: {
        Row: {
          approved_by: string | null
          awarded_at: string | null
          created_at: string
          created_by: string | null
          id: string
          issuer: string
          person_id: string
          publication_status: Database["public"]["Enums"]["publication_status"]
          published_at: string | null
          published_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          awarded_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          issuer: string
          person_id: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          awarded_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          issuer?: string
          person_id?: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "award_records_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_evidence: {
        Row: {
          claim_id: string
          created_at: string
          created_by: string | null
          note: string | null
          source_id: string
          supports: boolean
          updated_at: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          created_by?: string | null
          note?: string | null
          source_id: string
          supports: boolean
          updated_at?: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          created_by?: string | null
          note?: string | null
          source_id?: string
          supports?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_evidence_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_evidence_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          approved_by: string | null
          claim_type: string
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          last_reviewed_at: string | null
          publication_status: Database["public"]["Enums"]["publication_status"]
          published_at: string | null
          published_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          statement: string
          subject_person_id: string | null
          subject_record_id: string | null
          subject_record_type:
            | Database["public"]["Enums"]["claim_subject_record_type"]
            | null
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          approved_by?: string | null
          claim_type: string
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          last_reviewed_at?: string | null
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          statement: string
          subject_person_id?: string | null
          subject_record_id?: string | null
          subject_record_type?:
            | Database["public"]["Enums"]["claim_subject_record_type"]
            | null
          updated_at?: string
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          approved_by?: string | null
          claim_type?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          last_reviewed_at?: string | null
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          statement?: string
          subject_person_id?: string | null
          subject_record_id?: string | null
          subject_record_type?:
            | Database["public"]["Enums"]["claim_subject_record_type"]
            | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "claims_subject_person_id_fkey"
            columns: ["subject_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      editorial_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          role: Database["public"]["Enums"]["editorial_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role: Database["public"]["Enums"]["editorial_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role?: Database["public"]["Enums"]["editorial_role"]
          user_id?: string
        }
        Relationships: []
      }
      education_records: {
        Row: {
          approved_by: string | null
          created_at: string
          created_by: string | null
          credential: string | null
          end_date: string | null
          id: string
          institution: string
          person_id: string
          program: string | null
          publication_status: Database["public"]["Enums"]["publication_status"]
          published_at: string | null
          published_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          credential?: string | null
          end_date?: string | null
          id?: string
          institution: string
          person_id: string
          program?: string | null
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          credential?: string | null
          end_date?: string | null
          id?: string
          institution?: string
          person_id?: string
          program?: string | null
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "education_records_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      election_participations: {
        Row: {
          approved_by: string | null
          ballot_number: string | null
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          election_id: string
          id: string
          office_id: string
          person_id: string
          publication_status: Database["public"]["Enums"]["publication_status"]
          published_at: string | null
          published_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["election_participation_status"]
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          ballot_number?: string | null
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          election_id: string
          id?: string
          office_id: string
          person_id: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status: Database["public"]["Enums"]["election_participation_status"]
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          ballot_number?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          election_id?: string
          id?: string
          office_id?: string
          person_id?: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["election_participation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "election_participations_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_participations_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_participations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      elections: {
        Row: {
          approved_by: string | null
          country_code: string
          created_at: string
          created_by: string | null
          election_date: string
          id: string
          name: string
          publication_status: Database["public"]["Enums"]["publication_status"]
          published_at: string | null
          published_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["election_status"]
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          election_date: string
          id?: string
          name: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status: Database["public"]["Enums"]["election_status"]
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          election_date?: string
          id?: string
          name?: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["election_status"]
          updated_at?: string
        }
        Relationships: []
      }
      legal_case_records: {
        Row: {
          approved_by: string | null
          authority: string
          case_number: string | null
          created_at: string
          created_by: string | null
          filing_date: string | null
          id: string
          neutral_summary: string | null
          person_id: string
          proceeding_type: string | null
          publication_status: Database["public"]["Enums"]["publication_status"]
          published_at: string | null
          published_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["legal_case_status"]
          status_date: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          authority: string
          case_number?: string | null
          created_at?: string
          created_by?: string | null
          filing_date?: string | null
          id?: string
          neutral_summary?: string | null
          person_id: string
          proceeding_type?: string | null
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status: Database["public"]["Enums"]["legal_case_status"]
          status_date?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          authority?: string
          case_number?: string | null
          created_at?: string
          created_by?: string | null
          filing_date?: string | null
          id?: string
          neutral_summary?: string | null
          person_id?: string
          proceeding_type?: string | null
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["legal_case_status"]
          status_date?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_case_records_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      office_terms: {
        Row: {
          approved_by: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          office_id: string
          person_id: string
          publication_status: Database["public"]["Enums"]["publication_status"]
          published_at: string | null
          published_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["office_term_status"]
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          office_id: string
          person_id: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string | null
          status: Database["public"]["Enums"]["office_term_status"]
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          office_id?: string
          person_id?: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["office_term_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_terms_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_terms_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          jurisdiction_id: string | null
          level: Database["public"]["Enums"]["office_level"]
          name: string
          publication_status: Database["public"]["Enums"]["publication_status"]
          published_at: string | null
          published_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          jurisdiction_id?: string | null
          level: Database["public"]["Enums"]["office_level"]
          name: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          jurisdiction_id?: string | null
          level?: Database["public"]["Enums"]["office_level"]
          name?: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          approved_by: string | null
          birth_date: string | null
          created_at: string
          created_by: string | null
          first_name: string
          id: string
          last_name: string
          middle_name: string | null
          photo_asset_id: string | null
          preferred_name: string | null
          publication_status: Database["public"]["Enums"]["publication_status"]
          published_at: string | null
          published_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          suffix: string | null
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          first_name: string
          id?: string
          last_name: string
          middle_name?: string | null
          photo_asset_id?: string | null
          preferred_name?: string | null
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          suffix?: string | null
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          first_name?: string
          id?: string
          last_name?: string
          middle_name?: string | null
          photo_asset_id?: string | null
          preferred_name?: string | null
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          suffix?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      policy_position_records: {
        Row: {
          approved_by: string | null
          attribution_type: Database["public"]["Enums"]["policy_attribution_type"]
          created_at: string
          created_by: string | null
          id: string
          person_id: string
          position_text: string
          publication_status: Database["public"]["Enums"]["publication_status"]
          published_at: string | null
          published_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          stated_at: string | null
          topic: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          attribution_type: Database["public"]["Enums"]["policy_attribution_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          person_id: string
          position_text: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          stated_at?: string | null
          topic: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          attribution_type?: Database["public"]["Enums"]["policy_attribution_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          person_id?: string
          position_text?: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          stated_at?: string | null
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_position_records_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      political_organizations: {
        Row: {
          abbreviation: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_type: Database["public"]["Enums"]["political_organization_type"]
          publication_status: Database["public"]["Enums"]["publication_status"]
          published_at: string | null
          published_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          updated_at: string
        }
        Insert: {
          abbreviation?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_type: Database["public"]["Enums"]["political_organization_type"]
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Update: {
          abbreviation?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_type?: Database["public"]["Enums"]["political_organization_type"]
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      revisions: {
        Row: {
          approval_state: Database["public"]["Enums"]["publication_status"]
          approver_id: string | null
          created_at: string
          editor_id: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["revision_entity_type"]
          id: string
          new_value: Json | null
          old_value: Json | null
          reason: string
        }
        Insert: {
          approval_state: Database["public"]["Enums"]["publication_status"]
          approver_id?: string | null
          created_at?: string
          editor_id: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["revision_entity_type"]
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason: string
        }
        Update: {
          approval_state?: Database["public"]["Enums"]["publication_status"]
          approver_id?: string | null
          created_at?: string
          editor_id?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["revision_entity_type"]
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          approved_by: string | null
          archived_url: string | null
          created_at: string
          created_by: string | null
          document_identifier: string | null
          id: string
          publication_status: Database["public"]["Enums"]["publication_status"]
          published_at: string | null
          published_by: string | null
          publisher: string
          record_published_at: string | null
          retrieved_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_type: Database["public"]["Enums"]["source_type"]
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          approved_by?: string | null
          archived_url?: string | null
          created_at?: string
          created_by?: string | null
          document_identifier?: string | null
          id?: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          publisher: string
          record_published_at?: string | null
          retrieved_at: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_type: Database["public"]["Enums"]["source_type"]
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          approved_by?: string | null
          archived_url?: string | null
          created_at?: string
          created_by?: string | null
          document_identifier?: string | null
          id?: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          published_by?: string | null
          publisher?: string
          record_published_at?: string | null
          retrieved_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_type?: Database["public"]["Enums"]["source_type"]
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      affiliation_type:
        | "MEMBER"
        | "CANDIDATE"
        | "LEADER"
        | "ENDORSED_BY"
        | "COALITION"
      claim_subject_record_type:
        | "PERSON"
        | "ELECTION_PARTICIPATION"
        | "OFFICE_TERM"
        | "AFFILIATION"
        | "EDUCATION"
        | "AWARD"
        | "POLICY_POSITION"
        | "LEGAL_CASE"
        | "ASSET_DISCLOSURE"
      currency_code: "PHP"
      editorial_role: "REVIEWER" | "APPROVER" | "ADMIN"
      election_participation_status:
        | "POTENTIAL_ASPIRANT"
        | "PUBLICLY_DECLARED_ASPIRANT"
        | "FILED_COC"
        | "OFFICIAL_CANDIDATE"
        | "WITHDRAWN"
        | "DISQUALIFIED"
        | "ELECTED"
        | "NOT_ELECTED"
      election_status: "UPCOMING" | "ONGOING" | "COMPLETED"
      legal_case_status:
        | "COMPLAINT"
        | "UNDER_INVESTIGATION"
        | "CASE_FILED"
        | "CHARGED"
        | "PENDING"
        | "DISMISSED"
        | "ACQUITTED"
        | "CONVICTED"
        | "ON_APPEAL"
        | "FINAL_JUDGMENT"
        | "OTHER"
      office_level:
        | "NATIONAL"
        | "PROVINCIAL"
        | "CITY"
        | "MUNICIPAL"
        | "DISTRICT"
        | "BARANGAY"
      office_term_status: "HELD" | "ACTING" | "APPOINTED" | "ELECTED"
      policy_attribution_type:
        | "SELF_DECLARED"
        | "OFFICIAL_PLATFORM"
        | "LEGISLATIVE_ACTION"
        | "INTERVIEW"
        | "SPEECH"
      political_organization_type:
        | "POLITICAL_PARTY"
        | "PARTY_LIST"
        | "COALITION"
        | "OTHER"
      publication_status:
        | "DRAFT"
        | "SOURCE_ATTACHED"
        | "REVIEWED"
        | "APPROVED"
        | "PUBLISHED"
        | "RETRACTED"
        | "REJECTED"
      revision_entity_type:
        | "PERSON"
        | "ELECTION"
        | "OFFICE"
        | "POLITICAL_ORGANIZATION"
        | "ELECTION_PARTICIPATION"
        | "OFFICE_TERM"
        | "AFFILIATION"
        | "EDUCATION"
        | "AWARD"
        | "POLICY_POSITION"
        | "LEGAL_CASE"
        | "ASSET_DISCLOSURE"
        | "SOURCE"
        | "CLAIM"
        | "CLAIM_EVIDENCE"
      source_type:
        | "OFFICIAL_GOVERNMENT"
        | "COURT_OR_TRIBUNAL"
        | "OFFICIAL_CANDIDATE"
        | "LEGISLATIVE_RECORD"
        | "NEWS"
        | "ACADEMIC"
        | "OTHER"
      verification_status:
        | "PRIMARY_SOURCE"
        | "CORROBORATED"
        | "SELF_DECLARED"
        | "REPORTED"
        | "DISPUTED"
        | "UNVERIFIED"
        | "OUTDATED"
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
    Enums: {
      affiliation_type: [
        "MEMBER",
        "CANDIDATE",
        "LEADER",
        "ENDORSED_BY",
        "COALITION",
      ],
      claim_subject_record_type: [
        "PERSON",
        "ELECTION_PARTICIPATION",
        "OFFICE_TERM",
        "AFFILIATION",
        "EDUCATION",
        "AWARD",
        "POLICY_POSITION",
        "LEGAL_CASE",
        "ASSET_DISCLOSURE",
      ],
      currency_code: ["PHP"],
      editorial_role: ["REVIEWER", "APPROVER", "ADMIN"],
      election_participation_status: [
        "POTENTIAL_ASPIRANT",
        "PUBLICLY_DECLARED_ASPIRANT",
        "FILED_COC",
        "OFFICIAL_CANDIDATE",
        "WITHDRAWN",
        "DISQUALIFIED",
        "ELECTED",
        "NOT_ELECTED",
      ],
      election_status: ["UPCOMING", "ONGOING", "COMPLETED"],
      legal_case_status: [
        "COMPLAINT",
        "UNDER_INVESTIGATION",
        "CASE_FILED",
        "CHARGED",
        "PENDING",
        "DISMISSED",
        "ACQUITTED",
        "CONVICTED",
        "ON_APPEAL",
        "FINAL_JUDGMENT",
        "OTHER",
      ],
      office_level: [
        "NATIONAL",
        "PROVINCIAL",
        "CITY",
        "MUNICIPAL",
        "DISTRICT",
        "BARANGAY",
      ],
      office_term_status: ["HELD", "ACTING", "APPOINTED", "ELECTED"],
      policy_attribution_type: [
        "SELF_DECLARED",
        "OFFICIAL_PLATFORM",
        "LEGISLATIVE_ACTION",
        "INTERVIEW",
        "SPEECH",
      ],
      political_organization_type: [
        "POLITICAL_PARTY",
        "PARTY_LIST",
        "COALITION",
        "OTHER",
      ],
      publication_status: [
        "DRAFT",
        "SOURCE_ATTACHED",
        "REVIEWED",
        "APPROVED",
        "PUBLISHED",
        "RETRACTED",
        "REJECTED",
      ],
      revision_entity_type: [
        "PERSON",
        "ELECTION",
        "OFFICE",
        "POLITICAL_ORGANIZATION",
        "ELECTION_PARTICIPATION",
        "OFFICE_TERM",
        "AFFILIATION",
        "EDUCATION",
        "AWARD",
        "POLICY_POSITION",
        "LEGAL_CASE",
        "ASSET_DISCLOSURE",
        "SOURCE",
        "CLAIM",
        "CLAIM_EVIDENCE",
      ],
      source_type: [
        "OFFICIAL_GOVERNMENT",
        "COURT_OR_TRIBUNAL",
        "OFFICIAL_CANDIDATE",
        "LEGISLATIVE_RECORD",
        "NEWS",
        "ACADEMIC",
        "OTHER",
      ],
      verification_status: [
        "PRIMARY_SOURCE",
        "CORROBORATED",
        "SELF_DECLARED",
        "REPORTED",
        "DISPUTED",
        "UNVERIFIED",
        "OUTDATED",
      ],
    },
  },
} as const
