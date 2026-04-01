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
  action: 'create' | 'alter' | 'insert' | 'select' | 'unknown' | 'prefill' | 'query' | 'create_many';
  alreadyExisted?: boolean;
  sessionName?: string;
  suggestion?: string;
  values?: Record<string, unknown>;
  rows?: Record<string, unknown>[];
  columns?: string[];
  chartType?: 'bar' | 'stat' | 'table';
  schemas?: Array<{ tableName: string; columns: Column[] }>;
  relations?: Relation[];
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
}
