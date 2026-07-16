import React, { useState, useEffect } from 'react';
import type { User, UserLedger, CurrencyCode, Transaction, SavingsPot } from './types';
import {
  createEmptyBudgets,
  getCurrentMonthKey,
  getPreferredTheme,
  createId,
  hashPassword
} from './utils';
import { dbService } from './dbService';
import AuthScreen from './components/AuthScreen';
import Topbar from './components/Topbar';
import EntryPanel from './components/EntryPanel';
import DashboardView from './components/DashboardView';
import AdminView from './components/AdminView';
import ReportView from './components/ReportView';
import ProfileView from './components/ProfileView';

export const App: React.FC = () => {
  // Central App State
  const [users, setUsers] = useState<User[]>([]);
  const [userData, setUserData] = useState<Record<string, UserLedger>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'admin' | 'report' | 'profile'>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>(getPreferredTheme());
  const [month, setMonth] = useState<string>(getCurrentMonthKey());
  const [transactionCurrency, setTransactionCurrency] = useState<CurrencyCode>('KWD');
  const [dashboardCurrency, setDashboardCurrency] = useState<CurrencyCode>('KWD');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [sessionExpired, setSessionExpired] = useState<boolean>(false);

  // Custom premium dialog modal state
  const [modalState, setModalState] = useState<{
    show: boolean;
    title: string;
    description: string;
    type: 'alert' | 'confirm' | 'prompt' | 'export_selector';
    onConfirm: (val?: string) => void;
    onCancel?: () => void;
    tone?: 'success' | 'error' | 'warning' | 'info';
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

  const showCustomPrompt = (title: string, description: string, tone: 'info' | 'warning' = 'info') => {
    return new Promise<string | null>((resolve) => {
      setModalPromptInput('');
      setModalState({
        show: true,
        title,
        description,
        type: 'prompt',
        tone,
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
        const STORAGE_KEY_STR = "qashly-expense-tracker-v3";
        const raw = localStorage.getItem(STORAGE_KEY_STR);

        // Fetch users from database (Supabase / localStorage fallback)
        const dbUsers = await dbService.getUsers();
        setUsers(dbUsers);

        if (raw) {
          const saved = JSON.parse(raw);

          // Timeout check: 15 minutes (900,000 ms)
          const TIMEOUT_MS = 15 * 60 * 1000;
          const hasExpired = saved.lastActivity && (Date.now() - Number(saved.lastActivity) > TIMEOUT_MS);

          if (saved.currentUserId && !hasExpired) {
            setCurrentUserId(saved.currentUserId);
            setActiveUserId(saved.currentUserId);
            setLastActivity(Date.now());

            // Fetch the active user's ledger data on start
            const ledger = await dbService.getUserLedger(saved.currentUserId);
            setUserData({ [saved.currentUserId]: ledger });
          } else if (saved.currentUserId && hasExpired) {
            setSessionExpired(true);
          }

          if (saved.month) setMonth(saved.month);
          if (saved.theme) setTheme(saved.theme);
          if (saved.transactionCurrency) setTransactionCurrency(saved.transactionCurrency);
          if (saved.dashboardCurrency) setDashboardCurrency(saved.dashboardCurrency);
        }
      } catch (e) {
        console.error('Failed to load state', e);
      }
      setIsLoaded(true);
    };

    initLoad();
  }, []);

  // Save session state configurations to localStorage whenever they change
  useEffect(() => {
    if (!isLoaded) return;
    try {
      const STORAGE_KEY_STR = "qashly-expense-tracker-v3";
      const stateToSave = {
        currentUserId,
        month,
        theme,
        transactionCurrency,
        dashboardCurrency,
        lastActivity
      };
      localStorage.setItem(STORAGE_KEY_STR, JSON.stringify(stateToSave));
    } catch (e) {
      console.error('Failed to save state config', e);
    }
  }, [currentUserId, month, theme, transactionCurrency, dashboardCurrency, lastActivity, isLoaded]);

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
      // Throttle state writes to once every 2 seconds
      if (now - lastUpdate > 2000) {
        setLastActivity(now);
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
    ? userData[activeUserId] || { transactions: [], budgets: createEmptyBudgets(), savingsPots: [] } 
    : { transactions: [], budgets: createEmptyBudgets(), savingsPots: [] };

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

  const handleLogin = async (userId: string) => {
    try {
      const ledger = await dbService.getUserLedger(userId);
      setUserData((prev) => ({ ...prev, [userId]: ledger }));

      const dbUsers = await dbService.getUsers();
      setUsers(dbUsers);
      
      setCurrentUserId(userId);
      setActiveUserId(userId);
      setEditingTransaction(null);
      setCurrentView('dashboard');
      setLastActivity(Date.now());
      setSessionExpired(false);
    } catch (error) {
      console.error('Failed to load user ledger from database', error);
    }
  };

  const handleSignOut = () => {
    setCurrentUserId(null);
    setActiveUserId(null);
    setEditingTransaction(null);
    setCurrentView('dashboard');
  };

  const handleThemeToggle = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleOpenUserLedger = async (userId: string) => {
    try {
      const ledger = await dbService.getUserLedger(userId);
      setUserData((prev) => ({ ...prev, [userId]: ledger }));

      setActiveUserId(userId);
      setEditingTransaction(null);
      setCurrentView('dashboard');
    } catch (error) {
      console.error('Failed to fetch user ledger data', error);
    }
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

  const handleSubmitTransaction = async (txData: Omit<Transaction, 'id'> & { id?: string }) => {
    if (!activeUserId) return;

    const targetId = txData.id || createId();
    const finalTx: Transaction = {
      ...txData,
      id: targetId
    } as Transaction;

    try {
      await dbService.saveTransaction(activeUserId, finalTx);
      setUserData((prev) => {
        const userL = prev[activeUserId] || { transactions: [], budgets: createEmptyBudgets(), savingsPots: [] };
        let newTransactions = [...userL.transactions];

        if (txData.id) {
          newTransactions = newTransactions.map((t) => t.id === txData.id ? finalTx : t);
        } else {
          newTransactions.push(finalTx);
        }

        return {
          ...prev,
          [activeUserId]: {
            ...userL,
            transactions: newTransactions
          }
        };
      });

      // Update viewing months and currency
      const txMonth = txData.date.slice(0, 7);
      setMonth(txMonth);
      setTransactionCurrency(txData.currency);
      setDashboardCurrency(txData.currency);
      setEditingTransaction(null);
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
          />
          <main className={`workspace ${currentView !== 'dashboard' ? 'admin-mode' : ''}`}>
            {currentView === 'dashboard' && (
              <EntryPanel
                month={month}
                editingTransaction={editingTransaction}
                onCancelEdit={handleCancelEdit}
                onSubmit={handleSubmitTransaction}
                transactionCurrency={transactionCurrency}
                onTransactionCurrencyChange={setTransactionCurrency}
              />
            )}

            {currentView === 'dashboard' ? (
              <DashboardView
                monthTransactions={monthTransactions}
                budgets={activeLedger.budgets}
                savingsPots={activeLedger.savingsPots || []}
                dashboardCurrency={dashboardCurrency}
                onBudgetChange={handleBudgetChange}
                onEditTransaction={handleEditTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                onAddSavingsPot={handleAddSavingsPot}
                onDeleteSavingsPot={handleDeleteSavingsPot}
                onAdjustSavingsBalance={handleAdjustSavingsBalance}
                onBulkDeleteTransactions={handleBulkDeleteTransactions}
                onBulkUpdateTransactions={handleBulkUpdateTransactions}
                theme={theme}
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
                userData={userData}
                onOpenUserLedger={handleOpenUserLedger}
                onResetUserLedger={handleResetUserLedger}
                onCreateUser={handleCreateUser}
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
          zIndex: 10000,
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
              {modalState.tone === 'success' ? '✓' : modalState.tone === 'error' ? '!' : modalState.tone === 'warning' ? '⚠️' : 'i'}
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
                type="password"
                placeholder="Enter password"
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
    </div>
  );
};
export default App;
