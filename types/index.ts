export interface Session {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
}

export interface SchemaColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

export interface TableSchema {
  tableName: string;
  columns: SchemaColumn[];
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  warning?: string;
}

export interface SessionTable {
  table_name: string;
  pos_x: number;
  pos_y: number;
  column_sources?: Record<string, string>;
}

export interface SessionDetail {
  id: number;
  name: string;
  messages: ChatMessage[];
  sessionTables: SessionTable[];
  relations: Relation[];
}

export interface Relation {
  from: string;
  to: string;
  on: string;
}

export interface ChatResponse {
  sql: string;
  message: string;
  schema: {
    tableName: string;
    columns: Column[];
  } | null;
  action: 'create' | 'alter' | 'insert' | 'select' | 'unknown' | 'prefill' | 'query' | 'create_many' | 'plan' | 'analyze' | 'seed';
  suggestions?: string[];
  alreadyExisted?: boolean;
  sessionName?: string;
  suggestion?: string;
  columnSources?: Record<string, string>;
  values?: Record<string, unknown>;
  rows?: Record<string, unknown>[];
  columns?: string[];
  chartType?: 'bar' | 'stat' | 'table';
  schemas?: Array<{ tableName: string; columns: Column[] }>;
  relations?: Relation[];
  analyses?: Array<{
    title: string;
    sql: string;
    rows: Record<string, unknown>[];
    columns: string[];
    chartType: 'bar' | 'stat' | 'table';
  }>;
}

export interface AnalysisCard {
  title: string;
  sql: string;
  rows: Record<string, unknown>[];
  columns: string[];
  chartType: 'bar' | 'stat' | 'table';
}

export interface VisualCard {
  id: string;
  type: 'bar' | 'stat' | 'table';
  title: string;
  rows: Record<string, unknown>[];
  columns: string[];
  sql: string;
  x: number;
  y: number;
}

export interface TableCardData {
  tableName: string;
  x: number;
  y: number;
  /** Maps column_name → source_table — LLM-detected, used to populate dropdowns */
  columnSources?: Record<string, string>;
}

export interface DataRow {
  [key: string]: unknown;
}

export interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  warning?: string;
  isTyping?: boolean;
  suggestions?: string[];
}

// ─── Automation engine ──────────────────────────────────────────────────────

export interface EmailSettings {
  provider: string;
  host: string | null;
  port: number | null;
  secure: boolean;
  smtp_user: string | null;
  smtp_pass: string | null; // masked on read
  from_name: string | null;
  from_email: string | null;
  api_key: string | null;   // masked on read
  configured: boolean;
}

export type TriggerType = 'schedule' | 'threshold' | 'date_proximity';

export interface Automation {
  id: number;
  user_id: number;
  session_id: number | null;
  name: string;
  description: string | null;
  enabled: boolean;
  trigger_type: TriggerType | string;
  trigger_config: Record<string, unknown>;
  source_table: string | null;
  query_sql: string | null;
  condition_expr: string | null;
  action_type: string;
  action_config: Record<string, unknown>;
  cooldown_minutes: number | null;
  last_run_at: string | null;
  last_fired_at: string | null;
  next_run_at: string | null;
  run_count: number;
  created_at: string;
}

export interface ParsedAutomation {
  name: string;
  description?: string;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  query_sql: string | null;
  condition_expr: string | null;
  action_type: 'send_email';
  action_config: Record<string, unknown>;
  trigger_label?: string;
  confidence?: string;
}

export interface Note {
  id: number;
  session_id: number;
  content: string;
  color: string;
  pos_x: number;
  pos_y: number;
}

export interface AutomationRun {
  id: number;
  automation_id: number;
  automation_name?: string;
  status: 'success' | 'failed' | 'skipped' | 'no_data';
  trigger_reason: string | null;
  rows_affected: number | null;
  action_result: string | null;
  error_message: string | null;
  duration_ms: number | null;
  executed_at: string;
}
