import React from 'react';
import type { Transaction, Budgets, CurrencyCode } from '../types';
import { formatMoney, expenseCategories } from '../utils';

interface ReportViewProps {
  monthTransactions: Transaction[];
  budgets: Budgets;
  dashboardCurrency: CurrencyCode;
}

export const ReportView: React.FC<ReportViewProps> = ({
  monthTransactions,
  budgets,
  dashboardCurrency,
}) => {
  // 1. Calculate actual spending by category for the current month
  const spendingMap = new Map<string, number>();
  const activeMonthExpenses = monthTransactions.filter(
    (t) => t.type === 'expense' && t.currency === dashboardCurrency
  );

  activeMonthExpenses.forEach((t) => {
    spendingMap.set(t.category, (spendingMap.get(t.category) || 0) + t.amount);
  });

  // 2. Prepare report rows combining budgeted categories and any unbudgeted spend
  const activeBudgets = budgets[dashboardCurrency] || {};
  
  // Combine all categories that have a budget OR have spending
  const allCategories = Array.from(
    new Set([
      ...expenseCategories,
      ...Array.from(spendingMap.keys())
    ])
  ).sort();

  let totalBudget = 0;
  let totalSpent = 0;
  let totalBudgetedSpent = 0; // spent on categories with active budgets

  const rows = allCategories.map((cat) => {
    const limit = activeBudgets[cat] || 0;
    const spent = spendingMap.get(cat) || 0;
    const difference = limit - spent;
    const percentUsed = limit > 0 ? (spent / limit) * 100 : 0;

    totalBudget += limit;
    totalSpent += spent;
    if (limit > 0) {
      totalBudgetedSpent += spent;
    }

    let statusText = 'No Budget';
    let statusClass = 'muted';

    if (limit > 0) {
      if (difference > 0) {
        statusText = 'Under Budget';
        statusClass = 'green';
      } else if (difference < 0) {
        statusText = 'Over Budget';
        statusClass = 'red';
      } else {
        statusText = 'On Target';
        statusClass = 'green';
      }
    } else if (spent > 0) {
      statusText = 'Unbudgeted Spend';
      statusClass = 'amber';
    }

    return {
      category: cat,
      limit,
      spent,
      difference,
      percentUsed,
      statusText,
      statusClass,
    };
  });

  const netVariance = totalBudget - totalSpent;
  const isOverallOver = netVariance < 0;

  // 3. Generate Analytical Commentary Insights
  const generateCommentary = () => {
    const insights: string[] = [];
    const overBudgetCats = rows.filter((r) => r.limit > 0 && r.difference < 0);
    const savedCats = rows.filter((r) => r.limit > 0 && r.difference > 0);
    const unbudgetedCats = rows.filter((r) => r.limit === 0 && r.spent > 0);

    if (totalBudget === 0) {
      return ["You haven't set any budget limits for this month yet. Configure limits on the dashboard to enable comparison analysis."];
    }

    // Overall summary statement
    if (netVariance > 0) {
      insights.push(`🎉 Great job! You spent ${formatMoney(netVariance, dashboardCurrency)} less than your overall budget this month.`);
    } else if (netVariance < 0) {
      insights.push(`⚠️ Attention: You exceeded your overall budget limit by ${formatMoney(Math.abs(netVariance), dashboardCurrency)}.`);
    } else {
      insights.push(`🎯 Balanced month: Your total expenses exactly matched your budget limits.`);
    }

    // Deficit warning
    if (overBudgetCats.length > 0) {
      const list = overBudgetCats.map((c) => `${c.category} (exceeded by ${formatMoney(Math.abs(c.difference), dashboardCurrency)})`).join(', ');
      insights.push(`🔴 Deficit Warning: You went over budget in these categories: ${list}.`);
    }

    // Surplus callout
    if (savedCats.length > 0) {
      // Find category with largest savings
      const topSavings = [...savedCats].sort((a, b) => b.difference - a.difference)[0];
      insights.push(`🟢 Top Savings: You had the largest surplus in "${topSavings.category}", saving ${formatMoney(topSavings.difference, dashboardCurrency)} of the allocated limit.`);
    }

    // Unbudgeted spending warnings
    if (unbudgetedCats.length > 0) {
      const totalUnbudgeted = unbudgetedCats.reduce((sum, r) => sum + r.spent, 0);
      insights.push(`ℹ️ Unbudgeted Activity: You spent a total of ${formatMoney(totalUnbudgeted, dashboardCurrency)} across categories that did not have budget caps configured (such as ${unbudgetedCats.map(c => c.category).slice(0, 3).join(', ')}).`);
    }

    return insights;
  };

  const commentary = generateCommentary();

  return (
    <div className="dashboard-view" style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 0' }}>
      
      {/* Overview Cards Grid */}
      <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <article className="metric" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span>Total Budget Limit</span>
          <strong style={{ fontSize: '24px' }}>{formatMoney(totalBudget, dashboardCurrency)}</strong>
          <small>Allocated Limits</small>
        </article>
        
        <article className="metric" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span>Actual Expenses</span>
          <strong style={{ fontSize: '24px' }}>{formatMoney(totalSpent, dashboardCurrency)}</strong>
          <small>{activeMonthExpenses.length} expense records</small>
        </article>

        <article className="metric" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span>Variance (Difference)</span>
          <strong style={{ 
            fontSize: '24px', 
            color: isOverallOver ? 'var(--red)' : 'var(--green)' 
          }}>
            {isOverallOver ? '-' : '+'}{formatMoney(Math.abs(netVariance), dashboardCurrency)}
          </strong>
          <small style={{ color: isOverallOver ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>
            {isOverallOver ? 'Over budget limit' : 'Surplus remaining'}
          </small>
        </article>
      </div>

      {/* Analytical Commentary Insights */}
      <section className="panel" style={{ padding: '20px', marginBottom: '24px' }} aria-label="Commentary Insights">
        <h2 style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '12px' }}>
          Commentary Insights
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {commentary.map((text, idx) => (
            <p key={idx} style={{ 
              fontSize: '14px', 
              lineHeight: '1.5', 
              color: 'var(--text)', 
              margin: 0,
              padding: '8px 12px',
              borderRadius: '6px',
              background: 'var(--row-hover)',
              borderLeft: '4px solid var(--muted)'
            }}>
              {text}
            </p>
          ))}
        </div>
      </section>

      {/* Difference Analysis Table */}
      <section className="panel" aria-label="Detailed Analysis Table">
        <div className="panel-heading" style={{ padding: '20px 24px' }}>
          <div>
            <span className="eyebrow">Comparison</span>
            <h2>Variance Analysis Table</h2>
          </div>
          <span className="panel-total">{dashboardCurrency} analysis</span>
        </div>

        <div className="table-wrap">
          <table className="register-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <th style={{ padding: '16px 24px' }}>Category</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}>Budget Limit</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}>Actual Spent</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}>Difference (Variance)</th>
                <th style={{ padding: '16px 24px', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const diffIsNegative = row.difference < 0;
                
                return (
                  <tr key={row.category} style={{ borderBottom: '1px solid var(--border-glass)' }} className="table-row-hover">
                    <td data-label="Category" style={{ padding: '16px 24px', fontWeight: 600 }}>{row.category}</td>
                    <td data-label="Budget Limit" style={{ padding: '16px 24px', textAlign: 'right' }}>
                      {row.limit > 0 ? formatMoney(row.limit, dashboardCurrency) : '—'}
                    </td>
                    <td data-label="Actual Spent" style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 600 }}>
                      {row.spent > 0 ? formatMoney(row.spent, dashboardCurrency) : '—'}
                    </td>
                    <td data-label="Difference" style={{ 
                      padding: '16px 24px', 
                      textAlign: 'right', 
                      fontWeight: 700,
                      color: row.limit === 0 ? 'var(--text)' : diffIsNegative ? 'var(--red)' : 'var(--green)'
                    }}>
                      {row.limit === 0 
                        ? '—'
                        : `${diffIsNegative ? '-' : '+'}${formatMoney(Math.abs(row.difference), dashboardCurrency)}`
                      }
                    </td>
                    <td data-label="Status" style={{ padding: '16px 24px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '20px',
                        display: 'inline-block',
                        background: 
                          row.statusClass === 'green' ? 'rgba(24, 114, 104, 0.1)' : 
                          row.statusClass === 'red' ? 'rgba(196, 73, 45, 0.1)' : 
                          row.statusClass === 'amber' ? 'rgba(210, 154, 63, 0.1)' : 
                          'rgba(102, 114, 127, 0.1)',
                        color: 
                          row.statusClass === 'green' ? 'var(--green)' : 
                          row.statusClass === 'red' ? 'var(--red)' : 
                          row.statusClass === 'amber' ? 'var(--amber)' : 
                          'var(--muted)'
                      }}>
                        {row.statusText}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
export default ReportView;
