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
  "Other"
];

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
  Transfer: "#277da1"
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
