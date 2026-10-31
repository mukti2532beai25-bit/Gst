import type { BillExtractionResponse } from '@shared/types';

export type Language = BillExtractionResponse['language'];
export type BillStatus = BillExtractionResponse['status'];

export interface Business {
  id: string;
  name: string;
  owner: string;
  preferredLanguage: Language;
  location: string;
}

export const DEMO_BUSINESSES: Business[] = [
  {
    id: 'biz-sharma',
    name: 'Sharma General Store',
    owner: 'Ravi Sharma',
    preferredLanguage: 'hi',
    location: 'Ludhiana, Punjab'
  },
  {
    id: 'biz-kumar',
    name: 'Kumar Kirana Traders',
    owner: 'Anil Kumar',
    preferredLanguage: 'pa',
    location: 'Amritsar, Punjab'
  },
  {
    id: 'biz-demo',
    name: 'BahiVerse Demo Co.',
    owner: 'Demo Owner',
    preferredLanguage: 'en',
    location: 'Bengaluru, Karnataka'
  }
];

export interface RecentBill {
  id: string;
  billNumber: string;
  customer: string;
  amount: number;
  status: BillStatus;
  when: string;
}

export const DEMO_RECENT_BILLS: RecentBill[] = [
  {
    id: 'demo-bill-001',
    billNumber: 'B-102',
    customer: 'Ravi Kumar',
    amount: 336,
    status: 'needs_review',
    when: '2 min ago'
  },
  {
    id: 'bill-2026-093',
    billNumber: 'B-093',
    customer: 'Simran Kaur',
    amount: 1240,
    status: 'confirmed',
    when: 'Today, 11:20'
  },
  {
    id: 'bill-2026-088',
    billNumber: 'B-088',
    customer: 'Harpreet Singh',
    amount: 875.5,
    status: 'confirmed',
    when: 'Yesterday'
  }
];

export const LANGUAGE_LABEL: Record<Language, string> = {
  en: 'English',
  hi: 'हिन्दी',
  pa: 'ਪੰਜਾਬੀ'
};

export const SPEECH_LOCALE: Record<Language, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  pa: 'pa-IN'
};
