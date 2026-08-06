import { supabase } from './supabase';
import type { User, UserLedger, Transaction, SavingsPot, Account, CurrencyCode } from './types';
import { createEmptyBudgets } from './utils';

export function isLocalTestingMode(): boolean {
  if (typeof window === 'undefined') return false;
  const forcedLocal = localStorage.getItem('qashly_local_testing_mode') === 'true';
  if (forcedLocal) return true;
  return false;
}

export const dbService = {
  /**
   * Fetch all registered profiles, seeding an admin if empty
   */
  async getUsers(): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*');
      if (error) {
        console.warn('Supabase getUsers read error (using local state fallback):', error);
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
        isFrozen: !!u.is_frozen,
        baseCurrency: u.base_currency || 'KWD',
        permissions: u.permissions || {
          savingsPots: true,
          budgets: true,
          transactions: true,
          multiAccount: true,
        },
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

        if (!isLocalTestingMode()) {
          await supabase.from('users').upsert({
            id: seedAdmin.id,
            username: seedAdmin.username,
            name: seedAdmin.name,
            role: seedAdmin.role,
            password_hash: seedAdmin.passwordHash,
            security_question: '',
            security_answer_hash: '',
            created_at: seedAdmin.createdAt,
            is_frozen: false,
            permissions: {
              savingsPots: true,
              budgets: true,
              transactions: true,
              multiAccount: true,
            }
          });
        }
        list.push(seedAdmin);
      }

      return list;
    } catch (e) {
      console.warn('getUsers fallback to local admin user:', e);
      return [{
        id: '00000000-0000-0000-0000-000000000000',
        name: 'Admin',
        username: 'admin',
        role: 'admin',
        passwordHash: 'b90707af3eb863de0f8e8a04156c279fbb8fee53eae979b9e40a2261fe42f6e9',
        securityQuestion: '',
        securityAnswerHash: '',
        createdAt: new Date().toISOString()
      }];
    }
  },

  /**
   * Register or update a user profile
   */
  async saveUser(user: User): Promise<void> {
    if (isLocalTestingMode()) {
      console.log('🧪 Local Testing Mode: saveUser executed in local state only. DB protected.', user.name);
      return;
    }
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
        is_frozen: !!user.isFrozen,
        base_currency: user.baseCurrency || 'KWD',
        permissions: user.permissions || {
          savingsPots: true,
          budgets: true,
          transactions: true,
          multiAccount: true,
        }
      });
    if (error) {
      console.error('Supabase saveUser error:', error);
      throw error;
    }
  },

  /**
   * Fetch complete user ledger (transactions, budgets, savings pots, accounts)
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

    // Parse user custom accounts list (with local storage sync fallback)
    let accountsArr: Account[] = [];
    try {
      const { data: accData, error: accErr } = await supabase.from('user_accounts').select('*').eq('user_id', userId);
      if (!accErr && accData && accData.length > 0) {
        accountsArr = accData.map((a: any) => ({
          id: a.id,
          name: a.name,
          type: a.type || 'checking',
          currency: a.currency || 'KWD',
        }));
      } else {
        const rawLoc = localStorage.getItem(`qashly_accounts_${userId}`);
        if (rawLoc) {
          accountsArr = JSON.parse(rawLoc);
        }
      }
    } catch {
      const rawLoc = localStorage.getItem(`qashly_accounts_${userId}`);
      if (rawLoc) {
        accountsArr = JSON.parse(rawLoc);
      }
    }

    return {
      transactions: transactionsArr,
      budgets: budgetsObj,
      savingsPots: savingsPotsArr,
      accounts: accountsArr,
    };
  },

  /**
   * Save or edit a transaction record
   */
  async saveTransaction(userId: string, tx: Transaction): Promise<void> {
    if (isLocalTestingMode()) {
      console.log('🧪 Local Testing Mode: saveTransaction executed in local state only. DB protected.', tx.id);
      return;
    }
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
    if (isLocalTestingMode()) {
      console.log('🧪 Local Testing Mode: deleteTransaction executed in local state only. DB protected.', txId);
      return;
    }
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
    if (isLocalTestingMode()) {
      console.log('🧪 Local Testing Mode: deleteTransactions executed in local state only. DB protected.', txIds);
      return;
    }
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
    if (isLocalTestingMode()) {
      console.log('🧪 Local Testing Mode: saveTransactions executed in local state only. DB protected.', txs.length);
      return;
    }
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
    if (isLocalTestingMode()) {
      console.log('🧪 Local Testing Mode: saveBudget executed in local state only. DB protected.', category);
      return;
    }
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
    if (isLocalTestingMode()) {
      console.log('🧪 Local Testing Mode: saveSavingsPot executed in local state only. DB protected.', pot.name);
      return;
    }
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
    if (isLocalTestingMode()) {
      console.log('🧪 Local Testing Mode: deleteSavingsPot executed in local state only. DB protected.', potId);
      return;
    }
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
   * Save or update a custom user account
   */
  async saveAccount(userId: string, account: Account): Promise<void> {
    if (!isLocalTestingMode()) {
      try {
        await supabase.from('user_accounts').upsert({
          id: account.id,
          user_id: userId,
          name: account.name,
          type: account.type || 'checking',
          currency: account.currency || 'KWD',
        });
      } catch (e) {
        console.warn('Supabase saveAccount table unconfirmed, fallback to localStorage:', e);
      }
    }
    try {
      const rawLoc = localStorage.getItem(`qashly_accounts_${userId}`);
      let list: Account[] = rawLoc ? JSON.parse(rawLoc) : [];
      const idx = list.findIndex((a) => a.id === account.id);
      if (idx >= 0) {
        list[idx] = account;
      } else {
        list.push(account);
      }
      localStorage.setItem(`qashly_accounts_${userId}`, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to sync accounts in localStorage', e);
    }
  },

  /**
   * Delete a custom user account
   */
  async deleteAccount(userId: string, accountId: string): Promise<void> {
    if (!isLocalTestingMode()) {
      try {
        await supabase.from('user_accounts').delete().eq('id', accountId);
      } catch (e) {
        console.warn('Supabase deleteAccount table unconfirmed, fallback to localStorage:', e);
      }
    }
    try {
      const rawLoc = localStorage.getItem(`qashly_accounts_${userId}`);
      if (rawLoc) {
        let list: Account[] = JSON.parse(rawLoc);
        list = list.filter((a) => a.id !== accountId);
        localStorage.setItem(`qashly_accounts_${userId}`, JSON.stringify(list));
      }
    } catch (e) {
      console.error('Failed to delete account in localStorage', e);
    }
  },

  /**
   * Reset user ledger balances (clear all)
   */
  async clearLedger(userId: string): Promise<void> {
    if (isLocalTestingMode()) {
      console.log('🧪 Local Testing Mode: clearLedger executed in local state only. DB protected.');
      localStorage.removeItem(`qashly_accounts_${userId}`);
      return;
    }
    const [txErr, bErr, sErr] = await Promise.all([
      supabase.from('transactions').delete().eq('user_id', userId),
      supabase.from('budgets').delete().eq('user_id', userId),
      supabase.from('savings_pots').delete().eq('user_id', userId),
      supabase.from('user_accounts').delete().eq('user_id', userId),
    ]);
    if (txErr.error) console.error('Supabase clear transactions error:', txErr.error);
    if (bErr.error) console.error('Supabase clear budgets error:', bErr.error);
    if (sErr.error) console.error('Supabase clear savings pots error:', sErr.error);
    localStorage.removeItem(`qashly_accounts_${userId}`);
  },
};
