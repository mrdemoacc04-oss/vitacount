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
      accounts: {
        Row: {
          code: string
          created_at: string
          currency: string
          id: string
          is_active: boolean
          name: string
          subtype: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name: string
          subtype?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
          subtype?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_actions: {
        Row: {
          agent_name: string
          autonomy_level: number
          confidence_score: number | null
          created_at: string
          executed_at: string | null
          id: string
          input_context: Json
          module: string
          proposed_action: Json
          reversal_of_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tenant_id: string
          trigger_event: string
        }
        Insert: {
          agent_name: string
          autonomy_level: number
          confidence_score?: number | null
          created_at?: string
          executed_at?: string | null
          id?: string
          input_context?: Json
          module: string
          proposed_action?: Json
          reversal_of_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id: string
          trigger_event: string
        }
        Update: {
          agent_name?: string
          autonomy_level?: number
          confidence_score?: number | null
          created_at?: string
          executed_at?: string | null
          id?: string
          input_context?: Json
          module?: string
          proposed_action?: Json
          reversal_of_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id?: string
          trigger_event?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_actions_reversal_of_id_fkey"
            columns: ["reversal_of_id"]
            isOneToOne: false
            referencedRelation: "agent_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_type: string | null
          created_at: string
          current_balance: number | null
          id: string
          institution_name: string | null
          last_synced_at: string | null
          name: string
          plaid_account_id: string | null
          plaid_item_id: string | null
          tenant_id: string
        }
        Insert: {
          account_type?: string | null
          created_at?: string
          current_balance?: number | null
          id?: string
          institution_name?: string | null
          last_synced_at?: string | null
          name: string
          plaid_account_id?: string | null
          plaid_item_id?: string | null
          tenant_id: string
        }
        Update: {
          account_type?: string | null
          created_at?: string
          current_balance?: number | null
          id?: string
          institution_name?: string | null
          last_synced_at?: string | null
          name?: string
          plaid_account_id?: string | null
          plaid_item_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number
          bank_account_id: string
          created_at: string
          description: string
          id: string
          plaid_transaction_id: string | null
          posted_date: string
          status: string
          tenant_id: string
        }
        Insert: {
          amount: number
          bank_account_id: string
          created_at?: string
          description: string
          id?: string
          plaid_transaction_id?: string | null
          posted_date: string
          status?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string
          created_at?: string
          description?: string
          id?: string
          plaid_transaction_id?: string | null
          posted_date?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_lines: {
        Row: {
          account_id: string | null
          amount: number
          bill_id: string
          description: string | null
          id: string
          item_id: string | null
          quantity: number | null
          sort_order: number
          unit_cost: number | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          bill_id: string
          description?: string | null
          id?: string
          item_id?: string | null
          quantity?: number | null
          sort_order?: number
          unit_cost?: number | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          bill_id?: string
          description?: string | null
          id?: string
          item_id?: string | null
          quantity?: number | null
          sort_order?: number
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_lines_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_payment_applications: {
        Row: {
          amount_applied: number
          bill_id: string
          id: string
          payment_id: string
        }
        Insert: {
          amount_applied: number
          bill_id: string
          id?: string
          payment_id: string
        }
        Update: {
          amount_applied?: number
          bill_id?: string
          id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_payment_applications_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_payment_applications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments_made"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          balance_due: number
          bill_number: string | null
          created_at: string
          created_by: string | null
          document_type: string
          due_date: string | null
          id: string
          issue_date: string
          project_id: string | null
          source_document_id: string | null
          status: string
          tenant_id: string
          total: number
          vendor_id: string
        }
        Insert: {
          balance_due?: number
          bill_number?: string | null
          created_at?: string
          created_by?: string | null
          document_type?: string
          due_date?: string | null
          id?: string
          issue_date: string
          project_id?: string | null
          source_document_id?: string | null
          status?: string
          tenant_id: string
          total?: number
          vendor_id: string
        }
        Update: {
          balance_due?: number
          bill_number?: string | null
          created_at?: string
          created_by?: string | null
          document_type?: string
          due_date?: string | null
          id?: string
          issue_date?: string
          project_id?: string | null
          source_document_id?: string | null
          status?: string
          tenant_id?: string
          total?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          avg_days_to_pay: number | null
          billing_address: Json | null
          created_at: string
          credit_limit: number | null
          display_name: string
          email: string | null
          id: string
          is_1099_vendor: boolean
          payment_terms: string
          phone: string | null
          risk_score: number | null
          shipping_address: Json | null
          tax_id: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          avg_days_to_pay?: number | null
          billing_address?: Json | null
          created_at?: string
          credit_limit?: number | null
          display_name: string
          email?: string | null
          id?: string
          is_1099_vendor?: boolean
          payment_terms?: string
          phone?: string | null
          risk_score?: number | null
          shipping_address?: Json | null
          tax_id?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          avg_days_to_pay?: number | null
          billing_address?: Json | null
          created_at?: string
          credit_limit?: number | null
          display_name?: string
          email?: string | null
          id?: string
          is_1099_vendor?: boolean
          payment_terms?: string
          phone?: string | null
          risk_score?: number | null
          shipping_address?: Json | null
          tax_id?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dimension_types: {
        Row: {
          id: string
          is_active: boolean
          name: string
          tenant_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dimension_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dimension_values: {
        Row: {
          dimension_type_id: string
          id: string
          is_active: boolean
          tenant_id: string
          value: string
        }
        Insert: {
          dimension_type_id: string
          id?: string
          is_active?: boolean
          tenant_id: string
          value: string
        }
        Update: {
          dimension_type_id?: string
          id?: string
          is_active?: boolean
          tenant_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "dimension_values_dimension_type_id_fkey"
            columns: ["dimension_type_id"]
            isOneToOne: false
            referencedRelation: "dimension_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dimension_values_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          doc_type: string | null
          duplicate_detected: boolean | null
          extracted_data: Json | null
          id: string
          line_items: Json | null
          linked_bill_id: string | null
          linked_expense_id: string | null
          ocr_confidence: number | null
          status: string
          storage_path: string
          tenant_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type?: string | null
          duplicate_detected?: boolean | null
          extracted_data?: Json | null
          id?: string
          line_items?: Json | null
          linked_bill_id?: string | null
          linked_expense_id?: string | null
          ocr_confidence?: number | null
          status?: string
          storage_path: string
          tenant_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string | null
          duplicate_detected?: boolean | null
          extracted_data?: Json | null
          id?: string
          line_items?: Json | null
          linked_bill_id?: string | null
          linked_expense_id?: string | null
          ocr_confidence?: number | null
          status?: string
          storage_path?: string
          tenant_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_linked_bill_id_fkey"
            columns: ["linked_bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_linked_expense_id_fkey"
            columns: ["linked_expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dunning_schedules: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          invoice_id: string
          scheduled_for: string
          sent_at: string | null
          status: string
          step: string
          stripe_payment_url: string | null
          template_used: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          invoice_id: string
          scheduled_for: string
          sent_at?: string | null
          status?: string
          step: string
          stripe_payment_url?: string | null
          template_used?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          invoice_id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          step?: string
          stripe_payment_url?: string | null
          template_used?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dunning_schedules_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dunning_schedules_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dunning_schedules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          account_id: string
          amount: number
          contact_id: string | null
          created_at: string
          created_by: string | null
          expense_date: string
          id: string
          memo: string | null
          payment_method: string | null
          project_id: string | null
          receipt_document_id: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          account_id: string
          amount: number
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          expense_date: string
          id?: string
          memo?: string | null
          payment_method?: string | null
          project_id?: string | null
          receipt_document_id?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          expense_date?: string
          id?: string
          memo?: string | null
          payment_method?: string | null
          project_id?: string | null
          receipt_document_id?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_receipt_document_id_fkey"
            columns: ["receipt_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_layers: {
        Row: {
          cost_remaining: number
          created_at: string
          id: string
          item_id: string
          quantity_received: number
          quantity_remaining: number
          received_date: string
          source_id: string | null
          source_type: string
          tenant_id: string
          unit_cost: number
        }
        Insert: {
          cost_remaining: number
          created_at?: string
          id?: string
          item_id: string
          quantity_received: number
          quantity_remaining: number
          received_date: string
          source_id?: string | null
          source_type: string
          tenant_id: string
          unit_cost: number
        }
        Update: {
          cost_remaining?: number
          created_at?: string
          id?: string
          item_id?: string
          quantity_received?: number
          quantity_remaining?: number
          received_date?: string
          source_id?: string | null
          source_type?: string
          tenant_id?: string
          unit_cost?: number
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          journal_entry_id: string | null
          layer_id: string | null
          memo: string | null
          movement_date: string
          movement_type: string
          quantity: number
          source_id: string | null
          source_type: string
          tenant_id: string
          total_cost: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          journal_entry_id?: string | null
          layer_id?: string | null
          memo?: string | null
          movement_date: string
          movement_type: string
          quantity: number
          source_id?: string | null
          source_type: string
          tenant_id: string
          total_cost: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          journal_entry_id?: string | null
          layer_id?: string | null
          memo?: string | null
          movement_date?: string
          movement_type?: string
          quantity?: number
          source_id?: string | null
          source_type?: string
          tenant_id?: string
          total_cost?: number
        }
        Relationships: []
      }
      invoice_lines: {
        Row: {
          amount: number
          description: string | null
          id: string
          invoice_id: string
          item_id: string | null
          quantity: number
          sort_order: number
          tax_rate: number
          unit_price: number
        }
        Insert: {
          amount: number
          description?: string | null
          id?: string
          invoice_id: string
          item_id?: string | null
          quantity?: number
          sort_order?: number
          tax_rate?: number
          unit_price: number
        }
        Update: {
          amount?: number
          description?: string | null
          id?: string
          invoice_id?: string
          item_id?: string | null
          quantity?: number
          sort_order?: number
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          balance_due: number
          contact_id: string
          created_at: string
          created_by: string | null
          currency: string
          document_type: string
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          payment_method: string | null
          payment_reference: string | null
          project_id: string | null
          refund_source: string | null
          status: string
          subtotal: number
          tax_total: number
          tenant_id: string
          total: number
        }
        Insert: {
          balance_due?: number
          contact_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          document_type?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date: string
          payment_method?: string | null
          payment_reference?: string | null
          project_id?: string | null
          refund_source?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          tenant_id: string
          total?: number
        }
        Update: {
          balance_due?: number
          contact_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          document_type?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          payment_method?: string | null
          payment_reference?: string | null
          project_id?: string | null
          refund_source?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          tenant_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          asset_account_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expense_account_id: string | null
          id: string
          income_account_id: string | null
          is_active: boolean
          name: string
          purchase_cost: number | null
          reorder_point: number | null
          reorder_qty: number | null
          sales_price: number | null
          sku: string | null
          tenant_id: string
          type: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          asset_account_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_account_id?: string | null
          id?: string
          income_account_id?: string | null
          is_active?: boolean
          name: string
          purchase_cost?: number | null
          reorder_point?: number | null
          reorder_qty?: number | null
          sales_price?: number | null
          sku?: string | null
          tenant_id: string
          type: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          asset_account_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_account_id?: string | null
          id?: string
          income_account_id?: string | null
          is_active?: boolean
          name?: string
          purchase_cost?: number | null
          reorder_point?: number | null
          reorder_qty?: number | null
          sales_price?: number | null
          sku?: string | null
          tenant_id?: string
          type?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          memo: string | null
          period_id: string | null
          posted_at: string | null
          reversal_of_id: string | null
          source_id: string | null
          source_type: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entry_date: string
          id?: string
          memo?: string | null
          period_id?: string | null
          posted_at?: string | null
          reversal_of_id?: string | null
          source_id?: string | null
          source_type: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          memo?: string | null
          period_id?: string | null
          posted_at?: string | null
          reversal_of_id?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reversal_of_id_fkey"
            columns: ["reversal_of_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_line_dimensions: {
        Row: {
          dimension_value_id: string
          journal_entry_line_id: string
        }
        Insert: {
          dimension_value_id: string
          journal_entry_line_id: string
        }
        Update: {
          dimension_value_id?: string
          journal_entry_line_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_line_dimensions_dimension_value_id_fkey"
            columns: ["dimension_value_id"]
            isOneToOne: false
            referencedRelation: "dimension_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_line_dimensions_journal_entry_line_id_fkey"
            columns: ["journal_entry_line_id"]
            isOneToOne: false
            referencedRelation: "journal_entry_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          credit: number
          debit: number
          id: string
          journal_entry_id: string
          memo: string | null
        }
        Insert: {
          account_id: string
          credit?: number
          debit?: number
          id?: string
          journal_entry_id: string
          memo?: string | null
        }
        Update: {
          account_id?: string
          credit?: number
          debit?: number
          id?: string
          journal_entry_id?: string
          memo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          id: string
          invited_at: string | null
          permissions: Json
          role: string
          status: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_at?: string | null
          permissions?: Json
          role: string
          status?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          id?: string
          invited_at?: string | null
          permissions?: Json
          role?: string
          status?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_applications: {
        Row: {
          amount_applied: number
          created_at: string
          id: string
          invoice_id: string
          payment_id: string
        }
        Insert: {
          amount_applied: number
          created_at?: string
          id?: string
          invoice_id: string
          payment_id: string
        }
        Update: {
          amount_applied?: number
          created_at?: string
          id?: string
          invoice_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_applications_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_applications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments_received"
            referencedColumns: ["id"]
          },
        ]
      }
      payments_made: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          method: string | null
          payment_date: string
          reference: string | null
          scheduled_for: string | null
          tenant_id: string
          vendor_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          payment_date: string
          reference?: string | null
          scheduled_for?: string | null
          tenant_id: string
          vendor_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          payment_date?: string
          reference?: string | null
          scheduled_for?: string | null
          tenant_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_made_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_made_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      payments_received: {
        Row: {
          amount: number
          contact_id: string
          created_at: string
          created_by: string | null
          id: string
          method: string | null
          payment_date: string
          reference: string | null
          stripe_payment_intent_id: string | null
          tenant_id: string
          unapplied_amount: number
        }
        Insert: {
          amount: number
          contact_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          payment_date: string
          reference?: string | null
          stripe_payment_intent_id?: string | null
          tenant_id: string
          unapplied_amount?: number
        }
        Update: {
          amount?: number
          contact_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          payment_date?: string
          reference?: string | null
          stripe_payment_intent_id?: string | null
          tenant_id?: string
          unapplied_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_received_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_received_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      periods: {
        Row: {
          end_date: string
          id: string
          start_date: string
          status: string
          tenant_id: string
        }
        Insert: {
          end_date: string
          id?: string
          start_date: string
          status?: string
          tenant_id: string
        }
        Update: {
          end_date?: string
          id?: string
          start_date?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "periods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number | null
          code: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      reconciliation_matches: {
        Row: {
          bank_transaction_id: string
          confidence_score: number | null
          created_at: string
          created_by_agent: boolean
          id: string
          match_signals: Json | null
          matched_id: string | null
          matched_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          bank_transaction_id: string
          confidence_score?: number | null
          created_at?: string
          created_by_agent?: boolean
          id?: string
          match_signals?: Json | null
          matched_id?: string | null
          matched_type: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          bank_transaction_id?: string
          confidence_score?: number | null
          created_at?: string
          created_by_agent?: boolean
          id?: string
          match_signals?: Json | null
          matched_id?: string | null
          matched_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_matches_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_matches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          base_currency: string
          created_at: string
          default_tax_rate: number
          id: string
          name: string
          plan_tier: string
          settings: Json
          address: Json
          default_payment_terms: string
          email: string | null
          fiscal_year_start_month: number
          invoice_footer: string | null
          invoice_notes: string | null
          legal_name: string | null
          phone: string | null
          tax_id: string | null
          timezone: string
          website: string | null
        }
        Insert: {
          base_currency?: string
          created_at?: string
          default_tax_rate?: number
          id?: string
          name: string
          plan_tier?: string
          settings?: Json
          address?: Json
          default_payment_terms?: string
          email?: string | null
          fiscal_year_start_month?: number
          invoice_footer?: string | null
          invoice_notes?: string | null
          legal_name?: string | null
          phone?: string | null
          tax_id?: string | null
          timezone?: string
          website?: string | null
        }
        Update: {
          base_currency?: string
          created_at?: string
          default_tax_rate?: number
          id?: string
          name?: string
          plan_tier?: string
          settings?: Json
          address?: Json
          default_payment_terms?: string
          email?: string | null
          fiscal_year_start_month?: number
          invoice_footer?: string | null
          invoice_notes?: string | null
          legal_name?: string | null
          phone?: string | null
          tax_id?: string | null
          timezone?: string
          website?: string | null
        }
        Relationships: []
      }
      transaction_embeddings: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          source_id: string
          source_type: string
          tenant_id: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          source_id: string
          source_type: string
          tenant_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          source_id?: string
          source_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_embeddings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_credit_applications: {
        Row: {
          amount_applied: number
          applied_on: string
          bill_id: string
          created_at: string
          created_by: string | null
          id: string
          tenant_id: string
          vendor_credit_id: string
        }
        Insert: {
          amount_applied: number
          applied_on?: string
          bill_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          tenant_id: string
          vendor_credit_id: string
        }
        Update: {
          amount_applied?: number
          applied_on?: string
          bill_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          tenant_id?: string
          vendor_credit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_credit_applications_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_credit_applications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_credit_applications_vendor_credit_id_fkey"
            columns: ["vendor_credit_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_rules: {
        Row: {
          created_at: string
          default_account_id: string | null
          default_tax_rate: number | null
          id: string
          learned_from_action_id: string | null
          tenant_id: string
          updated_at: string
          vendor_name: string
        }
        Insert: {
          created_at?: string
          default_account_id?: string | null
          default_tax_rate?: number | null
          id?: string
          learned_from_action_id?: string | null
          tenant_id: string
          updated_at?: string
          vendor_name: string
        }
        Update: {
          created_at?: string
          default_account_id?: string | null
          default_tax_rate?: number | null
          id?: string
          learned_from_action_id?: string | null
          tenant_id?: string
          updated_at?: string
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_rules_default_account_id_fkey"
            columns: ["default_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_rules_learned_from_action_id_fkey"
            columns: ["learned_from_action_id"]
            isOneToOne: false
            referencedRelation: "agent_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      item_stock: {
        Row: {
          item_id: string | null
          quantity_on_hand: number | null
          stock_value: number | null
          tenant_id: string | null
        }
        Relationships: []
      }
      project_financials: {
        Row: {
          costs: number | null
          profit: number | null
          project_id: string | null
          receivable: number | null
          revenue: number | null
          tenant_id: string | null
        }
        Relationships: []
      }
      unified_transactions_feed: {
        Row: {
          amount: number | null
          created_at: string | null
          description: string | null
          id: string | null
          party_name: string | null
          status: string | null
          tenant_id: string | null
          transaction_date: string | null
          transaction_type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _apply_vendor_payment: {
        Args: {
          p_amount: number
          p_applications: Json
          p_payment_id: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      accept_invite: { Args: { p_tenant_id: string }; Returns: undefined }
      adjust_inventory: {
        Args: {
          p_date: string
          p_item_id: string
          p_kind?: string
          p_quantity: number
          p_reason: string
          p_tenant_id: string
          p_unit_cost: number
        }
        Returns: string
      }
      apply_customer_credit: {
        Args: { p_contact_id: string; p_tenant_id: string }
        Returns: number
      }
      apply_vendor_credits: {
        Args: { p_tenant_id: string; p_vendor_id: string }
        Returns: number
      }
      create_bill_received: {
        Args: {
          p_bill_number: string
          p_due_date: string
          p_issue_date: string
          p_lines: Json
          p_project_id?: string
          p_tenant_id: string
          p_vendor_id: string
        }
        Returns: string
      }
      create_sales_document: {
        Args: {
          p_contact_id: string
          p_document_type: string
          p_due_date: string
          p_issue_date: string
          p_lines: Json
          p_payment_method: string
          p_payment_reference: string
          p_project_id?: string
          p_tenant_id: string
        }
        Returns: string
      }
      create_tenant: { Args: { tenant_name: string }; Returns: string }
      create_vendor_credit: {
        Args: {
          p_credit_number: string
          p_issue_date: string
          p_lines: Json
          p_project_id?: string
          p_tenant_id: string
          p_vendor_id: string
        }
        Returns: string
      }
      current_admin_tenant_ids: { Args: never; Returns: string[] }
      current_member_tenant_ids: { Args: never; Returns: string[] }
      current_tenant_ids: { Args: never; Returns: string[] }
      emergency_kill_switch: { Args: { p_tenant_id: string }; Returns: Json }
      execute_scheduled_vendor_payment: {
        Args: { p_applications: Json; p_payment_id: string }
        Returns: undefined
      }
      lookup_user_id_by_email: { Args: { p_email: string }; Returns: string }
      next_document_number: {
        Args: { p_document_type: string; p_tenant_id: string }
        Returns: string
      }
      next_invoice_number: { Args: { p_tenant_id: string }; Returns: string }
      pay_vendor_bills: {
        Args: {
          p_amount: number
          p_applications: Json
          p_method: string
          p_payment_date: string
          p_reference: string
          p_tenant_id: string
          p_vendor_id: string
        }
        Returns: string
      }
      post_expense_created: {
        Args: {
          p_account_id: string
          p_amount: number
          p_contact_id: string
          p_document_id?: string
          p_expense_date: string
          p_memo: string
          p_payment_method: string
          p_project_id?: string
          p_tenant_id: string
        }
        Returns: string
      }
      post_invoice_issued: { Args: { p_invoice_id: string }; Returns: string }
      post_manual_journal_entry: {
        Args: {
          p_entry_date: string
          p_lines: Json
          p_memo: string
          p_tenant_id: string
        }
        Returns: string
      }
      post_payment_received: {
        Args: {
          p_amount: number
          p_applications: Json
          p_contact_id: string
          p_method: string
          p_payment_date: string
          p_reference: string
          p_stripe_payment_intent_id: string
          p_tenant_id: string
        }
        Returns: string
      }
      post_vendor_payment_made: {
        Args: {
          p_amount: number
          p_applications: Json
          p_method: string
          p_payment_date: string
          p_scheduled_for: string
          p_tenant_id: string
          p_vendor_id: string
        }
        Returns: string
      }
      refund_customer_credit: {
        Args: {
          p_amount: number
          p_contact_id: string
          p_method: string
          p_reference: string
          p_refund_date: string
          p_tenant_id: string
        }
        Returns: string
      }
      seed_default_chart_of_accounts: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      set_document_project: {
        Args: {
          p_document_id: string
          p_document_kind: string
          p_project_id: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      update_workspace_profile: {
        Args: {
          p_address: Json
          p_default_payment_terms: string
          p_default_tax_rate: number
          p_email: string
          p_fiscal_year_start_month: number
          p_invoice_footer: string
          p_invoice_notes: string
          p_legal_name: string
          p_name: string
          p_phone: string
          p_tax_id: string
          p_tenant_id: string
          p_timezone: string
          p_website: string
        }
        Returns: undefined
      }
      set_agent_autonomy_level: {
        Args: { p_agent_name: string; p_level: number; p_tenant_id: string }
        Returns: Json
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
