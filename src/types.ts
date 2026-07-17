export interface User {
  id: string;
  name: string;
  username: string; // Replaces email
  role: 'admin' | 'user';
  passwordHash: string;
  createdAt: string;
  securityQuestion?: string;
  securityAnswerHash?: string;
  isFrozen?: boolean;
  permissions?: {
    savingsPots: boolean;
    budgets: boolean;
    transactions: boolean;
  };
}

export type TransactionType = 'expense' | 'income';
export type CurrencyCode = 'KWD' | 'INR';

export interface Transaction {
  id: string;
  type: TransactionType;
  currency: CurrencyCode;
  amount: number;
  merchant: string;
  date: string; // YYYY-MM-DD
  category: string;
  account: string;
  notes: string;
  reconciled?: boolean;
}

// budgets[currencyCode][categoryName] = limitAmount
export interface Budgets {
  KWD: Record<string, number>;
  INR: Record<string, number>;
}

export interface SavingsPot {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: CurrencyCode;
}

export interface UserLedger {
  transactions: Transaction[];
  budgets: Budgets;
  savingsPots: SavingsPot[]; // Add savings pots array
}

export interface AppState {
  users: User[];
  userData: Record<string, UserLedger>; // key: userId
  currentUserId: string | null;
  activeUserId: string | null;
  currentView: 'dashboard' | 'admin' | 'report' | 'profile';
  theme: 'light' | 'dark';
}
