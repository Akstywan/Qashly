import React from 'react';
import type { Transaction, Budgets, CurrencyCode } from '../types';
import { formatMoney, expenseCategories } from '../utils';
import Icon from './Icon';

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

  const rows = allCategories.map((cat) => {
    const limit = activeBudgets[cat] || 0;
    const spent = spendingMap.get(cat) || 0;
    const difference = limit - spent;
    const percentUsed = limit > 0 ? (spent / limit) * 100 : 0;

    totalBudget += limit;
    totalSpent += spent;

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

    if (netVariance > 0) {
      insights.push(`Great job! You spent ${formatMoney(netVariance, dashboardCurrency)} less than your overall budget this month.`);
    } else if (netVariance < 0) {
      insights.push(`Attention: You exceeded your overall budget limit by ${formatMoney(Math.abs(netVariance), dashboardCurrency)}.`);
    } else {
      insights.push(`Balanced month: Your total expenses exactly matched your budget limits.`);
    }

    if (overBudgetCats.length > 0) {
      const list = overBudgetCats.map((c) => `${c.category} (exceeded by ${formatMoney(Math.abs(c.difference), dashboardCurrency)})`).join(', ');
      insights.push(`Deficit Warning: You went over budget in these categories: ${list}.`);
    }

    if (savedCats.length > 0) {
      const topSavings = [...savedCats].sort((a, b) => b.difference - a.difference)[0];
      insights.push(`Top Savings: You had the largest surplus in "${topSavings.category}", saving ${formatMoney(topSavings.difference, dashboardCurrency)} of the allocated limit.`);
    }

    if (unbudgetedCats.length > 0) {
      const totalUnbudgeted = unbudgetedCats.reduce((sum, r) => sum + r.spent, 0);
      insights.push(`Unbudgeted Activity: You spent a total of ${formatMoney(totalUnbudgeted, dashboardCurrency)} across categories that did not have budget caps configured (${unbudgetedCats.map(c => c.category).slice(0, 3).join(', ')}).`);
    }

    return insights;
  };

  const commentary = generateCommentary();

  return (
    <div className="report-view-container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '16px 0' }}>
      
      {/* Responsive Overview KPI Metric Cards */}
      <div className="report-metrics-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <article className="metric">
          <div className="metric-top">
            <span className="metric-title" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>Total Budget Limit</span>
            <div className="metric-icon" style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--blue-soft)', color: 'var(--blue-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="pie-chart" />
            </div>
          </div>
          <strong className="metric-value" style={{ fontSize: '24px', fontWeight: 800, margin: '6px 0 2px', color: 'var(--text)' }}>
            {formatMoney(totalBudget, dashboardCurrency)}
          </strong>
          <span className="metric-sub" style={{ fontSize: '11.5px', color: 'var(--muted)' }}>Allocated limits</span>
        </article>

        <article className="metric">
          <div className="metric-top">
            <span className="metric-title" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>Actual Expenses</span>
            <div className="metric-icon" style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--amber-soft)', color: 'var(--amber-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="wallet" />
            </div>
          </div>
          <strong className="metric-value" style={{ fontSize: '24px', fontWeight: 800, margin: '6px 0 2px', color: 'var(--text)' }}>
            {formatMoney(totalSpent, dashboardCurrency)}
          </strong>
          <span className="metric-sub" style={{ fontSize: '11.5px', color: 'var(--muted)' }}>{activeMonthExpenses.length} expense records</span>
        </article>

        <article className="metric">
          <div className="metric-top">
            <span className="metric-title" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>Variance (Difference)</span>
            <div className="metric-icon" style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: isOverallOver ? 'var(--red-soft)' : 'var(--green-soft)',
              color: isOverallOver ? 'var(--red-text)' : 'var(--green-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="trending-up" />
            </div>
          </div>
          <strong className="metric-value" style={{
            fontSize: '24px',
            fontWeight: 800,
            margin: '6px 0 2px',
            color: isOverallOver ? 'var(--red-text)' : 'var(--green-text)'
          }}>
            {isOverallOver ? '-' : '+'}{formatMoney(Math.abs(netVariance), dashboardCurrency)}
          </strong>
          <span className="metric-sub" style={{ fontSize: '11.5px', fontWeight: 700, color: isOverallOver ? 'var(--red-text)' : 'var(--green-text)' }}>
            {isOverallOver ? 'Over budget limit' : 'Surplus remaining'}
          </span>
        </article>
      </div>

      {/* Analytical Commentary Insights */}
      <section className="panel" style={{ padding: '20px', marginBottom: '20px' }} aria-label="Commentary Insights">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <div className="metric-icon" style={{ width: '28px', height: '28px', fontSize: '13px', background: 'var(--blue-soft)', color: 'var(--blue-text)' }}>
            <Icon name="sparkles" />
          </div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Commentary Insights</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {commentary.map((text, idx) => (
            <div key={idx} style={{
              fontSize: '13px',
              lineHeight: '1.5',
              color: 'var(--text)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-muted)',
              border: '1px solid var(--border-glass)',
              boxShadow: 'var(--clay-inset)'
            }}>
              {text}
            </div>
          ))}
        </div>
      </section>

      {/* Difference Analysis Table */}
      <section className="panel" aria-label="Detailed Analysis Table" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="panel-heading" style={{ padding: '18px 20px', margin: 0, borderBottom: '1px solid var(--border-glass)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="metric-icon" style={{ width: '32px', height: '32px', fontSize: '14px', background: 'var(--green-soft)', color: 'var(--green-text)' }}>
              <Icon name="chart" />
            </div>
            <h2 style={{ fontSize: '16px', margin: 0 }}>Variance Analysis Table</h2>
          </div>
          <span className="panel-total">{dashboardCurrency} analysis</span>
        </div>

        <div className="table-wrap" style={{ overflowX: 'auto', width: '100%' }}>
          <table className="register-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '550px' }}>
            <thead>
              <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-glass)' }}>
                <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>Category</th>
                <th style={{ padding: '12px 18px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>Budget Limit</th>
                <th style={{ padding: '12px 18px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>Actual Spent</th>
                <th style={{ padding: '12px 18px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>Variance</th>
                <th style={{ padding: '12px 18px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const diffIsNegative = row.difference < 0;
                
                return (
                  <tr key={row.category} style={{ borderBottom: '1px solid var(--border-glass)' }} className="table-row-hover">
                    <td style={{ padding: '12px 18px', fontWeight: 600, fontSize: '13px' }}>{row.category}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'right', fontSize: '13px' }}>
                      {row.limit > 0 ? formatMoney(row.limit, dashboardCurrency) : '—'}
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>
                      {row.spent > 0 ? formatMoney(row.spent, dashboardCurrency) : '—'}
                    </td>
                    <td style={{ 
                      padding: '12px 18px', 
                      textAlign: 'right', 
                      fontSize: '13px',
                      fontWeight: 700,
                      color: row.limit === 0 ? 'var(--muted)' : diffIsNegative ? 'var(--red-text)' : 'var(--green-text)'
                    }}>
                      {row.limit === 0 
                        ? '—'
                        : `${diffIsNegative ? '-' : '+'}${formatMoney(Math.abs(row.difference), dashboardCurrency)}`
                      }
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '12px',
                        display: 'inline-block',
                        background: 
                          row.statusClass === 'green' ? 'var(--green-soft)' : 
                          row.statusClass === 'red' ? 'var(--red-soft)' : 
                          row.statusClass === 'amber' ? 'var(--amber-soft)' : 
                          'var(--surface-muted)',
                        color: 
                          row.statusClass === 'green' ? 'var(--green-text)' : 
                          row.statusClass === 'red' ? 'var(--red-text)' : 
                          row.statusClass === 'amber' ? 'var(--amber-text)' : 
                          'var(--text-secondary)'
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
