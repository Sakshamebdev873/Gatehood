export type Role = 'builder' | 'buyer';

export type NoticeTarget =
  | { type: 'all' }
  | { type: 'towers'; towers: string[] }
  | { type: 'units'; unitIds: string[] };

export interface Notice {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  /** Milliseconds since epoch. */
  createdAt: number;
  target: NoticeTarget;
  audience: string[];
  readCount: number;
}

export interface BuyerRow {
  /** 1-based line in the CSV file; the header is line 1. */
  line: number;
  tower: string;
  unit: string;
  unitId: string;
  name: string;
  phone: string;
  config?: string;
}

export interface RowError {
  line: number;
  reason: string;
}

export type ApiErrorCode =
  | 'invalid_code'
  | 'code_used'
  | 'code_expired'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'bad_request'
  | 'rate_limited'
  | 'internal';

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
}

export interface RedeemResponse {
  token: string;
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: RowError[];
  invites: { code: string; unitId: string; name: string }[];
}

export interface OverviewResponse {
  towers: { towerId: string; name: string; units: number; invited: number; joined: number }[];
}

export type BuyerStatus = 'joined' | 'pending' | 'expired';

export interface BuyersResponse {
  buyers: {
    code: string;
    unitId: string;
    towerId: string;
    name: string;
    phone: string;
    status: BuyerStatus;
    joinedAt?: number;
  }[];
}

export interface NoticeStats {
  readCount: number;
  joinedInAudience: number;
  notJoined: number;
  byTower: { towerId: string; read: number; joined: number }[];
  notRead: { uid: string; name: string; unitId: string }[];
}
