export interface UserPreferences {
  defaultCategory?: string;
  defaultExpenseCategory?: string;
  defaultIncomeCategory?: string;
  defaultPaymentMode?: string;
  defaultKwdPaymentMode?: string;
  defaultInrPaymentMode?: string;
  defaultDisplayAccount?: string;
}

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
  baseCurrency?: CurrencyCode;
  userPreferences?: UserPreferences;
  permissions?: {
    savingsPots: boolean;
    budgets: boolean;
    transactions: boolean;
    multiAccount?: boolean;
  };
}

export type TransactionType = 'expense' | 'income';
export type CurrencyCode = 'KWD' | 'INR';

export interface Account {
  id: string;
  name: string;
  type?: 'checking' | 'savings' | 'credit' | 'cash' | 'other';
  currency?: CurrencyCode;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  currency: CurrencyCode;
  amount: number;
  merchant: string;
  date: string; // YYYY-MM-DD
  category: string;
  account: string;
  paymentMode?: string;
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
  accounts?: Account[];
}

export interface AppState {
  users: User[];
  userData: Record<string, UserLedger>; // key: userId
  currentUserId: string | null;
  activeUserId: string | null;
  currentView: 'dashboard' | 'admin' | 'report' | 'profile';
  theme: 'light' | 'dark';
}
