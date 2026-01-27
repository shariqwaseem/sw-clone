export interface Group {
  id: string;
  name: string;
  currency: string;
  createdBy: string;
  createdAt: number | null | { toMillis: () => number };
  updatedAt: number | null | { toMillis: () => number };
  memberIds?: string[];
}

export interface GroupMember {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'member';
  status: 'active' | 'removed';
  joinedAt: number;
}

export interface PayerLine {
  uid: string;
  amount: number;
}

export interface SplitLine {
  uid: string;
  amount: number;
}

export interface Expense {
  id: string;
  description: string;
  totalAmount: number;
  currency: string;
  date: string;
  notes?: string;
  payers: PayerLine[];
  splits: SplitLine[];
  createdBy: string;
  createdAt: number | null | { toMillis: () => number };
  updatedAt: number | null | { toMillis: () => number };
  isDeleted?: boolean;
}

export interface Payment {
  id: string;
  fromUid: string;
  toUid: string;
  amount: number;
  date: string;
  note?: string;
  createdBy: string;
  createdAt: number | null | { toMillis: () => number };
  isDeleted?: boolean;
}

export interface Settlement {
  fromUid: string;
  toUid: string;
  amount: number;
}
