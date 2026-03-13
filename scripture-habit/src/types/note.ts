import { Timestamp } from 'firebase/firestore';

export interface Note {
  id: string;
  text?: string;
  chapter?: string;
  scripture?: string;
  createdAt?: Timestamp;
  sharedMessageIds?: Record<string, string>;
  imageUrl?: string;
  recap?: string;
  [key: string]: any;
}
