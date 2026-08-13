import React, { useState, useEffect } from 'react';
import type { User, UserLedger, CurrencyCode, Transaction, SavingsPot, Account } from './types';
import {
  createEmptyBudgets,
  getCurrentMonthKey,
  getPreferredTheme,
  createId,
  hashPassword,
  expenseCategories,
  incomeCategories,
  defaultEntryDate,
  getPreviousMonthKey,
  calculateMonthNetBalance,
  formatMonthLabel,
  fetchLiveExchangeRate
} from './utils';
import { dbService } from './dbService';
import { supabase } from './supabase';
import AuthScreen from './components/AuthScreen';
import Topbar from './components/Topbar';
import EntryPanel from './components/EntryPanel';
import DashboardView from './components/DashboardView';
import AdminView from './components/AdminView';
import ReportView from './components/ReportView';
import ProfileView from './components/ProfileView';
import MonthRolloverModal from './components/MonthRolloverModal';
import Icon from './components/Icon';

export const App: React.FC = () => {
  // Central App State
  const [users, setUsers] = useState<User[]>([]);
  const [userData, setUserData] = useState<Record<string, UserLedger>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'admin' | 'report' | 'profile' | 'transactions'>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>(getPreferredTheme());
  const [month, setMonth] = useState<string>(getCurrentMonthKey());
  const [transactionCurrency, setTransactionCurrency] = useState<CurrencyCode>('KWD');
  const [dashboardCurrency, setDashboardCurrency] = useState<CurrencyCode>('KWD');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [showManageAccountsModal, setShowManageAccountsModal] = useState<boolean>(false);
  const [newManageAccName, setNewManageAccName] = useState<string>('');
  const [newManageAccCurrency, setNewManageAccCurrency] = useState<CurrencyCode>('KWD');
  const [showUserPreferencesModal, setShowUserPreferencesModal] = useState<boolean>(false);
  const [prefDefaultExpenseCategory, setPrefDefaultExpenseCategory] = useState<string>('Groceries');
  const [prefDefaultIncomeCategory, setPrefDefaultIncomeCategory] = useState<string>('Salary');
  const [prefDefaultKwdPaymentMode, setPrefDefaultKwdPaymentMode] = useState<string>('Cash');
  const [prefDefaultInrPaymentMode, setPrefDefaultInrPaymentMode] = useState<string>('UPI');
  const [prefDefaultDisplayAccount, setPrefDefaultDisplayAccount] = useState<string>('all');
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [showMonthRolloverModal, setShowMonthRolloverModal] = useState<boolean>(false);
  const [transferFromAccount, setTransferFromAccount] = useState<string>('');
  const [transferFromMode, setTransferFromMode] = useState<string>('KNET / Debit Card');
  const [transferToAccount, setTransferToAccount] = useState<string>('');
  const [transferToMode, setTransferToMode] = useState<string>('Cash');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferDestAmount, setTransferDestAmount] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [liveExchangeRate, setLiveExchangeRate] = useState<number | null>(null);
  const [showBaseCurrencyPromptModal, setShowBaseCurrencyPromptModal] = useState<boolean>(false);
  const [pendingLoginUserId, setPendingLoginUserId] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [sessionExpired, setSessionExpired] = useState<boolean>(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState('');

  // Auto-sync currency to selected topbar account's assigned currency
  useEffect(() => {
    if (selectedAccount && selectedAccount !== 'all') {
      const activeL = activeUserId ? userData[activeUserId] : null;
      const accs = activeL?.accounts || [];
      const matchAcc = accs.find((a) => a.name === selectedAccount);
      if (matchAcc && matchAcc.currency) {
        setTransactionCurrency(matchAcc.currency);
        setDashboardCurrency(matchAcc.currency);
      }
    }
  }, [selectedAccount, activeUserId, userData]);

  // Auto-fetch live exchange rate dynamically when cross-currency transfer modal is active
  useEffect(() => {
    let isSubscribed = true;
    const activeL = activeUserId ? userData[activeUserId] : null;
    const accs = activeL?.accounts || [];
    const fromAccName = transferFromAccount || accs[0]?.name || '';
    const toAccName = transferToAccount || accs[1]?.name || accs[0]?.name || '';
    const fromAccObj = accs.find((a) => a.name === fromAccName);
    const toAccObj = accs.find((a) => a.name === toAccName);
    const fromCurr: CurrencyCode = fromAccObj?.currency || 'KWD';
    const toCurr: CurrencyCode = toAccObj?.currency || 'INR';

    if (showTransferModal && fromCurr !== toCurr) {
      fetchLiveExchangeRate(fromCurr, toCurr).then((rate) => {
        if (isSubscribed) {
          setLiveExchangeRate(rate);
          if (transferAmount && Number(transferAmount) > 0) {
            setTransferDestAmount((Number(transferAmount) * rate).toFixed(toCurr === 'INR' ? 2 : 3));
          }
        }
      });
    } else {
      setLiveExchangeRate(null);
    }
    return () => { isSubscribed = false; };
  }, [showTransferModal, transferFromAccount, transferToAccount, activeUserId, userData]);

  const [dismissedRollovers, setDismissedRollovers] = useState<Set<string>>(new Set());

  // Auto-prompt Month Rollover modal when entering a month with unhandled previous balance
  useEffect(() => {
    if (!activeUserId || !isLoaded) return;
    const activeLedger = userData[activeUserId];
    if (!activeLedger || !activeLedger.transactions) return;

    const dismissedKey = `${activeUserId}_${month}`;
    const isDismissed = dismissedRollovers.has(dismissedKey);

    // Suppress modal if a rollover transaction already exists for the month
    const hasExistingRollover = activeLedger.transactions.some(
      (t) => t.date.startsWith(month) && (t.category === 'Balance Transfer' || t.merchant.toLowerCase().includes('rollover'))
    );

    if (!isDismissed && !hasExistingRollover) {
      const prevMonth = getPreviousMonthKey(month);
      const kwdBalance = calculateMonthNetBalance(activeLedger.transactions, prevMonth, 'KWD');
      const inrBalance = calculateMonthNetBalance(activeLedger.transactions, prevMonth, 'INR');

      if (kwdBalance > 0 || inrBalance > 0) {
        setShowMonthRolloverModal(true);
      }
    }
  }, [activeUserId, month, isLoaded, userData, dismissedRollovers]);

  const handleConfirmMonthRollover = async (params: {
    sourceMonth: string;
    targetMonth: string;
    currency: CurrencyCode;
    amount: number;
    account: string;
    paymentMode: string;
    notes: string;
  }) => {
    if (!activeUserId) return;
    const rolloverDate = `${params.targetMonth}-01`;
    const rolloverTx: Transaction = {
      id: createId(),
      type: 'income',
      currency: params.currency,
      amount: params.amount,
      merchant: `Rollover from ${formatMonthLabel(params.sourceMonth)}`,
      date: rolloverDate,
      category: 'Balance Transfer',
      account: params.account,
      paymentMode: params.paymentMode,
      notes: params.notes
    };

    try {
      await dbService.saveTransaction(activeUserId, rolloverTx);
      setUserData((prev) => {
        const userL = prev[activeUserId] || { transactions: [], budgets: createEmptyBudgets(), savingsPots: [], accounts: [] };
        return {
          ...prev,
          [activeUserId]: {
            ...userL,
            transactions: [...userL.transactions, rolloverTx]
          }
        };
      });

      setDismissedRollovers((prev) => new Set(prev).add(`${activeUserId}_${params.targetMonth}`));

      showCustomAlert(
        'Balance Rollover Complete',
        `Transferred ${params.amount} ${params.currency} from ${formatMonthLabel(params.sourceMonth)} to ${formatMonthLabel(params.targetMonth)}.`,
        'success'
      );
    } catch (err) {
      showCustomAlert('Database Error', 'Failed to save balance rollover transaction.', 'error');
      throw err;
    }
  };

  const handleDismissMonthRollover = (targetMonth: string) => {
    if (activeUserId) {
      setDismissedRollovers((prev) => new Set(prev).add(`${activeUserId}_${targetMonth}`));
    }
  };

  // Sync user preferences directly from Cloud DB
  useEffect(() => {
    if (activeUserId) {
      const activeU = users.find((u) => u.id === activeUserId);
      const prefs = activeU?.userPreferences;
      if (prefs) {
        if (prefs.defaultExpenseCategory) setPrefDefaultExpenseCategory(prefs.defaultExpenseCategory);
        else if (prefs.defaultCategory) setPrefDefaultExpenseCategory(prefs.defaultCategory);
        if (prefs.defaultIncomeCategory) setPrefDefaultIncomeCategory(prefs.defaultIncomeCategory);
        if (prefs.defaultKwdPaymentMode) setPrefDefaultKwdPaymentMode(prefs.defaultKwdPaymentMode);
        else if (prefs.defaultPaymentMode) setPrefDefaultKwdPaymentMode(prefs.defaultPaymentMode);
        if (prefs.defaultInrPaymentMode) setPrefDefaultInrPaymentMode(prefs.defaultInrPaymentMode);
        if (prefs.defaultDisplayAccount) {
          setPrefDefaultDisplayAccount(prefs.defaultDisplayAccount);
          setSelectedAccount(prefs.defaultDisplayAccount);
        }
      }
    }
  }, [activeUserId, showUserPreferencesModal, users]);

  const handleExecuteTransfer = async () => {
    if (!activeUserId) return;
    const sourceAmountNum = Number(transferAmount);
    if (!sourceAmountNum || sourceAmountNum <= 0) {
      showCustomAlert('Transfer Error', 'Please enter a valid transfer amount.', 'error');
      return;
    }

    const sourceLabel = transferFromAccount || activeLedger.accounts?.[0]?.name || '';
    const destLabel = transferToAccount || activeLedger.accounts?.[1]?.name || activeLedger.accounts?.[0]?.name || '';
    if (sourceLabel === destLabel && transferFromMode === transferToMode) {
      showCustomAlert('Transfer Error', 'Source and destination account/mode cannot be identical.', 'error');
      return;
    }

    const fromAccObj = (activeLedger.accounts || []).find((a) => a.name === sourceLabel);
    const toAccObj = (activeLedger.accounts || []).find((a) => a.name === destLabel);

    const fromCurr: CurrencyCode = fromAccObj?.currency || 'KWD';
    const toCurr: CurrencyCode = toAccObj?.currency || 'INR';
    const isCross = fromCurr !== toCurr;

    let destAmountNum = sourceAmountNum;
    if (isCross) {
      destAmountNum = Number(transferDestAmount);
      if (!destAmountNum || destAmountNum <= 0) {
        showCustomAlert('Transfer Error', `Please enter a valid credit amount in ${toCurr}.`, 'error');
        return;
      }
    }

    const transferDate = defaultEntryDate(month);
    const rateText = isCross ? ` (@ rate: ${sourceAmountNum} ${fromCurr} = ${destAmountNum} ${toCurr})` : '';
    const noteText = transferNotes.trim()
      ? transferNotes.trim()
      : `Transfer from ${sourceLabel} (${transferFromMode}) to ${destLabel} (${transferToMode})${rateText}`;

    const outflowTx: Transaction = {
      id: createId(),
      type: 'expense',
      currency: fromCurr,
      amount: sourceAmountNum,
      merchant: `Transfer to ${destLabel} (${transferToMode})${isCross ? ` [Credited: ${destAmountNum} ${toCurr}]` : ''}`,
      date: transferDate,
      category: 'Transfer',
      account: sourceLabel,
      paymentMode: transferFromMode,
      notes: noteText
    };

    const inflowTx: Transaction = {
      id: createId(),
      type: 'income',
      currency: toCurr,
      amount: destAmountNum,
      merchant: `Transfer from ${sourceLabel} (${transferFromMode})${isCross ? ` [Debited: ${sourceAmountNum} ${fromCurr}]` : ''}`,
      date: transferDate,
      category: 'Transfer',
      account: destLabel,
      paymentMode: transferToMode,
      notes: noteText
    };

    try {
      await dbService.saveTransaction(activeUserId, outflowTx);
      await dbService.saveTransaction(activeUserId, inflowTx);

      setUserData((prev) => {
        const userL = prev[activeUserId] || { transactions: [], budgets: createEmptyBudgets(), savingsPots: [], accounts: [] };
        return {
          ...prev,
          [activeUserId]: {
            ...userL,
            transactions: [...userL.transactions, outflowTx, inflowTx]
          }
        };
      });

      setShowTransferModal(false);
      setTransferAmount('');
      setTransferDestAmount('');
      setTransferNotes('');
      showCustomAlert(
        'Transfer Complete',
        `Transferred ${sourceAmountNum} ${fromCurr} from "${sourceLabel}" to "${destLabel}" (${destAmountNum} ${toCurr} credited).`,
        'success'
      );
    } catch (error) {
      showCustomAlert('Database Error', 'Failed to complete account transfer.', 'error');
    }
  };

  // Custom premium dialog modal state
  const [modalState, setModalState] = useState<{
    show: boolean;
    title: string;
    description: string;
    type: 'alert' | 'confirm' | 'prompt' | 'export_selector';
    onConfirm: (val?: string) => void;
    onCancel?: () => void;
    tone?: 'success' | 'error' | 'warning' | 'info';
    isPassword?: boolean;
    placeholder?: string;
  }>({
    show: false,
    title: '',
    description: '',
    type: 'alert',
    onConfirm: () => {}
  });
  const [modalPromptInput, setModalPromptInput] = useState('');

  // Reusable custom modal wrapper functions returning Promises
  const showCustomAlert = (title: string, description: string, tone: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    return new Promise<void>((resolve) => {
      setModalState({
        show: true,
        title,
        description,
        type: 'alert',
        tone,
        onConfirm: () => {
          setModalState(prev => ({ ...prev, show: false }));
          resolve();
        }
      });
    });
  };

  const showCustomConfirm = (title: string, description: string, tone: 'warning' | 'info' = 'warning') => {
    return new Promise<boolean>((resolve) => {
      setModalState({
        show: true,
        title,
        description,
        type: 'confirm',
        tone,
        onConfirm: () => {
          setModalState(prev => ({ ...prev, show: false }));
          resolve(true);
        },
        onCancel: () => {
          setModalState(prev => ({ ...prev, show: false }));
          resolve(false);
        }
      });
    });
  };

  const showCustomPrompt = (
    title: string,
    description: string,
    tone: 'info' | 'warning' = 'info',
    isPassword = false,
    placeholder = ''
  ) => {
    return new Promise<string | null>((resolve) => {
      setModalPromptInput(placeholder || '');
      setModalState({
        show: true,
        title,
        description,
        type: 'prompt',
        tone,
        isPassword,
        placeholder,
        onConfirm: (val) => {
          setModalState(prev => ({ ...prev, show: false }));
          resolve(val || '');
        },
        onCancel: () => {
          setModalState(prev => ({ ...prev, show: false }));
          resolve(null);
        }
      });
    });
  };

  // Load state and users database on mount
  useEffect(() => {
    const initLoad = async () => {
      try {
        // Fetch users directly from Supabase Cloud Database
        const dbUsers = await dbService.getUsers();
        setUsers(dbUsers);

        // Auto-select initial user or default user
        if (dbUsers.length > 0) {
          const defaultU = dbUsers.find((u) => u.username === 'akstywan') || dbUsers[0];
          if (defaultU) {
            setCurrentUserId(defaultU.id);
            setActiveUserId(defaultU.id);

            // Fetch the active user's ledger data directly from Cloud DB
            const ledger = await dbService.getUserLedger(defaultU.id);
            setUserData({ [defaultU.id]: ledger });

            if (defaultU.baseCurrency) {
              setTransactionCurrency(defaultU.baseCurrency);
              setDashboardCurrency(defaultU.baseCurrency);
            }

            if (defaultU.userPreferences) {
              const prefs = defaultU.userPreferences;
              if (prefs.defaultDisplayAccount) {
                setSelectedAccount(prefs.defaultDisplayAccount);
                setPrefDefaultDisplayAccount(prefs.defaultDisplayAccount);
              }
              if (prefs.defaultExpenseCategory) setPrefDefaultExpenseCategory(prefs.defaultExpenseCategory);
              if (prefs.defaultIncomeCategory) setPrefDefaultIncomeCategory(prefs.defaultIncomeCategory);
              if (prefs.defaultKwdPaymentMode) setPrefDefaultKwdPaymentMode(prefs.defaultKwdPaymentMode);
              if (prefs.defaultInrPaymentMode) setPrefDefaultInrPaymentMode(prefs.defaultInrPaymentMode);
            }
          }
        }
      } catch (e) {
        console.error('Failed to load state from database', e);
      }
      setIsLoaded(true);
    };

    initLoad();
  }, []);

  // Supabase Realtime Cloud Subscriptions for live updates
  useEffect(() => {
    if (!activeUserId) return;

    const channel = supabase
      .channel('qashly-realtime-db')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        async () => {
          if (activeUserId) {
            const ledger = await dbService.getUserLedger(activeUserId);
            setUserData((prev) => ({ ...prev, [activeUserId]: ledger }));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budgets' },
        async () => {
          if (activeUserId) {
            const ledger = await dbService.getUserLedger(activeUserId);
            setUserData((prev) => ({ ...prev, [activeUserId]: ledger }));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'savings_pots' },
        async () => {
          if (activeUserId) {
            const ledger = await dbService.getUserLedger(activeUserId);
            setUserData((prev) => ({ ...prev, [activeUserId]: ledger }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeUserId]);

  // Apply CSS theme to HTML tag
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Session Inactivity Monitoring
  useEffect(() => {
    if (!currentUserId) return;

    let lastUpdate = Date.now();
    const TIMEOUT_MS = 15 * 60 * 1000;

    const recordActivity = () => {
      const now = Date.now();
      if (now - lastUpdate > 2000) {
        lastUpdate = now;
      }
    };

    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, recordActivity));

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastUpdate > TIMEOUT_MS) {
        // Sign out due to session timeout
        setCurrentUserId(null);
        setActiveUserId(null);
        setEditingTransaction(null);
        setCurrentView('dashboard');
        setSessionExpired(true);
      }
    }, 10000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, recordActivity));
      clearInterval(interval);
    };
  }, [currentUserId]);

  if (!isLoaded) {
    return null;
  }

  // Get active session users
  const currentUser = users.find((u) => u.id === currentUserId) || null;
  const activeUser = users.find((u) => u.id === activeUserId) || null;
  
  const activeLedger = activeUserId 
    ? userData[activeUserId] || { transactions: [], budgets: createEmptyBudgets(), savingsPots: [], accounts: [] } 
    : { transactions: [], budgets: createEmptyBudgets(), savingsPots: [], accounts: [] };

  // Filter transactions for currently selected month
  const monthTransactions = activeLedger.transactions.filter((t) => t.date.startsWith(month));

  const handleCreateUser = async (newUser: User) => {
    try {
      await dbService.saveUser(newUser);
      setUsers((prev) => [...prev, newUser]);
      setUserData((prev) => ({
        ...prev,
        [newUser.id]: {
          transactions: [],
          budgets: createEmptyBudgets(),
          savingsPots: []
        }
      }));
    } catch (error) {
      showCustomAlert('Database Error', 'Could not save user profile in the database.', 'error');
    }
  };

  const handleUpdateUser = async (updatedUser: User) => {
    const originalUser = users.find((u) => u.id === updatedUser.id);
    if (!originalUser) return;

    // Check if status (freeze) changed
    if (updatedUser.isFrozen !== originalUser.isFrozen) {
      const action = updatedUser.isFrozen ? 'freeze' : 'unfreeze';
      const confirmed = await showCustomConfirm(
        `${updatedUser.isFrozen ? 'Freeze' : 'Unfreeze'} User Account`,
        `Are you sure you want to ${action} the account for ${updatedUser.name}?`,
        updatedUser.isFrozen ? 'warning' : 'info'
      );
      if (!confirmed) return;
    } else {
      // Permissions changed
      const confirmed = await showCustomConfirm(
        'Update User Permissions',
        `Are you sure you want to update the access permissions for ${updatedUser.name}?`,
        'info'
      );
      if (!confirmed) return;
    }

    try {
      await dbService.saveUser(updatedUser);
      setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));

      if (updatedUser.isFrozen !== originalUser.isFrozen) {
        await showCustomAlert(
          'Account Status Updated',
          `The account for ${updatedUser.name} has been successfully ${updatedUser.isFrozen ? 'frozen' : 'unfrozen'}.`,
          'success'
        );
      } else {
        await showCustomAlert(
          'Permissions Updated',
          `Access permissions for ${updatedUser.name} have been updated successfully.`,
          'success'
        );
      }
    } catch (error) {
      showCustomAlert('Database Error', 'Could not update user profile in the database.', 'error');
      throw error;
    }
  };

  const handleSaveBaseCurrency = async (selectedCurr: CurrencyCode) => {
    const targetUserId = pendingLoginUserId || currentUserId;
    if (!targetUserId) return;
    const userToUpdate = users.find((u) => u.id === targetUserId);
    if (!userToUpdate) return;

    const updated: User = {
      ...userToUpdate,
      baseCurrency: selectedCurr
    };

    try {
      await dbService.saveUser(updated);
      setUsers((prev) => prev.map((u) => u.id === targetUserId ? updated : u));
      setDashboardCurrency(selectedCurr);
      setTransactionCurrency(selectedCurr);
      setShowBaseCurrencyPromptModal(false);
      setPendingLoginUserId(null);
    } catch (e) {
      console.error('Failed to save base currency', e);
    }
  };

  const handleLogin = async (userId: string) => {
    setTransitionMessage('Authenticating...');
    setIsTransitioning(true);

    try {
      const ledger = await dbService.getUserLedger(userId);
      setUserData((prev) => ({ ...prev, [userId]: ledger }));

      const dbUsers = await dbService.getUsers();
      setUsers(dbUsers);
      
      setCurrentUserId(userId);
      setActiveUserId(userId);
      setEditingTransaction(null);
      setCurrentView(window.innerWidth <= 640 ? 'transactions' : 'dashboard');
      setSessionExpired(false);

      const loggedUser = dbUsers.find((u) => u.id === userId);
      if (loggedUser && loggedUser.baseCurrency) {
        setDashboardCurrency(loggedUser.baseCurrency);
        setTransactionCurrency(loggedUser.baseCurrency);
      } else {
        setPendingLoginUserId(userId);
        setShowBaseCurrencyPromptModal(true);
      }

      // Check if new user has 0 custom accounts created
      if (!ledger.accounts || ledger.accounts.length === 0) {
        setTimeout(async () => {
          await showCustomAlert(
            'Account Setup Required',
            `Welcome ${loggedUser?.name || 'User'}! Please create your first account (e.g. Salary Account, Savings, Cash) to get started with Qashly.`,
            'warning'
          );
          setShowManageAccountsModal(true);
        }, 1300);
      }
    } catch (error) {
      console.error('Failed to load user ledger from database', error);
    } finally {
      setTimeout(() => {
        setIsTransitioning(false);
      }, 1200);
    }
  };

  const handleSignOut = async () => {
    const confirmed = await showCustomConfirm(
      'Sign Out',
      'Are you sure you want to sign out from your workspace?',
      'info'
    );
    if (!confirmed) return;

    setTransitionMessage('Signing Out Safely...');
    setIsTransitioning(true);

    setTimeout(() => {
      setCurrentUserId(null);
      setActiveUserId(null);
      setEditingTransaction(null);
      setCurrentView('dashboard');
      setIsTransitioning(false);
    }, 1200);
  };

  const handleThemeToggle = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };



  const handleResetUserLedger = async (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    const password = await showCustomPrompt(
      'Verify Administrator Password',
      `Please enter your administrator password to confirm resetting all transactions and budgets for ${user.name}:`,
      'warning'
    );
    if (password === null) return; // Action cancelled

    if (!currentUser) return;
    const passHash = await hashPassword(currentUser.username, password);
    if (passHash !== currentUser.passwordHash) {
      await showCustomAlert('Access Denied', 'Incorrect password. Reset cancelled.', 'error');
      return;
    }

    try {
      await dbService.clearLedger(userId);
      setUserData((prev) => ({
        ...prev,
        [userId]: {
          transactions: [],
          budgets: createEmptyBudgets(),
          savingsPots: []
        }
      }));

      if (activeUserId === userId) {
        setEditingTransaction(null);
      }
      showCustomAlert('Ledger Reset Complete', `All transactions and budgets for ${user.name} have been cleared.`, 'success');
    } catch (error) {
      showCustomAlert('Error', 'Failed to reset user ledger in the database.', 'error');
    }
  };

  const handleExport = () => {
    if (!activeUser) return;

    setModalState({
      show: true,
      title: 'Export to Excel',
      description: 'Choose which transaction data range you would like to export to Excel:',
      type: 'export_selector',
      tone: 'info',
      onConfirm: (rangeType) => {
        setModalState(prev => ({ ...prev, show: false }));
        
        const BOM = "\uFEFF";
        let csvContent = BOM;

        if (rangeType === 'current') {
          csvContent += `LEDGER REPORT FOR: ${month}\n\n`;

          // Budgets
          csvContent += 'CONFIGURED BUDGET LIMITS\n';
          csvContent += 'Currency,Category,Monthly Budget Limit\n';
          Object.keys(activeLedger.budgets || {}).forEach(curr => {
            const catLimits = activeLedger.budgets[curr as CurrencyCode] || {};
            Object.keys(catLimits).forEach(cat => {
              csvContent += `${curr},${cat},${catLimits[cat] || 0}\n`;
            });
          });
          csvContent += '\n';

          // Savings Pots
          csvContent += 'SAVINGS POTS AND TARGETS\n';
          csvContent += 'Pot Name,Target Amount,Current Saved,Currency\n';
          (activeLedger.savingsPots || []).forEach(p => {
            csvContent += `"${p.name.replace(/"/g, '""')}",${p.targetAmount},${p.currentAmount},${p.currency}\n`;
          });
          csvContent += '\n';

          // Transactions
          csvContent += `TRANSACTIONS FOR ${month}\n`;
          csvContent += 'Date,Merchant,Type,Currency,Amount,Category,Payment Method,Reconciled,Notes\n';
          monthTransactions.forEach(t => {
            csvContent += `${t.date},"${t.merchant.replace(/"/g, '""')}",${t.type},${t.currency},${t.amount},${t.category},"${(t.account || '').replace(/"/g, '""')}",${t.reconciled ? 'Yes' : 'No'},"${(t.notes || '').replace(/"/g, '""')}"\n`;
          });

          downloadFile(csvContent, `qashly-${activeUser.name.replace(/\s+/g, '-').toLowerCase()}-${month}.csv`);
        } else if (rangeType === 'full') {
          csvContent += `COMPLETE ACCOUNT HISTORY - EXPORTED ON ${new Date().toLocaleDateString()}\n\n`;

          // Budgets
          csvContent += 'CONFIGURED BUDGET LIMITS\n';
          csvContent += 'Currency,Category,Monthly Budget Limit\n';
          Object.keys(activeLedger.budgets || {}).forEach(curr => {
            const catLimits = activeLedger.budgets[curr as CurrencyCode] || {};
            Object.keys(catLimits).forEach(cat => {
              csvContent += `${curr},${cat},${catLimits[cat] || 0}\n`;
            });
          });
          csvContent += '\n';

          // Savings Pots
          csvContent += 'SAVINGS POTS AND TARGETS\n';
          csvContent += 'Pot Name,Target Amount,Current Saved,Currency\n';
          (activeLedger.savingsPots || []).forEach(p => {
            csvContent += `"${p.name.replace(/"/g, '""')}",${p.targetAmount},${p.currentAmount},${p.currency}\n`;
          });
          csvContent += '\n';

          // Transactions (All)
          csvContent += 'COMPLETE TRANSACTION LEDGER (ALL MONTHS)\n';
          csvContent += 'Date,Merchant,Type,Currency,Amount,Category,Payment Method,Reconciled,Notes\n';
          activeLedger.transactions.forEach(t => {
            csvContent += `${t.date},"${t.merchant.replace(/"/g, '""')}",${t.type},${t.currency},${t.amount},${t.category},"${(t.account || '').replace(/"/g, '""')}",${t.reconciled ? 'Yes' : 'No'},"${(t.notes || '').replace(/"/g, '""')}"\n`;
          });

          downloadFile(csvContent, `qashly-${activeUser.name.replace(/\s+/g, '-').toLowerCase()}-full-history.csv`);
        }
      },
      onCancel: () => {
        setModalState(prev => ({ ...prev, show: false }));
      }
    });
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleClear = async () => {
    if (!activeUser) return;

    const password = await showCustomPrompt(
      'Verify Password',
      `Please enter your password to confirm resetting all transactions, budgets, and savings pots for ${activeUser.name}:`,
      'warning'
    );
    if (password === null) return; // Action cancelled

    if (!currentUser) return;
    const passHash = await hashPassword(currentUser.username, password);
    if (passHash !== currentUser.passwordHash) {
      showCustomAlert('Access Denied', 'Incorrect password. Reset cancelled.', 'error');
      return;
    }

    try {
      await dbService.clearLedger(activeUserId!);
      setUserData((prev) => ({
        ...prev,
        [activeUserId!]: {
          transactions: [],
          budgets: createEmptyBudgets(),
          savingsPots: []
        }
      }));
      setEditingTransaction(null);
      showCustomAlert('Workspace Reset Complete', `All workspace data for ${activeUser.name} has been cleared.`, 'success');
    } catch (error) {
      showCustomAlert('Error', 'Failed to reset workspace database ledger.', 'error');
    }
  };

  const handleBudgetChange = async (curr: CurrencyCode, cat: string, limit: number) => {
    if (!activeUserId) return;
    try {
      await dbService.saveBudget(activeUserId, curr, cat, limit);
      setUserData((prev) => {
        const userL = prev[activeUserId] || { transactions: [], budgets: createEmptyBudgets(), savingsPots: [] };
        const newBudgets = {
          ...userL.budgets,
          [curr]: {
            ...userL.budgets[curr],
            [cat]: limit
          }
        };
        return {
          ...prev,
          [activeUserId]: {
            ...userL,
            budgets: newBudgets
          }
        };
      });
    } catch (error) {
      console.error('Failed to sync budget limit to database', error);
    }
  };

  const handleAddSavingsPot = async (name: string, targetAmount: number, currency: CurrencyCode) => {
    if (!activeUserId) return;
    const newPot: SavingsPot = {
      id: createId(),
      name,
      targetAmount,
      currentAmount: 0,
      currency
    };

    try {
      await dbService.saveSavingsPot(activeUserId, newPot);
      setUserData((prev) => {
        const userL = prev[activeUserId] || { transactions: [], budgets: createEmptyBudgets(), savingsPots: [] };
        const currentPots = userL.savingsPots || [];
        return {
          ...prev,
          [activeUserId]: {
            ...userL,
            savingsPots: [...currentPots, newPot]
          }
        };
      });
    } catch (error) {
      showCustomAlert('Database Error', 'Failed to save savings pot to database.', 'error');
    }
  };

  const handleDeleteSavingsPot = async (id: string) => {
    if (!activeUserId) return;
    const pot = (activeLedger.savingsPots || []).find((p) => p.id === id);
    if (!pot) return;

    const confirmed = await showCustomConfirm(
      'Delete Savings Pot',
      `Are you sure you want to permanently delete the savings pot "${pot.name}"?`,
      'warning'
    );
    if (!confirmed) return;

    try {
      await dbService.deleteSavingsPot(activeUserId, id);
      setUserData((prev) => {
        const userL = prev[activeUserId] || { transactions: [], budgets: createEmptyBudgets(), savingsPots: [] };
        const currentPots = userL.savingsPots || [];
        return {
          ...prev,
          [activeUserId]: {
            ...userL,
            savingsPots: currentPots.filter((p) => p.id !== id)
          }
        };
      });
      showCustomAlert('Savings Pot Deleted', `The savings pot "${pot.name}" has been deleted successfully.`, 'success');
    } catch (error) {
      showCustomAlert('Database Error', 'Failed to delete savings pot from database.', 'error');
    }
  };

  const handleAdjustSavingsBalance = async (id: string, amount: number) => {
    if (!activeUserId) return;
    const pot = (activeLedger.savingsPots || []).find((p) => p.id === id);
    if (!pot) return;

    const newBalance = Math.max(0, pot.currentAmount + amount);
    const updatedPot = { ...pot, currentAmount: newBalance };

    try {
      await dbService.saveSavingsPot(activeUserId, updatedPot);
      setUserData((prev) => {
        const userL = prev[activeUserId] || { transactions: [], budgets: createEmptyBudgets(), savingsPots: [] };
        const currentPots = userL.savingsPots || [];
        return {
          ...prev,
          [activeUserId]: {
            ...userL,
            savingsPots: currentPots.map((p) => p.id === id ? updatedPot : p)
          }
        };
      });
    } catch (error) {
      showCustomAlert('Database Error', 'Failed to update savings pot balance in database.', 'error');
    }
  };

  const handleCancelEdit = () => {
    setEditingTransaction(null);
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setTimeout(() => {
      const formElement = document.getElementById('transactionForm') || document.querySelector('.entry-sidebar');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        formElement.classList.add('pulse-highlight');
        setTimeout(() => {
          formElement.classList.remove('pulse-highlight');
        }, 1500);
      }
    }, 100);
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!activeUserId) return;
    const tx = activeLedger.transactions.find((t) => t.id === id);
    if (!tx) return;

    const confirmed = await showCustomConfirm(
      'Delete Transaction',
      `Are you sure you want to permanently delete the transaction "${tx.merchant}"?`,
      'warning'
    );
    if (!confirmed) return;

    try {
      await dbService.deleteTransaction(activeUserId, id);
      setUserData((prev) => {
        const userL = prev[activeUserId] || { transactions: [], budgets: createEmptyBudgets(), savingsPots: [] };
        return {
          ...prev,
          [activeUserId]: {
            ...userL,
            transactions: userL.transactions.filter((t) => t.id !== id)
          }
        };
      });

      if (editingTransaction?.id === id) {
        setEditingTransaction(null);
      }
    } catch (error) {
      showCustomAlert('Database Error', 'Failed to delete transaction from database.', 'error');
    }
  };

  const handleAddAccount = async (name: string, type?: Account['type'], currency?: CurrencyCode) => {
    if (!activeUserId) return;
    const newAccount: Account = {
      id: createId(),
      name: name.trim(),
      type: type || 'checking',
      currency: currency || 'KWD',
    };

    try {
      await dbService.saveAccount(activeUserId, newAccount);
      setUserData((prev) => {
        const userL = prev[activeUserId] || { transactions: [], budgets: createEmptyBudgets(), savingsPots: [], accounts: [] };
        const currentAccounts = userL.accounts || [];
        return {
          ...prev,
          [activeUserId]: {
            ...userL,
            accounts: [...currentAccounts, newAccount]
          }
        };
      });
      showCustomAlert('Account Created', `Account "${newAccount.name}" was added successfully.`, 'success');
    } catch (error) {
      showCustomAlert('Database Error', 'Failed to save account.', 'error');
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!activeUserId) return;
    const account = (activeLedger.accounts || []).find((a) => a.id === id);
    if (!account) return;

    const confirmed = await showCustomConfirm(
      'Delete Account',
      `Are you sure you want to delete account "${account.name}"? Transactions associated with it will remain intact.`,
      'warning'
    );
    if (!confirmed) return;

    try {
      await dbService.deleteAccount(activeUserId, id);
      setUserData((prev) => {
        const userL = prev[activeUserId] || { transactions: [], budgets: createEmptyBudgets(), savingsPots: [], accounts: [] };
        const currentAccounts = userL.accounts || [];
        return {
          ...prev,
          [activeUserId]: {
            ...userL,
            accounts: currentAccounts.filter((a) => a.id !== id)
          }
        };
      });
      showCustomAlert('Account Removed', `Account "${account.name}" has been deleted.`, 'success');
    } catch (error) {
      showCustomAlert('Database Error', 'Failed to delete account.', 'error');
    }
  };

  const handleEditAccount = async (account: Account) => {
    if (!activeUserId) return;
    setModalPromptInput(account.name);
    const newName = await showCustomPrompt(
      'Rename Account',
      `Enter new name for account "${account.name}":`,
      'info',
      false, // isPassword = false
      account.name
    );
    if (!newName || !newName.trim() || newName.trim() === account.name) return;

    const oldName = account.name;
    const updatedAccount: Account = {
      ...account,
      name: newName.trim()
    };

    try {
      await dbService.saveAccount(activeUserId, updatedAccount);

      const userL = userData[activeUserId];
      let updatedTxs = userL ? [...userL.transactions] : [];
      let txsChanged = false;

      updatedTxs = updatedTxs.map((t) => {
        if (t.account === oldName) {
          txsChanged = true;
          return { ...t, account: newName.trim() };
        }
        return t;
      });

      if (txsChanged) {
        await dbService.saveTransactions(activeUserId, updatedTxs);
      }

      setUserData((prev) => {
        const u = prev[activeUserId] || { transactions: [], budgets: createEmptyBudgets(), savingsPots: [], accounts: [] };
        const currentAccs = u.accounts || [];
        return {
          ...prev,
          [activeUserId]: {
            ...u,
            accounts: currentAccs.map((a) => (a.id === account.id ? updatedAccount : a)),
            transactions: txsChanged ? updatedTxs : u.transactions
          }
        };
      });

      showCustomAlert('Account Renamed', `Account renamed to "${newName.trim()}".`, 'success');
    } catch (e) {
      showCustomAlert('Error', 'Failed to rename account.', 'error');
    }
  };

  const handleSubmitTransaction = async (txData: Omit<Transaction, 'id'> & { id?: string }) => {
    if (!activeUserId) return;

    const targetId = txData.id || createId();
    const finalTx: Transaction = {
      ...txData,
      id: targetId
    } as Transaction;

    try {
      await dbService.saveTransaction(activeUserId, finalTx);

      // Check if transaction account is missing from account list
      const userL = userData[activeUserId] || { transactions: [], budgets: createEmptyBudgets(), savingsPots: [], accounts: [] };
      const currentAccounts = userL.accounts || [];
      let updatedAccounts = [...currentAccounts];
      if (finalTx.account && !currentAccounts.some((a) => a.name === finalTx.account)) {
        const newAcc: Account = {
          id: createId(),
          name: finalTx.account,
          type: 'checking',
          currency: finalTx.currency || 'KWD'
        };
        updatedAccounts.push(newAcc);
        dbService.saveAccount(activeUserId, newAcc).catch((e) => console.warn('saveAccount auto-sync:', e));
      }

      setUserData((prev) => {
        const currentL = prev[activeUserId] || { transactions: [], budgets: createEmptyBudgets(), savingsPots: [], accounts: [] };
        let newTransactions = [...currentL.transactions];

        if (txData.id) {
          newTransactions = newTransactions.map((t) => t.id === txData.id ? finalTx : t);
        } else {
          newTransactions.push(finalTx);
        }

        return {
          ...prev,
          [activeUserId]: {
            ...currentL,
            accounts: updatedAccounts,
            transactions: newTransactions
          }
        };
      });

      // Update viewing months, currency, and ensure selected account includes the new transaction
      const txMonth = txData.date.slice(0, 7);
      setMonth(txMonth);
      setTransactionCurrency(txData.currency);
      setDashboardCurrency(txData.currency);
      if (selectedAccount !== 'all' && selectedAccount !== finalTx.account) {
        setSelectedAccount('all');
      }
      setEditingTransaction(null);

      // Popup notification confirmation modal when transaction is added or updated
      const isEditing = !!txData.id;
      const amountFormatted = `${finalTx.currency} ${finalTx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      showCustomAlert(
        isEditing ? 'Transaction Updated!' : 'Transaction Added Successfully!',
        `${finalTx.type === 'income' ? 'Received' : 'Spent'} ${amountFormatted} ${finalTx.type === 'income' ? 'from' : 'at'} "${finalTx.merchant}" [${finalTx.category} • ${finalTx.account}].`,
        'success'
      );
    } catch (error) {
      showCustomAlert('Database Error', 'Failed to save transaction record in database.', 'error');
    }
  };

  const handleUpdateProfile = async (
    name: string,
    newPasswordHash?: string,
    securityQuestion?: string,
    securityAnswerHash?: string
  ) => {
    if (!currentUserId) return;
    const currentU = users.find((u) => u.id === currentUserId);
    if (!currentU) return;

    const updatedUser: User = {
      ...currentU,
      name,
      passwordHash: newPasswordHash || currentU.passwordHash,
      securityQuestion: securityQuestion !== undefined ? securityQuestion : currentU.securityQuestion,
      securityAnswerHash: securityAnswerHash !== undefined ? securityAnswerHash : currentU.securityAnswerHash
    };

    try {
      await dbService.saveUser(updatedUser);
      const dbUsers = await dbService.getUsers();
      setUsers(dbUsers);
    } catch (error) {
      console.error('Failed to save profile updates', error);
      throw error;
    }
  };

  const handleBulkDeleteTransactions = async (ids: string[]) => {
    if (!activeUserId) return;
    if (ids.length === 0) return;

    const confirmed = await showCustomConfirm(
      'Delete Multiple Transactions',
      `Are you sure you want to permanently delete all ${ids.length} selected transactions?`,
      'warning'
    );
    if (!confirmed) return;

    try {
      await dbService.deleteTransactions(activeUserId, ids);
      setUserData((prev) => {
        const userL = prev[activeUserId] || { transactions: [], budgets: createEmptyBudgets(), savingsPots: [] };
        return {
          ...prev,
          [activeUserId]: {
            ...userL,
            transactions: userL.transactions.filter((t) => !ids.includes(t.id))
          }
        };
      });
      if (editingTransaction && ids.includes(editingTransaction.id)) {
        setEditingTransaction(null);
      }
    } catch (error) {
      showCustomAlert('Database Error', 'Failed to delete transactions from database.', 'error');
    }
  };

  const handleBulkUpdateTransactions = async (ids: string[], updates: Partial<Transaction>) => {
    if (!activeUserId) return;
    if (ids.length === 0) return;

    try {
      const userL = userData[activeUserId] || { transactions: [], budgets: createEmptyBudgets(), savingsPots: [] };
      const updatedTxs = userL.transactions.map((t) => {
        if (ids.includes(t.id)) {
          return { ...t, ...updates };
        }
        return t;
      });

      const txsToSave = updatedTxs.filter((t) => ids.includes(t.id));
      await dbService.saveTransactions(activeUserId, txsToSave);

      setUserData((prev) => ({
        ...prev,
        [activeUserId]: {
          ...userL,
          transactions: updatedTxs
        }
      }));

      if (editingTransaction && ids.includes(editingTransaction.id)) {
        setEditingTransaction({ ...editingTransaction, ...updates } as Transaction);
      }
    } catch (error) {
      showCustomAlert('Database Error', 'Failed to update transactions in database.', 'error');
    }
  };

  return (
    <div className="app-shell">
      {currentUser ? (
        <>
          <Topbar
            currentUser={currentUser}
            activeUser={activeUser!}
            month={month}
            dashboardCurrency={dashboardCurrency}
            theme={theme}
            currentView={currentView}
            onMonthChange={setMonth}
            onDashboardCurrencyChange={setDashboardCurrency}
            onThemeToggle={handleThemeToggle}
            onViewChange={setCurrentView}
            onSignOut={handleSignOut}
            onExport={handleExport}
            onClear={handleClear}
            accounts={activeLedger.accounts || []}
            selectedAccount={selectedAccount}
            onAccountChange={setSelectedAccount}
            onOpenManageAccounts={() => setShowManageAccountsModal(true)}
            onOpenUserPreferences={() => setShowUserPreferencesModal(true)}
            onOpenTransferModal={() => setShowTransferModal(true)}
            onOpenMonthRolloverModal={() => setShowMonthRolloverModal(true)}
          />
          <main className={`workspace ${
            (currentView !== 'dashboard' && currentView !== 'transactions') || !(currentUser?.permissions?.transactions ?? true)
              ? 'admin-mode'
              : ''
          }`}>
            {(currentView === 'dashboard' || currentView === 'transactions') && (currentUser?.permissions?.transactions ?? true) && (
              <EntryPanel
                month={month}
                editingTransaction={editingTransaction}
                onCancelEdit={handleCancelEdit}
                onSubmit={handleSubmitTransaction}
                transactionCurrency={transactionCurrency}
                onTransactionCurrencyChange={setTransactionCurrency}
                hideOnMobile={currentView === 'dashboard'}
                accounts={activeLedger.accounts || []}
                selectedAccount={selectedAccount}
                activeUserId={activeUserId || undefined}
                userPreferences={activeUser?.userPreferences}
                permissions={currentUser?.permissions}
                onAddAccount={handleAddAccount}
              />
            )}

            {(currentView === 'dashboard' || currentView === 'transactions') ? (
              <DashboardView
                monthTransactions={monthTransactions}
                budgets={activeLedger.budgets}
                savingsPots={activeLedger.savingsPots || []}
                accounts={activeLedger.accounts || []}
                selectedAccount={selectedAccount}
                dashboardCurrency={dashboardCurrency}
                onBudgetChange={handleBudgetChange}
                onEditTransaction={handleEditTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                onAddSavingsPot={handleAddSavingsPot}
                onDeleteSavingsPot={handleDeleteSavingsPot}
                onAdjustSavingsBalance={handleAdjustSavingsBalance}
                onAddAccount={handleAddAccount}
                onDeleteAccount={handleDeleteAccount}
                onBulkDeleteTransactions={handleBulkDeleteTransactions}
                onBulkUpdateTransactions={handleBulkUpdateTransactions}
                theme={theme}
                permissions={currentUser?.permissions}
                hideTransactionsOnMobile={currentView === 'dashboard'}
                showOnlyTransactionsOnMobile={currentView === 'transactions'}
              />
            ) : currentView === 'report' ? (
              <ReportView
                monthTransactions={monthTransactions}
                budgets={activeLedger.budgets}
                dashboardCurrency={dashboardCurrency}
              />
            ) : currentView === 'profile' ? (
              <ProfileView
                currentUser={currentUser}
                onUpdateProfile={handleUpdateProfile}
                onCancel={() => setCurrentView('dashboard')}
              />
            ) : (
              <AdminView
                users={users}
                onResetUserLedger={handleResetUserLedger}
                onCreateUser={handleCreateUser}
                onUpdateUser={handleUpdateUser}
              />
            )}
          </main>
        </>
      ) : (
        <AuthScreen
          users={users}
          onLogin={handleLogin}
          onCreateUser={handleCreateUser}
          sessionExpired={sessionExpired}
        />
      )}

      {/* Customized premium Alert/Confirm/Prompt modal popup */}
      {modalState.show && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(7, 9, 12, 0.45)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20000,
          padding: '20px',
          animation: 'fade-in 0.25s ease'
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: '24px',
            padding: '36px 32px',
            maxWidth: '420px',
            width: '100%',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            animation: 'scale-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}>
            {/* Tone icon badge */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: modalState.tone === 'success' 
                ? 'linear-gradient(135deg, #0a4f70, #46a1c5)' // Premium deep teal-blue to cyan
                : modalState.tone === 'error'
                ? 'linear-gradient(135deg, #d34221, #f2894f)' // Premium terracotta red/coral orange
                : modalState.tone === 'warning'
                ? 'linear-gradient(135deg, #e76f51, #f4a261)' // Premium orange to sand/peach
                : 'linear-gradient(135deg, #118ab2, #84cce4)', // Cyan to light blue gradient
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 'bold',
              marginBottom: '20px',
              boxShadow: modalState.tone === 'success'
                ? '0 8px 20px rgba(10, 79, 112, 0.3)'
                : modalState.tone === 'error'
                ? '0 8px 20px rgba(211, 66, 33, 0.3)'
                : modalState.tone === 'warning'
                ? '0 8px 20px rgba(231, 111, 81, 0.3)'
                : '0 8px 20px rgba(17, 138, 178, 0.3)'
            }}>
              <Icon name={modalState.tone === 'success' ? 'check' : modalState.tone === 'error' ? 'x' : modalState.tone === 'warning' ? 'warning' : 'info'} />
            </div>

            <h3 style={{
              fontSize: '20px',
              fontWeight: 800,
              margin: '0 0 10px 0',
              color: 'var(--text)',
              fontFamily: 'Outfit, sans-serif'
            }}>
              {modalState.title}
            </h3>

            <p style={{
              fontSize: '13.5px',
              color: 'var(--muted)',
              margin: '0 0 24px 0',
              lineHeight: 1.5
            }}>
              {modalState.description}
            </p>

            {modalState.type === 'prompt' && (
              <input
                type={modalState.isPassword ? 'password' : 'text'}
                placeholder={modalState.placeholder || 'Enter value...'}
                value={modalPromptInput}
                onChange={(e) => setModalPromptInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'var(--field)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '12px',
                  color: 'var(--text)',
                  fontSize: '14px',
                  outline: 'none',
                  marginBottom: '24px',
                  textAlign: 'center'
                }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    modalState.onConfirm(modalPromptInput);
                  }
                }}
              />
            )}

            {modalState.type === 'export_selector' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                <button
                  className="button"
                  type="button"
                  onClick={() => modalState.onConfirm('current')}
                  style={{
                    width: '100%',
                    padding: '12px 0',
                    background: 'linear-gradient(135deg, #0a4f70, #46a1c5)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(10, 79, 112, 0.3)',
                    transition: 'transform 0.15s ease, filter 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                >
                  Current Month Ledger
                </button>
                <button
                  className="button"
                  type="button"
                  onClick={() => modalState.onConfirm('full')}
                  style={{
                    width: '100%',
                    padding: '12px 0',
                    background: 'linear-gradient(135deg, #2080a8, #84cce4)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(32, 128, 168, 0.3)',
                    transition: 'transform 0.15s ease, filter 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                >
                  Full History Ledger
                </button>
                <button
                  className="button button-soft"
                  type="button"
                  onClick={modalState.onCancel}
                  style={{ width: '100%', padding: '12px 0', borderRadius: '12px' }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                {(modalState.type === 'confirm' || modalState.type === 'prompt') && (
                  <button
                    className="button button-soft"
                    type="button"
                    onClick={modalState.onCancel}
                    style={{ flex: 1, padding: '12px 0', borderRadius: '12px' }}
                  >
                    Cancel
                  </button>
                )}
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    if (modalState.type === 'prompt') {
                      modalState.onConfirm(modalPromptInput);
                    } else {
                      modalState.onConfirm();
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    background: modalState.tone === 'success'
                      ? 'linear-gradient(135deg, #0a4f70, #46a1c5)'
                      : modalState.tone === 'error'
                      ? 'linear-gradient(135deg, #d34221, #f2894f)'
                      : modalState.tone === 'warning'
                      ? 'linear-gradient(135deg, #e76f51, #f4a261)'
                      : 'linear-gradient(135deg, #118ab2, #84cce4)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: modalState.tone === 'success'
                      ? '0 4px 14px rgba(10, 79, 112, 0.3)'
                      : modalState.tone === 'error'
                      ? '0 4px 14px rgba(211, 66, 33, 0.3)'
                      : modalState.tone === 'warning'
                      ? '0 4px 14px rgba(231, 111, 81, 0.3)'
                      : '0 4px 14px rgba(17, 138, 178, 0.3)',
                    transition: 'transform 0.15s ease, filter 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                  onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                  onMouseUp={(e) => e.currentTarget.style.transform = 'none'}
                >
                  {modalState.type === 'alert' ? 'Okay' : 'Confirm'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full-screen Loading Transition Overlay */}
      {isTransitioning && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(7, 9, 12, 0.85)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 11000,
          animation: 'fade-in 0.25s ease',
          color: '#ffffff'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            border: '3px solid rgba(44, 155, 138, 0.1)',
            borderTopColor: 'var(--green)',
            animation: 'spin 1s linear infinite',
            marginBottom: '20px'
          }} />
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, letterSpacing: '0.05em' }}>
            {transitionMessage}
          </h2>
          <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)' }}>
            Securing your workspace data...
          </p>
        </div>
      )}

      {/* Manage Accounts Modal Popup */}
      {showManageAccountsModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(7, 9, 12, 0.45)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10500,
          padding: '20px',
          animation: 'fade-in 0.25s ease'
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: '24px',
            padding: '28px 24px',
            maxWidth: '440px',
            width: '100%',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="eyebrow">Multi-Account Management</span>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Manage Accounts</h2>
              </div>
              <button
                type="button"
                className="button button-soft"
                onClick={() => setShowManageAccountsModal(false)}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                Close
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Create and manage custom accounts for tracking expenses separately across different banks, wallets, or credit cards.
            </p>

            {(activeLedger.accounts || []).length === 0 && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '12px',
                background: 'rgba(234, 179, 8, 0.12)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                color: 'var(--text)',
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Icon name="warning" style={{ color: 'var(--amber)' }} />
                <span><strong>Account Setup Required:</strong> Please create your first account (e.g. Salary, Savings, Cash) below.</span>
              </div>
            )}

            {/* Quick Create Form */}
            <form onSubmit={(e) => {
              e.preventDefault();
              if (newManageAccName.trim()) {
                handleAddAccount(newManageAccName.trim(), 'checking', newManageAccCurrency);
                setNewManageAccName('');
              }
            }} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="New account name (e.g. Boubyan Salary)"
                value={newManageAccName}
                onChange={(e) => setNewManageAccName(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-glass)',
                  background: 'var(--field)',
                  color: 'var(--text)',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
              <select
                value={newManageAccCurrency}
                onChange={(e) => setNewManageAccCurrency(e.target.value as CurrencyCode)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-glass)',
                  background: 'var(--field)',
                  color: 'var(--text)',
                  fontSize: '13px',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="KWD">KWD</option>
                <option value="INR">INR</option>
              </select>
              <button type="submit" className="button button-primary" style={{ padding: '0 16px', minHeight: '36px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                + Add
              </button>
            </form>

            {/* Accounts List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto', marginTop: '4px' }}>
              {(activeLedger.accounts || []).length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                  No custom accounts created yet. Add your first account above!
                </div>
              ) : (
                (activeLedger.accounts || []).map((acc) => (
                <div key={acc.id} style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'var(--surface-muted)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13.5px' }}>{acc.name}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                      Custom Account • {acc.currency || dashboardCurrency}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="button button-soft"
                      onClick={() => handleEditAccount(acc)}
                      style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Icon name="edit" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      className="button button-soft danger"
                      onClick={() => handleDeleteAccount(acc.id)}
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )))}
            </div>
          </div>
        </div>
      )}

      {/* User Preferences Modal Popup */}
      {showUserPreferencesModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(7, 9, 12, 0.45)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10500,
          padding: '20px',
          animation: 'fade-in 0.25s ease'
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: '24px',
            padding: '28px 24px',
            maxWidth: '440px',
            width: '100%',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="eyebrow">Cloud Preference Settings</span>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>User Preferences</h2>
              </div>
              <button
                type="button"
                className="button button-soft"
                onClick={() => setShowUserPreferencesModal(false)}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                Close
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Set your preferred default categories, payment modes, and display filter. Saved directly to your cloud profile.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label className="field" htmlFor="prefExpenseCategorySelect">
                <span>Default Expense Category</span>
                <select
                  id="prefExpenseCategorySelect"
                  value={prefDefaultExpenseCategory}
                  onChange={(e) => setPrefDefaultExpenseCategory(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-glass)',
                    background: 'var(--field)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                >
                  {expenseCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </label>

              <label className="field" htmlFor="prefIncomeCategorySelect">
                <span>Default Income Category</span>
                <select
                  id="prefIncomeCategorySelect"
                  value={prefDefaultIncomeCategory}
                  onChange={(e) => setPrefDefaultIncomeCategory(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-glass)',
                    background: 'var(--field)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                >
                  {incomeCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </label>

              <label className="field" htmlFor="prefKwdAccountSelect">
                <span>Default Kuwait (KWD) Payment Mode</span>
                <select
                  id="prefKwdAccountSelect"
                  value={prefDefaultKwdPaymentMode}
                  onChange={(e) => setPrefDefaultKwdPaymentMode(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-glass)',
                    background: 'var(--field)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                >
                  <option value="KNET / Debit Card">KNET / Debit Card</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  {(activeLedger.accounts || []).filter(a => !a.currency || a.currency === 'KWD').map(acc => (
                    <option key={acc.id} value={acc.name}>{acc.name} (KWD)</option>
                  ))}
                </select>
              </label>

              <label className="field" htmlFor="prefInrAccountSelect">
                <span>Default India (INR) Payment Mode</span>
                <select
                  id="prefInrAccountSelect"
                  value={prefDefaultInrPaymentMode}
                  onChange={(e) => setPrefDefaultInrPaymentMode(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-glass)',
                    background: 'var(--field)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                >
                  <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="Net Banking">Net Banking</option>
                  <option value="Debit Card">Debit Card</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Cash">Cash</option>
                  {(activeLedger.accounts || []).filter(a => a.currency === 'INR').map(acc => (
                    <option key={acc.id} value={acc.name}>{acc.name} (INR)</option>
                  ))}
                </select>
              </label>

              <label className="field" htmlFor="prefDisplayAccountSelect">
                <span>Default Display Account (Filter)</span>
                <select
                  id="prefDisplayAccountSelect"
                  value={prefDefaultDisplayAccount}
                  onChange={(e) => setPrefDefaultDisplayAccount(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-glass)',
                    background: 'var(--field)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                >
                  <option value="all">All Accounts (Show Everything)</option>
                  {(activeLedger.accounts || []).map(acc => (
                    <option key={acc.id} value={acc.name}>{acc.name} ({acc.currency || 'KWD'})</option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="button button-soft"
                  onClick={() => setShowUserPreferencesModal(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={async () => {
                    if (activeUserId) {
                      const updatedPrefs = {
                        defaultExpenseCategory: prefDefaultExpenseCategory,
                        defaultIncomeCategory: prefDefaultIncomeCategory,
                        defaultKwdPaymentMode: prefDefaultKwdPaymentMode,
                        defaultInrPaymentMode: prefDefaultInrPaymentMode,
                        defaultDisplayAccount: prefDefaultDisplayAccount
                      };

                      setSelectedAccount(prefDefaultDisplayAccount);

                      try {
                        await dbService.saveUserPreferences(activeUserId, updatedPrefs);
                        setUsers((prev) =>
                          prev.map((u) => (u.id === activeUserId ? { ...u, userPreferences: updatedPrefs } : u))
                        );
                      } catch (e) {
                        console.error('DB save user preferences error:', e);
                        showCustomAlert('Cloud Save Error', 'Failed to save preferences to cloud database.', 'error');
                        return;
                      }

                      setShowUserPreferencesModal(false);
                      showCustomAlert(
                        'Preferences Saved to Cloud',
                        'Your default categories, payment modes, and display account filter have been saved directly to your cloud profile in Supabase.',
                        'success'
                      );
                    }
                  }}
                  style={{ flex: 1 }}
                >
                  Save Preferences
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Money Between Accounts Modal */}
      {showTransferModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(7, 9, 12, 0.45)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10500,
          padding: '20px',
          animation: 'fade-in 0.25s ease'
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: '24px',
            padding: '28px 24px',
            maxWidth: '440px',
            width: '100%',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="eyebrow">Internal Transfer</span>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Transfer Money</h2>
              </div>
              <button
                type="button"
                className="button button-soft"
                onClick={() => setShowTransferModal(false)}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                Close
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Transfer funds between your checking, savings, credit cards, or custom accounts.
            </p>
            {(() => {
              const currentFromAccName = transferFromAccount || activeLedger.accounts?.[0]?.name || '';
              const currentToAccName = transferToAccount || activeLedger.accounts?.[1]?.name || activeLedger.accounts?.[0]?.name || '';

              const fromAccObj = (activeLedger.accounts || []).find(a => a.name === currentFromAccName);
              const toAccObj = (activeLedger.accounts || []).find(a => a.name === currentToAccName);

              const fromCurr: CurrencyCode = fromAccObj?.currency || 'KWD';
              const toCurr: CurrencyCode = toAccObj?.currency || 'INR';

              const isCrossCurrency = fromCurr !== toCurr;

              return (
                <form onSubmit={(e) => { e.preventDefault(); handleExecuteTransfer(); }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Account selection row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <label className="field">
                      <span>From Account</span>
                      <select
                        value={currentFromAccName}
                        onChange={(e) => {
                          setTransferFromAccount(e.target.value);
                          setTransferFromMode(e.target.value);
                        }}
                      >
                        {(activeLedger.accounts || []).length === 0 && (
                          <option value="">-- Select Account --</option>
                        )}
                        {(activeLedger.accounts || []).map(acc => (
                          <option key={acc.id} value={acc.name}>
                            {acc.name} ({acc.currency || 'KWD'})
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>To Account</span>
                      <select
                        value={currentToAccName}
                        onChange={(e) => {
                          setTransferToAccount(e.target.value);
                          setTransferToMode(e.target.value);
                        }}
                      >
                        {(activeLedger.accounts || []).length === 0 && (
                          <option value="">-- Select Account --</option>
                        )}
                        {(activeLedger.accounts || []).map(acc => (
                          <option key={acc.id} value={acc.name}>
                            {acc.name} ({acc.currency || 'KWD'})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Amounts row - single or cross currency */}
                  {!isCrossCurrency ? (
                    <label className="field">
                      <span>Amount ({fromCurr})</span>
                      <input
                        type="number"
                        step="any"
                        placeholder={fromCurr === 'KWD' ? '0.000' : '0.00'}
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        autoFocus
                        required
                      />
                    </label>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{
                        padding: '8px 12px',
                        borderRadius: '10px',
                        background: 'rgba(234, 179, 8, 0.12)',
                        border: '1px solid rgba(234, 179, 8, 0.3)',
                        color: 'var(--text)',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <Icon name="transfer" />
                        <span><strong>Cross-Currency Transfer ({fromCurr} ➔ {toCurr})</strong>: Specify debit in {fromCurr} & credit in {toCurr}.</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        <label className="field">
                          <span>Debit Amount ({fromCurr})</span>
                          <input
                            type="number"
                            step="any"
                            placeholder={fromCurr === 'KWD' ? '0.000' : '0.00'}
                            value={transferAmount}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTransferAmount(val);
                              const num = Number(val);
                              if (num > 0) {
                                const rateToUse = liveExchangeRate || (fromCurr === 'KWD' ? 273.5 : 0.00365);
                                setTransferDestAmount((num * rateToUse).toFixed(toCurr === 'INR' ? 2 : 3));
                              }
                            }}
                            autoFocus
                            required
                          />
                        </label>

                        <label className="field">
                          <span>Credit Amount ({toCurr})</span>
                          <input
                            type="number"
                            step="any"
                            placeholder={toCurr === 'INR' ? '0.00' : '0.000'}
                            value={transferDestAmount}
                            onChange={(e) => setTransferDestAmount(e.target.value)}
                            required
                          />
                        </label>
                      </div>

                      {Number(transferAmount) > 0 && Number(transferDestAmount) > 0 && (
                        <div style={{ fontSize: '11.5px', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 600 }}>
                            {liveExchangeRate ? `⚡ Live Exchange Rate: 1 ${fromCurr} = ${liveExchangeRate} ${toCurr}` : '⚡ Live Rate Loaded'}
                          </span>
                          <span>
                            Effective: 1 {fromCurr} = {(Number(transferDestAmount) / Number(transferAmount)).toFixed(4)} {toCurr}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <label className="field">
                    <span>Notes / Purpose (Optional)</span>
                    <input
                      type="text"
                      placeholder="e.g. India remittance, monthly savings"
                      value={transferNotes}
                      onChange={(e) => setTransferNotes(e.target.value)}
                    />
                  </label>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <button
                      type="button"
                      className="button button-soft"
                      onClick={() => setShowTransferModal(false)}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="button button-primary" style={{ flex: 1 }}>
                      Complete Transfer
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}

      {/* Base Currency Setup Modal */}
      {showBaseCurrencyPromptModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(7, 9, 12, 0.75)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 11000,
          padding: '20px',
          animation: 'fade-in 0.25s ease'
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: '24px',
            padding: '36px 28px',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0a4f70, #46a1c5)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 'bold',
              marginBottom: '20px'
            }}>
              💱
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text)' }}>
              Select Base Currency
            </h3>
            <p style={{ fontSize: '13.5px', color: 'var(--muted)', margin: '0 0 24px 0', lineHeight: 1.5 }}>
              Choose the primary currency for your ledger workspace and accounts.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
              <button
                type="button"
                className="button"
                onClick={() => handleSaveBaseCurrency('KWD')}
                style={{
                  padding: '14px',
                  background: 'linear-gradient(135deg, #0a4f70, #46a1c5)',
                  color: '#ffffff',
                  borderRadius: '14px',
                  fontWeight: 700,
                  fontSize: '15px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                KWD - Kuwaiti Dinar
              </button>
              <button
                type="button"
                className="button"
                onClick={() => handleSaveBaseCurrency('INR')}
                style={{
                  padding: '14px',
                  background: 'linear-gradient(135deg, #2080a8, #84cce4)',
                  color: '#ffffff',
                  borderRadius: '14px',
                  fontWeight: 700,
                  fontSize: '15px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                INR - Indian Rupee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Month-End Balance Rollover Modal */}
      <MonthRolloverModal
        isOpen={showMonthRolloverModal}
        onClose={() => setShowMonthRolloverModal(false)}
        onConfirmRollover={handleConfirmMonthRollover}
        onDismissMonth={handleDismissMonthRollover}
        currentMonthKey={month}
        transactions={activeLedger?.transactions || []}
        userAccounts={activeLedger?.accounts || []}
        defaultCurrency={dashboardCurrency}
      />
    </div>
  );
};
export default App;
