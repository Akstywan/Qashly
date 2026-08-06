import type { CurrencyCode } from './types';

export const currencyMeta = {
  KWD: { label: "KWD", decimals: 3, step: "0.001", placeholder: "0.000" },
  INR: { label: "INR", decimals: 2, step: "0.01", placeholder: "0.00" }
};

export const expenseCategories = [
  "Rent",
  "Groceries",
  "Dining",
  "Transport",
  "Utilities",
  "Shopping",
  "Entertainment",
  "Health",
  "Travel",
  "Family",
  "Other"
];

export const incomeCategories = [
  "Salary",
  "Freelance",
  "Bonus",
  "Allowance",
  "Interest",
  "Refund",
  "Transfer",
  "Balance Transfer",
  "Other"
];

export const kwdPaymentModes = [
  "KNET / Debit Card",
  "Credit Card",
  "Cash",
  "Bank Transfer"
];

export const inrPaymentModes = [
  "UPI",
  "Net Banking",
  "Debit Card",
  "Credit Card",
  "Cash"
];

export function getPaymentModesForCurrency(currency: CurrencyCode, customAccounts: { name: string; currency?: CurrencyCode }[] = []): string[] {
  const baseModes = currency === 'INR' ? inrPaymentModes : kwdPaymentModes;
  const customNames = (customAccounts || []).map(a => a.name);
  return Array.from(new Set([...customNames, ...baseModes]));
}

export const categoryColors: Record<string, string> = {
  Rent: "#2f6fae",
  Groceries: "#187268",
  Dining: "#c4492d",
  Transport: "#6f5aa8",
  Utilities: "#a86f18",
  Shopping: "#b8542f",
  Entertainment: "#2d8a68",
  Health: "#b33d5e",
  Travel: "#277da1",
  Family: "#8b6f2f",
  Other: "#66727f",
  Salary: "#187268",
  Freelance: "#2f6fae",
  Bonus: "#a86f18",
  Allowance: "#6f5aa8",
  Interest: "#2d8a68",
  Refund: "#b33d5e",
  Transfer: "#277da1",
  "Balance Transfer": "#0ea5e9"
};

export function createId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function fallbackHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export async function hashPassword(username: string, password: string): Promise<string> {
  const value = `${username.toLowerCase()}::${password}`;
  if (globalThis.crypto?.subtle && globalThis.TextEncoder) {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return fallbackHash(value);
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });
}

export function formatShortDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

export function formatMoney(value: number, currency: CurrencyCode): string {
  const decimals = currencyMeta[currency]?.decimals ?? 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    currencyDisplay: "code",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value || 0);
}

export function createEmptyBudgets() {
  return {
    KWD: Object.fromEntries(expenseCategories.map((cat) => [cat, 0])),
    INR: Object.fromEntries(expenseCategories.map((cat) => [cat, 0]))
  };
}

export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function defaultEntryDate(month: string): string {
  const today = new Date();
  const todayKey = toDateInput(today);
  if (todayKey.startsWith(month)) {
    return todayKey;
  }
  return `${month}-01`;
}

export function getPreferredTheme(): 'light' | 'dark' {
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function firstName(name: string): string {
  return String(name).trim().split(/\s+/)[0] || "User";
}

export interface LocalUserPreferences {
  defaultCategory?: string;
  defaultExpenseCategory?: string;
  defaultIncomeCategory?: string;
  defaultPaymentMode?: string;
  defaultInrPaymentMode?: string;
  defaultKwdPaymentMode?: string;
  defaultDisplayAccount?: string;
}

export function getLocalUserPreferences(userId: string): LocalUserPreferences {
  try {
    const raw = localStorage.getItem(`qashly_user_preferences_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalUserPreferences(userId: string, prefs: LocalUserPreferences): void {
  try {
    localStorage.setItem(`qashly_user_preferences_${userId}`, JSON.stringify(prefs));
  } catch (e) {
    console.error('Failed to save user preferences locally', e);
  }
}

export function getPreviousMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const prevDate = new Date(year, month - 2, 1);
  return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
}

export function getNextMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const nextDate = new Date(year, month, 1);
  return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
}

export function calculateMonthNetBalance(
  transactions: { date: string; currency: string; type: string; amount: number }[],
  monthKey: string,
  currency: CurrencyCode
): number {
  const monthTxs = transactions.filter(
    (t) => t.date.startsWith(monthKey) && t.currency === currency
  );
  const totalIncome = monthTxs
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const totalExpense = monthTxs
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);
  return totalIncome - totalExpense;
}


