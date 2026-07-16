import { supabase } from './supabase';
import type { User, UserLedger, Transaction, SavingsPot, CurrencyCode } from './types';
import { createEmptyBudgets } from './utils';

export const dbService = {
  /**
   * Fetch all registered profiles, seeding an admin if empty
   */
  async getUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*');
    if (error) {
      console.error('Supabase getUsers error:', error);
      return [];
    }

    let list: User[] = (data || []).map((u: any) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      role: u.role,
      passwordHash: u.password_hash,
      securityQuestion: u.security_question || '',
      securityAnswerHash: u.security_answer_hash || '',
      createdAt: u.created_at,
    }));

    if (list.length === 0 || !list.some((u) => u.username === 'admin')) {
      const seedAdmin: User = {
        id: '00000000-0000-0000-0000-000000000000',
        name: 'Admin',
        username: 'admin',
        role: 'admin',
        passwordHash: 'b90707af3eb863de0f8e8a04156c279fbb8fee53eae979b9e40a2261fe42f6e9', // hash of admin::admin
        securityQuestion: '',
        securityAnswerHash: '',
        createdAt: new Date().toISOString()
      };

      const { error: seedError } = await supabase
        .from('users')
        .upsert({
          id: seedAdmin.id,
          username: seedAdmin.username,
          name: seedAdmin.name,
          role: seedAdmin.role,
          password_hash: seedAdmin.passwordHash,
          security_question: '',
          security_answer_hash: '',
          created_at: seedAdmin.createdAt,
        });

      if (!seedError) {
        list.push(seedAdmin);
      } else {
        console.error('Supabase seeding admin error:', seedError);
      }
    }

    return list;
  },

  /**
   * Register or update a user profile
   */
  async saveUser(user: User): Promise<void> {
    const { error } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        password_hash: user.passwordHash,
        security_question: user.securityQuestion || '',
        security_answer_hash: user.securityAnswerHash || '',
        created_at: user.createdAt,
      });
    if (error) {
      console.error('Supabase saveUser error:', error);
      throw error;
    }
  },

  /**
   * Fetch complete user ledger (transactions, budgets, savings pots)
   */
  async getUserLedger(userId: string): Promise<UserLedger> {
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
  },

  /**
   * Save or edit a transaction record
   */
  async saveTransaction(userId: string, tx: Transaction): Promise<void> {
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
  },

  /**
   * Delete a transaction record
   */
  async deleteTransaction(_userId: string, txId: string): Promise<void> {
    // Note: userId is included for consistency with the fallback logic, but not strictly needed for Supabase delete
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', txId);
    if (error) {
      console.error('Supabase deleteTransaction error:', error);
      throw error;
    }
  },

  /**
   * Delete multiple transaction records in bulk
   */
  async deleteTransactions(_userId: string, txIds: string[]): Promise<void> {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .in('id', txIds);
    if (error) {
      console.error('Supabase deleteTransactions error:', error);
      throw error;
    }
  },

  /**
   * Save or edit multiple transaction records in bulk
   */
  async saveTransactions(userId: string, txs: Transaction[]): Promise<void> {
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
  },

  /**
   * Set or update category budget limits
   */
  async saveBudget(userId: string, currency: CurrencyCode, category: string, amount: number): Promise<void> {
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
  },

  /**
   * Save or edit a savings pot details
   */
  async saveSavingsPot(userId: string, pot: SavingsPot): Promise<void> {
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
  },

  /**
   * Delete a savings pot
   */
  async deleteSavingsPot(_userId: string, potId: string): Promise<void> {
    const { error } = await supabase
      .from('savings_pots')
      .delete()
      .eq('id', potId);
    if (error) {
      console.error('Supabase deleteSavingsPot error:', error);
      throw error;
    }
  },

  /**
   * Reset user ledger balances (clear all)
   */
  async clearLedger(userId: string): Promise<void> {
    const [txErr, bErr, sErr] = await Promise.all([
      supabase.from('transactions').delete().eq('user_id', userId),
      supabase.from('budgets').delete().eq('user_id', userId),
      supabase.from('savings_pots').delete().eq('user_id', userId),
    ]);
    if (txErr.error) console.error('Supabase clear transactions error:', txErr.error);
    if (bErr.error) console.error('Supabase clear budgets error:', bErr.error);
    if (sErr.error) console.error('Supabase clear savings pots error:', sErr.error);
  },
};
