import { supabase } from './supabase';
import type { User, UserLedger, Transaction, SavingsPot, CurrencyCode } from './types';
import { createEmptyBudgets } from './utils';

const STORAGE_USERS_KEY = 'qashly-users-v3';
const STORAGE_LEDGER_KEY_PREFIX = 'qashly-ledger-v3-';

export const dbService = {
  /**
   * Check if the application is currently connected to Supabase
   */
  isCloudEnabled(): boolean {
    return supabase !== null;
  },

  /**
   * Fetch all registered profiles
   */
  async getUsers(): Promise<User[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('*');
      if (error) {
        console.error('Supabase getUsers error:', error);
        return [];
      }
      return (data || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        passwordHash: u.password_hash,
        securityQuestion: u.security_question,
        securityAnswerHash: u.security_answer_hash,
        createdAt: u.created_at,
      }));
    } else {
      const raw = localStorage.getItem(STORAGE_USERS_KEY);
      let list: User[] = raw ? JSON.parse(raw) : [];
      if (!list.some((u) => u.username === 'admin')) {
        const seedAdmin: User = {
          id: '00000000-0000-0000-0000-000000000000',
          name: 'Admin',
          username: 'admin',
          role: 'admin',
          passwordHash: 'b90707af3eb863de0f8e8a04156c279fbb8fee53eae979b9e40a2261fe42f6e9',
          securityQuestion: 'What is the name of your organization?',
          securityAnswerHash: 'b08b754291965a5e5d69ab21eaa8268a8baffe7a6d2ff9f0ce036978c359b292',
          createdAt: new Date().toISOString()
        };
        list.push(seedAdmin);
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(list));
      }
      return list;
    }
  },

  /**
   * Register or update a user profile
   */
  async saveUser(user: User): Promise<void> {
    if (supabase) {
      const { error } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          password_hash: user.passwordHash,
          security_question: user.securityQuestion || null,
          security_answer_hash: user.securityAnswerHash || null,
          created_at: user.createdAt,
        });
      if (error) {
        console.error('Supabase saveUser error:', error);
        throw error;
      }
    } else {
      const users = await this.getUsers();
      const idx = users.findIndex((u) => u.id === user.id);
      if (idx >= 0) {
        users[idx] = user;
      } else {
        users.push(user);
      }
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
    }
  },

  /**
   * Fetch complete user ledger (transactions, budgets, savings pots)
   */
  async getUserLedger(userId: string): Promise<UserLedger> {
    if (supabase) {
      const [txRes, bRes, sRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', userId),
        supabase.from('budgets').select('*').eq('user_id', userId),
        supabase.from('savings_pots').select('*').eq('user_id', userId),
      ]);

      if (txRes.error) console.error('Supabase fetch transactions error:', txRes.error);
      if (bRes.error) console.error('Supabase fetch budgets error:', bRes.error);
      if (sRes.error) console.error('Supabase fetch savings pots error:', sRes.error);

      // Parse budgets list
      const budgetsObj = createEmptyBudgets();
      if (bRes.data) {
        bRes.data.forEach((b: any) => {
          const curr = b.currency as CurrencyCode;
          if (budgetsObj[curr]) {
            budgetsObj[curr][b.category] = Number(b.limit_amount);
          }
        });
      }

      // Parse savings pots list
      const savingsPotsArr: SavingsPot[] = (sRes.data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        targetAmount: Number(s.target_amount),
        currentAmount: Number(s.current_amount),
        currency: s.currency as CurrencyCode,
      }));

      // Parse transaction records
      const transactionsArr: Transaction[] = (txRes.data || []).map((t: any) => ({
        id: t.id,
        type: t.type as 'expense' | 'income',
        currency: t.currency as CurrencyCode,
        amount: Number(t.amount),
        merchant: t.merchant,
        date: t.date,
        category: t.category,
        account: t.account_method,
        notes: t.notes || '',
        reconciled: !!t.reconciled,
      }));

      return {
        transactions: transactionsArr,
        budgets: budgetsObj,
        savingsPots: savingsPotsArr,
      };
    } else {
      const raw = localStorage.getItem(`${STORAGE_LEDGER_KEY_PREFIX}${userId}`);
      if (raw) {
        const data = JSON.parse(raw);
        return {
          transactions: (data.transactions || []).map((t: any) => ({
            ...t,
            reconciled: !!t.reconciled,
          })),
          budgets: data.budgets || createEmptyBudgets(),
          savingsPots: data.savingsPots || [],
        };
      }
      return {
        transactions: [],
        budgets: createEmptyBudgets(),
        savingsPots: [],
      };
    }
  },

  /**
   * Save or edit a transaction record
   */
  async saveTransaction(userId: string, tx: Transaction): Promise<void> {
    if (supabase) {
      const { error } = await supabase
        .from('transactions')
        .upsert({
          id: tx.id,
          user_id: userId,
          type: tx.type,
          currency: tx.currency,
          amount: tx.amount,
          merchant: tx.merchant,
          date: tx.date,
          category: tx.category,
          account_method: tx.account,
          notes: tx.notes,
          reconciled: !!tx.reconciled,
        });
      if (error) {
        console.error('Supabase saveTransaction error:', error);
        throw error;
      }
    } else {
      const ledger = await this.getUserLedger(userId);
      const idx = ledger.transactions.findIndex((t) => t.id === tx.id);
      if (idx >= 0) {
        ledger.transactions[idx] = tx;
      } else {
        ledger.transactions.push(tx);
      }
      localStorage.setItem(`${STORAGE_LEDGER_KEY_PREFIX}${userId}`, JSON.stringify(ledger));
    }
  },

  /**
   * Delete a transaction record
   */
  async deleteTransaction(userId: string, txId: string): Promise<void> {
    if (supabase) {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', txId);
      if (error) {
        console.error('Supabase deleteTransaction error:', error);
        throw error;
      }
    } else {
      const ledger = await this.getUserLedger(userId);
      ledger.transactions = ledger.transactions.filter((t) => t.id !== txId);
      localStorage.setItem(`${STORAGE_LEDGER_KEY_PREFIX}${userId}`, JSON.stringify(ledger));
    }
  },

  /**
   * Delete multiple transaction records in bulk
   */
  async deleteTransactions(userId: string, txIds: string[]): Promise<void> {
    if (supabase) {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .in('id', txIds);
      if (error) {
        console.error('Supabase deleteTransactions error:', error);
        throw error;
      }
    } else {
      const ledger = await this.getUserLedger(userId);
      ledger.transactions = ledger.transactions.filter((t) => !txIds.includes(t.id));
      localStorage.setItem(`${STORAGE_LEDGER_KEY_PREFIX}${userId}`, JSON.stringify(ledger));
    }
  },

  /**
   * Save or edit multiple transaction records in bulk
   */
  async saveTransactions(userId: string, txs: Transaction[]): Promise<void> {
    if (supabase) {
      const rows = txs.map((tx) => ({
        id: tx.id,
        user_id: userId,
        type: tx.type,
        currency: tx.currency,
        amount: tx.amount,
        merchant: tx.merchant,
        date: tx.date,
        category: tx.category,
        account_method: tx.account,
        notes: tx.notes,
        reconciled: !!tx.reconciled,
      }));
      const { error } = await supabase
        .from('transactions')
        .upsert(rows);
      if (error) {
        console.error('Supabase saveTransactions error:', error);
        throw error;
      }
    } else {
      const ledger = await this.getUserLedger(userId);
      txs.forEach((tx) => {
        const idx = ledger.transactions.findIndex((t) => t.id === tx.id);
        if (idx >= 0) {
          ledger.transactions[idx] = tx;
        } else {
          ledger.transactions.push(tx);
        }
      });
      localStorage.setItem(`${STORAGE_LEDGER_KEY_PREFIX}${userId}`, JSON.stringify(ledger));
    }
  },

  /**
   * Set or update category budget limits
   */
  async saveBudget(userId: string, currency: CurrencyCode, category: string, amount: number): Promise<void> {
    if (supabase) {
      const { error } = await supabase
        .from('budgets')
        .upsert(
          {
            user_id: userId,
            currency,
            category,
            limit_amount: amount,
          },
          { onConflict: 'user_id,currency,category' }
        );
      if (error) {
        console.error('Supabase saveBudget error:', error);
        throw error;
      }
    } else {
      const ledger = await this.getUserLedger(userId);
      ledger.budgets[currency][category] = amount;
      localStorage.setItem(`${STORAGE_LEDGER_KEY_PREFIX}${userId}`, JSON.stringify(ledger));
    }
  },

  /**
   * Save or edit a savings pot details
   */
  async saveSavingsPot(userId: string, pot: SavingsPot): Promise<void> {
    if (supabase) {
      const { error } = await supabase
        .from('savings_pots')
        .upsert({
          id: pot.id,
          user_id: userId,
          name: pot.name,
          target_amount: pot.targetAmount,
          current_amount: pot.currentAmount,
          currency: pot.currency,
        });
      if (error) {
        console.error('Supabase saveSavingsPot error:', error);
        throw error;
      }
    } else {
      const ledger = await this.getUserLedger(userId);
      const idx = ledger.savingsPots.findIndex((p) => p.id === pot.id);
      if (idx >= 0) {
        ledger.savingsPots[idx] = pot;
      } else {
        ledger.savingsPots.push(pot);
      }
      localStorage.setItem(`${STORAGE_LEDGER_KEY_PREFIX}${userId}`, JSON.stringify(ledger));
    }
  },

  /**
   * Delete a savings pot
   */
  async deleteSavingsPot(userId: string, potId: string): Promise<void> {
    if (supabase) {
      const { error } = await supabase
        .from('savings_pots')
        .delete()
        .eq('id', potId);
      if (error) {
        console.error('Supabase deleteSavingsPot error:', error);
        throw error;
      }
    } else {
      const ledger = await this.getUserLedger(userId);
      ledger.savingsPots = ledger.savingsPots.filter((p) => p.id !== potId);
      localStorage.setItem(`${STORAGE_LEDGER_KEY_PREFIX}${userId}`, JSON.stringify(ledger));
    }
  },

  /**
   * Reset user ledger balances (clear all)
   */
  async clearLedger(userId: string): Promise<void> {
    if (supabase) {
      const [txErr, bErr, sErr] = await Promise.all([
        supabase.from('transactions').delete().eq('user_id', userId),
        supabase.from('budgets').delete().eq('user_id', userId),
        supabase.from('savings_pots').delete().eq('user_id', userId),
      ]);
      if (txErr.error) console.error('Supabase clear transactions error:', txErr.error);
      if (bErr.error) console.error('Supabase clear budgets error:', bErr.error);
      if (sErr.error) console.error('Supabase clear savings pots error:', sErr.error);
    } else {
      localStorage.removeItem(`${STORAGE_LEDGER_KEY_PREFIX}${userId}`);
    }
  },
};
