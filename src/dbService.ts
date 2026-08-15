import { supabase } from './supabase';
import type { User, UserLedger, Transaction, SavingsPot, Account, CurrencyCode } from './types';
import { createEmptyBudgets, createId } from './utils';

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
    let validUserId = user.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);

    if (!isUuid) {
      try {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('username', user.username)
          .maybeSingle();

        if (existingUser && existingUser.id) {
          validUserId = existingUser.id;
        } else {
          validUserId = createId();
        }
      } catch (e) {
        validUserId = createId();
      }
    }
    user.id = validUserId;

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

    try {
      const payload: any = {
        id: validUserId,
        username: user.username,
        name: user.name,
        role: user.role,
        password_hash: user.passwordHash,
        permissions: mergedPermissions
      };

      if (user.securityQuestion) payload.security_question = user.securityQuestion;
      if (user.securityAnswerHash) payload.security_answer_hash = user.securityAnswerHash;
      if (user.createdAt) payload.created_at = user.createdAt;
      if (user.isFrozen !== undefined) payload.is_frozen = !!user.isFrozen;
      if (user.baseCurrency) payload.base_currency = user.baseCurrency;

      const { error } = await supabase
        .from('users')
        .upsert(payload);

      if (error) {
        console.error('Supabase primary saveUser error:', error);
        // Try fallback upsert with minimal core fields if extra columns fail
        const { error: fallbackErr } = await supabase
          .from('users')
          .upsert({
            id: validUserId,
            username: user.username,
            name: user.name,
            role: user.role,
            password_hash: user.passwordHash
          });
        if (fallbackErr) {
          console.warn('Supabase fallback saveUser warning:', fallbackErr);
        }
      }
    } catch (e) {
      console.warn('Supabase saveUser exception handling:', e);
    }
  },

  /**
   * Save user preferences directly to Cloud DB (permissions JSONB in users table)
   */
  async saveUserPreferences(userId: string, preferences: any): Promise<void> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    let targetId = userId;
    if (!isUuid) {
      try {
        const { data } = await supabase.from('users').select('id').or(`id.eq.${userId},username.eq.${userId}`).maybeSingle();
        if (data?.id) targetId = data.id;
      } catch (e) {
        // Fallback
      }
    }

    try {
      const { data: uData } = await supabase
        .from('users')
        .select('permissions')
        .eq('id', targetId)
        .maybeSingle();

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
        .eq('id', targetId);

      if (error) {
        console.warn('Supabase saveUserPreferences error:', error);
      }
    } catch (e) {
      console.warn('Supabase saveUserPreferences exception:', e);
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
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(account.id);
    const validAccountId = isUuid ? account.id : createId();
    account.id = validAccountId;

    // Attempt upsert into user_accounts table
    try {
      await supabase.from('user_accounts').upsert({
        id: validAccountId,
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
      const idx = accs.findIndex((a) => a.id === account.id || a.name === account.name);
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
    let nameToDelete = accountName;

    // Fetch account name if not provided directly
    if (!nameToDelete) {
      try {
        const { data: accData } = await supabase
          .from('user_accounts')
          .select('name')
          .eq('user_id', userId)
          .eq('id', accountId)
          .single();
        nameToDelete = accData?.name;
      } catch (e) {
        // Fallback
      }
    }

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId);
      if (isUuid) {
        await supabase.from('user_accounts').delete().eq('user_id', userId).eq('id', accountId);
      }
      if (nameToDelete) {
        await supabase.from('user_accounts').delete().eq('user_id', userId).eq('name', nameToDelete);
      }
    } catch (e) {
      console.warn('user_accounts table delete attempt:', e);
    }

    try {
      const { data: uData } = await supabase.from('users').select('permissions').eq('id', userId).single();
      if (uData?.permissions && Array.isArray(uData.permissions.accounts)) {
        const updatedAccs = uData.permissions.accounts.filter((a: Account) => a.id !== accountId && (nameToDelete ? a.name !== nameToDelete : true));
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

    if (nameToDelete) {
      try {
        await supabase
          .from('transactions')
          .update({ account_method: '' })
          .eq('user_id', userId)
          .eq('account_method', nameToDelete);
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

