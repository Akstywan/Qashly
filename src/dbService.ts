import { supabase } from './supabase';
import type { User, UserLedger, Transaction, SavingsPot, Account, CurrencyCode } from './types';
import { createEmptyBudgets } from './utils';

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
        console.error('Supabase getUsers read error:', error);
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
        userPreferences: u.permissions?.preferences || undefined,
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
        list.push(seedAdmin);
      }

      return list;
    } catch (e) {
      console.error('getUsers error:', e);
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
    const existingPerms = user.permissions || {
      savingsPots: true,
      budgets: true,
      transactions: true,
      multiAccount: true,
    };

    const mergedPermissions = {
      ...existingPerms,
      ...(user.userPreferences ? { preferences: user.userPreferences } : {})
    };

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
        permissions: mergedPermissions
      });
    if (error) {
      console.error('Supabase saveUser error:', error);
      throw error;
    }
  },

  /**
   * Save user preferences directly to Cloud DB (permissions JSONB in users table)
   */
  async saveUserPreferences(userId: string, preferences: any): Promise<void> {
    const { data: uData, error: fetchErr } = await supabase
      .from('users')
      .select('permissions')
      .eq('id', userId)
      .single();

    if (fetchErr) {
      console.error('Supabase fetch user permissions error:', fetchErr);
    }

    const perms = uData?.permissions || {
      savingsPots: true,
      budgets: true,
      transactions: true,
      multiAccount: true,
    };

    const updatedPermissions = {
      ...perms,
      preferences
    };

    const { error } = await supabase
      .from('users')
      .update({ permissions: updatedPermissions })
      .eq('id', userId);

    if (error) {
      console.error('Supabase saveUserPreferences error:', error);
      throw error;
    }
  },

  /**
   * Update active single-device session token for user
   */
  async updateUserSessionToken(userId: string, sessionToken: string): Promise<void> {
    try {
      const { data: uData } = await supabase.from('users').select('permissions').eq('id', userId).single();
      const perms = uData?.permissions || {};
      await supabase.from('users').update({
        permissions: {
          ...perms,
          sessionToken
        }
      }).eq('id', userId);
    } catch (e) {
      console.warn('Failed to update user sessionToken in cloud DB:', e);
    }
  },

  /**
   * Fetch active single-device session token for user
   */
  async getUserSessionToken(userId: string): Promise<string | null> {
    try {
      const { data: uData } = await supabase.from('users').select('permissions').eq('id', userId).single();
      return uData?.permissions?.sessionToken || null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Fetch complete user ledger (transactions, budgets, savings pots, accounts)
   */
  async getUserLedger(userId: string): Promise<UserLedger> {
    const [txRes, bRes, sRes, accRes, uRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', userId),
      supabase.from('budgets').select('*').eq('user_id', userId),
      supabase.from('savings_pots').select('*').eq('user_id', userId),
      supabase.from('user_accounts').select('*').eq('user_id', userId),
      supabase.from('users').select('permissions').eq('id', userId).single(),
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

    // Parse user custom accounts list from user_accounts table or fallback to cloud user profile JSONB
    let accountsArr: Account[] = [];
    if (!accRes.error && accRes.data && accRes.data.length > 0) {
      accountsArr = accRes.data.map((a: any) => ({
        id: a.id,
        name: a.name,
        type: a.type || 'checking',
        currency: a.currency || 'KWD',
      }));
    } else if (uRes.data && uRes.data.permissions && Array.isArray(uRes.data.permissions.accounts)) {
      accountsArr = [...uRes.data.permissions.accounts];
    }

    // Auto-detect & merge any account names referenced in transactions that aren't in accountsArr yet
    const existingNames = new Set(accountsArr.map((a) => a.name));
    transactionsArr.forEach((t) => {
      if (t.account && !existingNames.has(t.account)) {
        existingNames.add(t.account);
        accountsArr.push({
          id: `acc-${t.account.replace(/\s+/g, '-').toLowerCase()}`,
          name: t.account,
          type: 'checking',
          currency: t.currency || 'KWD'
        });
      }
    });

    if (accountsArr.length === 0) {
      accountsArr = [
        { id: 'acc-kuwait-cash', name: 'Kuwait Cash Account', type: 'checking', currency: 'KWD' },
        { id: 'acc-salary-savings', name: 'Salary Savings', type: 'savings', currency: 'KWD' },
        { id: 'acc-nre', name: 'NRE Account', type: 'checking', currency: 'INR' },
        { id: 'acc-nro', name: 'NRO Account', type: 'savings', currency: 'INR' }
      ];
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
   * Save or update a custom user account
   */
  async saveAccount(userId: string, account: Account): Promise<void> {
    // Attempt upsert into user_accounts table
    try {
      await supabase.from('user_accounts').upsert({
        id: account.id,
        user_id: userId,
        name: account.name,
        type: account.type || 'checking',
        currency: account.currency || 'KWD',
      });
    } catch (e) {
      console.warn('user_accounts table not found in DB, using cloud user profile fallback:', e);
    }

    // Always update permissions.accounts JSONB in users table as cloud backup
    try {
      const { data: uData } = await supabase.from('users').select('permissions').eq('id', userId).single();
      const perms = uData?.permissions || {};
      let accs: Account[] = Array.isArray(perms.accounts) ? [...perms.accounts] : [];
      const idx = accs.findIndex((a) => a.id === account.id);
      if (idx >= 0) {
        accs[idx] = account;
      } else {
        accs.push(account);
      }
      await supabase.from('users').update({
        permissions: {
          ...perms,
          accounts: accs
        }
      }).eq('id', userId);
    } catch (e) {
      console.error('Failed to sync accounts in users permissions JSONB', e);
    }
  },

  /**
   * Delete a custom user account and re-assign transactions using it to Cash
   */
  async deleteAccount(userId: string, accountId: string, accountName?: string): Promise<void> {
    try {
      if (accountName) {
        await supabase.from('user_accounts').delete().eq('user_id', userId).or(`id.eq.${accountId},name.eq.${accountName}`);
      } else {
        await supabase.from('user_accounts').delete().eq('id', accountId);
      }
    } catch (e) {
      console.warn('user_accounts table delete attempt:', e);
    }

    try {
      const { data: uData } = await supabase.from('users').select('permissions').eq('id', userId).single();
      if (uData?.permissions && Array.isArray(uData.permissions.accounts)) {
        const updatedAccs = uData.permissions.accounts.filter((a: Account) => a.id !== accountId && (accountName ? a.name !== accountName : true));
        await supabase.from('users').update({
          permissions: {
            ...uData.permissions,
            accounts: updatedAccs
          }
        }).eq('id', userId);
      }
    } catch (e) {
      console.error('Failed to sync account deletion in users permissions JSONB', e);
    }

    if (accountName) {
      try {
        await supabase
          .from('transactions')
          .update({ account_method: 'Cash' })
          .eq('user_id', userId)
          .eq('account_method', accountName);
      } catch (e) {
        console.warn('Failed to update transactions for deleted account:', e);
      }
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
      supabase.from('user_accounts').delete().eq('user_id', userId),
    ]);
    if (txErr.error) console.error('Supabase clear transactions error:', txErr.error);
    if (bErr.error) console.error('Supabase clear budgets error:', bErr.error);
    if (sErr.error) console.error('Supabase clear savings pots error:', sErr.error);

    // Clear cloud backup accounts in users JSONB
    try {
      const { data: uData } = await supabase.from('users').select('permissions').eq('id', userId).single();
      if (uData?.permissions) {
        await supabase.from('users').update({
          permissions: {
            ...uData.permissions,
            accounts: []
          }
        }).eq('id', userId);
      }
    } catch (e) {
      console.error('Failed to clear cloud backup accounts', e);
    }
  },
};

