import type { ReviewStatus } from '../../../shared/types';

export type Language = 'en' | 'hi' | 'pa';

export interface BillItemRecord {
  id: string;
  productId: string | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  lineTotal: number | null;
  reviewStatus: ReviewStatus;
}

export interface CorrectionRecord {
  id: string;
  fieldName: string;
  originalValue: string | null;
  correctedValue: string;
  correctionSource: string;
  createdAt: string;
}

export interface BillRecord {
  id: string;
  businessId: string;
  businessPreferredLanguage: string;
  customerId: string | null;
  customerName: string | null;
  billNumber: string | null;
  billDate: string | null;
  subtotal: number | null;
  taxTotal: number | null;
  grandTotal: number | null;
  sourceImageUrl: string | null;
  status: string;
  createdAt: string;
  items: BillItemRecord[];
  corrections: CorrectionRecord[];
}

export interface BusinessRecord {
  id: string;
  name: string;
  preferredLanguage: string;
}

export interface VocabularyRecord {
  id: string;
  businessId: string;
  spokenOrWrittenTerm: string;
  canonicalValue: string;
  valueType: string;
  confirmedByUser: boolean;
  createdAt: string;
}

export interface NewBillItemInput {
  id?: string;
  productId?: string | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  lineTotal: number | null;
  reviewStatus: ReviewStatus;
}

export interface CreateBillInput {
  businessId: string;
  customerId: string | null;
  customerName: string | null;
  billNumber: string | null;
  billDate: string | null;
  subtotal: number | null;
  taxTotal: number | null;
  grandTotal: number | null;
  sourceImageUrl: string | null;
  status: string;
  items: NewBillItemInput[];
}

export interface SaveBillInput {
  billNumber?: string | null;
  billDate?: string | null;
  customerId?: string | null;
  subtotal?: number | null;
  taxTotal?: number | null;
  grandTotal?: number | null;
  status?: string;
  items?: NewBillItemInput[];
  corrections: Array<{
    fieldName: string;
    originalValue: string | null;
    correctedValue: string;
  }>;
}

export interface CreateVocabularyInput {
  spokenOrWrittenTerm: string;
  canonicalValue: string;
  valueType: string;
  confirmedByUser?: boolean;
}
