export interface Profile {
  id?: number;
  name: string;
  fields: Record<string, string>; // e.g., { "full_name": "John Doe", "address": "123 St" }
}

export enum FieldType {
  TEXT = 'TEXT',
  CHECKBOX = 'CHECKBOX', // Future proofing
}

// A field detected by PDF-Lib or manually created by the user
export interface TemplateField {
  id: string; // Unique ID
  name: string; // Display name
  type: FieldType;
  isManual: boolean;
  pageIndex: number; // 0-based
  
  // Coordinates (in PDF points, typically 72 DPI)
  // Only relevant for manual fields or visualization
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  
  // Visual properties
  fontSize?: number;
}

export interface Mapping {
  templateFieldId: string;
  profileKey: string; // The key in the Profile.fields object
  transformation?: 'none' | 'uppercase' | 'lowercase';
}

export interface Template {
  id?: number;
  name: string;
  pdfData: ArrayBuffer; // Stored as ArrayBuffer in IndexedDB
  fields: TemplateField[]; // Both AcroFields and Custom Fields
  mappings: Mapping[];
  createdAt: number;
}