export interface UserData {
  uid: string;
  nickname?: string;
  email?: string;
  photoURL?: string;
  streakCount?: number;
  lastPostDate?: any; // Can be Timestamp or string/Date
  timeZone?: string;
  level?: number;
  [key: string]: any;
}
