export type Database = string;

export type Cardinality = "one_to_one" | "one_to_many" | "many_to_one";

export type ReferentialAction =
  | "No action"
  | "Restrict"
  | "Cascade"
  | "Set null"
  | "Set default";

export interface Field {
  id: number;
  name: string;
  type: string;
  default?: string;
  primary?: boolean;
  unique?: boolean;
  notNull?: boolean;
  increment?: boolean;
  comment?: string;
  size?: string | number;
  values?: string[];
  check?: string;
}

export interface Index {
  id: number;
  name: string;
  unique: boolean;
  fields: string[];
}

export interface Table {
  id: number;
  name: string;
  fields: Field[];
  indices?: Index[];
  comment?: string;
  color?: string;
  x?: number;
  y?: number;
}

export interface Reference {
  id: number;
  name: string;
  startTableId: number;
  startFieldId: number;
  endTableId: number;
  endFieldId: number;
  fields?: { startFieldId: number; endFieldId: number }[];
  cardinality: Cardinality;
  updateConstraint: ReferentialAction;
  deleteConstraint: ReferentialAction;
}

export interface EnumDef {
  id?: number;
  name: string;
  values: string[];
}

export interface CustomType {
  id?: number;
  name: string;
  fields: Field[];
  comment?: string;
}

export interface DiagramSchema {
  database: Database;
  tables: Table[];
  references: Reference[];
  enums?: EnumDef[];
  types?: CustomType[];
  notes?: unknown[];
  areas?: unknown[];
  title?: string;
}

export interface DiagramSummary {
  id: string;
  name: string;
  database: Database;
  updatedAt: string;
}
