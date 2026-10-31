export type ReviewStatus = 'pending' | 'confirmed' | 'corrected';

export interface FieldItem<T = string | number> {
  value: T | null;
  confidence: number;
  reviewStatus: ReviewStatus;
}

export interface ExtractedBillItem {
  id?: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  lineTotal: number | null;
  reviewStatus: ReviewStatus;
}

export interface BillExtractionResponse {
  billId: string;
  status: 'needs_review' | 'confirmed';
  language: 'en' | 'hi' | 'pa';
  fields: {
    billNumber: FieldItem<string>;
    billDate: FieldItem<string>;
    customerName: FieldItem<string>;
    grandTotal: FieldItem<number>;
    subtotal?: FieldItem<number>;
    taxTotal?: FieldItem<number>;
  };
  items: ExtractedBillItem[];
  warnings: string[];
}

export interface NormalizationTableField {
  name: string;
  type: 'id' | 'string' | 'decimal' | 'date';
  primaryKey?: boolean;
  foreignKey?: string;
}

export interface NormalizationTable {
  name: string;
  fields: NormalizationTableField[];
}

export interface NormalizationRelationship {
  from: string;
  to: string;
  label: 'one-to-one' | 'one-to-many' | 'many-to-one';
}

export interface FunctionalDependency {
  determinant: string[];
  dependent: string[];
  status: 'inferred' | 'confirmed';
  explanation: string;
}

export interface NormalizationResponse {
  source: string;
  status: 'suggested' | 'verified';
  tables: NormalizationTable[];
  relationships: NormalizationRelationship[];
  dependencies: FunctionalDependency[];
}
