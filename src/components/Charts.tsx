import React, { useEffect, useRef, useState } from 'react';
import type { Transaction, CurrencyCode } from '../types';
import { categoryColors, formatMoney } from '../utils';

interface ChartsProps {
  transactions: Transaction[];
  dashboardCurrency: CurrencyCode;
  theme: 'light' | 'dark';
}

interface CategoryTotal {
  category: string;
  total: number;
}

export const Charts: React.FC<ChartsProps> = ({ transactions, dashboardCurrency, theme }) => {
  const categoryCanvasRef = useRef<HTMLCanvasElement>(null);
  const cashflowCanvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // Group transactions for category doughnut chart
  const activeExpenses = transactions.filter(
    (t) => t.type === 'expense' && t.currency === dashboardCurrency
  );
  const totalsMap = new Map<string, number>();
  activeExpenses.forEach((t) => {
    totalsMap.set(t.category, (totalsMap.get(t.category) || 0) + t.amount);
  });
  const spendingByCategory: CategoryTotal[] = [...totalsMap.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  const topCategoryItem = spendingByCategory[0];
  const topCategoryLabel = topCategoryItem
    ? `${topCategoryItem.category}: ${formatMoney(topCategoryItem.total, dashboardCurrency)}`
    : `${dashboardCurrency}: no spend`;

  // Draw charts
  useEffect(() => {
    const drawAll = () => {
      drawCategoryChart();
      drawCashflowChart();
    };

    drawAll();

    // Resize listener with debounce
    let resizeTimer: any;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        drawAll();
      }, 120);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [transactions, dashboardCurrency, theme, hoveredCategory]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = categoryCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = Math.min(height * 0.48, 118);
    const radius = Math.min(width, height) * 0.38;
    const innerRadius = radius * 0.70;

    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < innerRadius || distance > radius) {
      setHoveredCategory(null);
      return;
    }

    let angle = Math.atan2(dy, dx);
    if (angle < -Math.PI / 2) {
      angle += Math.PI * 2;
    }

    const total = spendingByCategory.reduce((sum, item) => sum + item.total, 0);
    if (total === 0) {
      setHoveredCategory(null);
      return;
    }

    let currentStartAngle = -Math.PI / 2;
    let foundCategory: string | null = null;

    for (const item of spendingByCategory) {
      const sliceAngle = (item.total / total) * Math.PI * 2;
      const currentEndAngle = currentStartAngle + sliceAngle;
      if (angle >= currentStartAngle && angle < currentEndAngle) {
        foundCategory = item.category;
        break;
      }
      currentStartAngle = currentEndAngle;
    }

    setHoveredCategory(foundCategory);
  };

  const handleCanvasMouseLeave = () => {
    setHoveredCategory(null);
  };

  // Direct theme colors configuration for contrast safety
  const getThemeColors = () => {
    if (theme === 'dark') {
      return {
        text: '#edf3f7',
        muted: '#8897a6',
        surface: '#12181f', // Frosted dark card color
        border: '#222e3a',
        chartEmpty: '#222d3a',
        green: '#45b99f',
        red: '#ef775f',
      };
    } else {
      return {
        text: '#18212a',
        muted: '#66727f',
        surface: '#ffffff', // Light card color
        border: '#d9e0e6',
        chartEmpty: '#d9e0e6',
        green: '#187268',
        red: '#c4492d',
      };
    }
  };

  const prepareCanvas = (canvas: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(280, Math.round(rect.width));
    const height = Math.max(200, Math.round(rect.height));
    const scaledWidth = Math.round(width * dpr);
    const scaledHeight = Math.round(height * dpr);

    if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
    }

    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width, height };
  };

  const roundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) => {
    const safeHeight = Math.max(height, 2);
    const safeY = height <= 0 ? y - 2 : y;
    const r = Math.min(radius, Math.abs(width) / 2, safeHeight / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, safeY);
    ctx.lineTo(x + width - r, safeY);
    ctx.quadraticCurveTo(x + width, safeY, x + width, safeY + r);
    ctx.lineTo(x + width, safeY + safeHeight - r);
    ctx.quadraticCurveTo(x + width, safeY + safeHeight, x + width - r, safeY + safeHeight);
    ctx.lineTo(x + r, safeY + safeHeight);
    ctx.quadraticCurveTo(x, safeY + safeHeight, x, safeY + safeHeight - r);
    ctx.lineTo(x, safeY + r);
    ctx.quadraticCurveTo(x, safeY, x + r, safeY);
  };

  const drawCenteredText = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string,
    color: string,
    size: number,
    weight: number
  ) => {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  };

  const drawLegendChip = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    label: string,
    textColor: string
  ) => {
    ctx.fillStyle = color;
    roundRect(ctx, x, y, 10, 10, 3);
    ctx.fill();
    ctx.fillStyle = textColor;
    ctx.font = '700 12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 16, y + 5);
  };

  // Spending mix doughnut chart
  const drawCategoryChart = () => {
    const canvas = categoryCanvasRef.current;
    if (!canvas) return;

    const { ctx, width, height } = prepareCanvas(canvas);
    const total = spendingByCategory.reduce((sum, item) => sum + item.total, 0);
    const centerX = width / 2;
    const centerY = Math.min(height * 0.48, 118);
    const radius = Math.min(width, height) * 0.38;
    const innerRadius = radius * 0.70;
    const colors = getThemeColors();

    ctx.clearRect(0, 0, width, height);

    if (!total) {
      ctx.strokeStyle = colors.chartEmpty;
      ctx.lineWidth = Math.max(22, radius - innerRadius);
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.stroke();
      drawCenteredText(ctx, centerX, centerY - 6, 'No spending', colors.text, 14, 700);
      drawCenteredText(ctx, centerX, centerY + 12, dashboardCurrency, colors.muted, 11, 600);
      return;
    }

    let start = -Math.PI / 2;
    spendingByCategory.forEach((item) => {
      const slice = (item.total / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, start, start + slice);
      ctx.closePath();
      ctx.fillStyle = categoryColors[item.category] || categoryColors.Other || '#66727f';
      ctx.fill();
      start += slice;
    });

    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = colors.surface;
    ctx.fill();

    if (hoveredCategory) {
      const spentForHovered = totalsMap.get(hoveredCategory) || 0;
      drawCenteredText(ctx, centerX, centerY - 6, hoveredCategory, colors.text, 14, 800);
      drawCenteredText(ctx, centerX, centerY + 12, formatMoney(spentForHovered, dashboardCurrency), colors.muted, 11, 700);
    } else {
      drawCenteredText(ctx, centerX, centerY - 6, formatMoney(total, dashboardCurrency), colors.text, 15, 800);
      drawCenteredText(ctx, centerX, centerY + 12, 'spent', colors.muted, 11, 600);
    }
  };

  // Calculate weekly cashflow
  const getWeeklyCashflow = () => {
    // Infer year and month
    const currentMonthKey = transactions.length > 0 ? transactions[0].date.slice(0, 7) : new Date().toISOString().slice(0, 7);
    const [year, month] = currentMonthKey.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const weekCount = Math.ceil(daysInMonth / 7);
    const weeks = Array.from({ length: weekCount }, (_, index) => {
      const start = index * 7 + 1;
      const end = Math.min(start + 6, daysInMonth);
      return { label: `${start}-${end}`, income: 0, expense: 0 };
    });

    const activeMonthTransactions = transactions.filter((t) => t.currency === dashboardCurrency);

    activeMonthTransactions.forEach((transaction) => {
      const day = Number(transaction.date.slice(8, 10));
      const index = Math.min(Math.floor((day - 1) / 7), weeks.length - 1);
      if (transaction.type === 'income') {
        weeks[index].income += transaction.amount;
      } else {
        weeks[index].expense += transaction.amount;
      }
    });

    return weeks;
  };

  // Weekly cashflow bar chart
  const drawCashflowChart = () => {
    const canvas = cashflowCanvasRef.current;
    if (!canvas) return;

    const { ctx, width, height } = prepareCanvas(canvas);
    const weeks = getWeeklyCashflow();
    const maxValue = Math.max(1, ...weeks.flatMap((week) => [week.income, week.expense]));
    const padding = { top: 20, right: 12, bottom: 42, left: 88 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const baseline = padding.top + chartHeight;
    const groupWidth = chartWidth / weeks.length;
    const barWidth = Math.min(24, groupWidth * 0.26);
    const colors = getThemeColors();

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(padding.left, baseline);
    ctx.lineTo(width - padding.right, baseline);
    ctx.stroke();

    ctx.fillStyle = colors.muted;
    ctx.font = '700 12px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(formatMoney(maxValue, dashboardCurrency), padding.left - 8, padding.top + 8);
    ctx.fillText(formatMoney(0, dashboardCurrency), padding.left - 8, baseline + 4);

    weeks.forEach((week, index) => {
      const center = padding.left + groupWidth * index + groupWidth / 2;
      const incomeHeight = (week.income / maxValue) * chartHeight;
      const expenseHeight = (week.expense / maxValue) * chartHeight;

      if (week.income > 0) {
        ctx.fillStyle = colors.green;
        roundRect(ctx, center - barWidth - 3, baseline - incomeHeight, barWidth, incomeHeight, 4);
        ctx.fill();
      }

      if (week.expense > 0) {
        ctx.fillStyle = colors.red;
        roundRect(ctx, center + 3, baseline - expenseHeight, barWidth, expenseHeight, 4);
        ctx.fill();
      }

      ctx.fillStyle = colors.muted;
      ctx.font = '700 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(week.label, center, height - 14);
    });

    drawLegendChip(ctx, padding.left, 14, colors.green, 'Income', colors.muted);
    drawLegendChip(ctx, padding.left + 82, 14, colors.red, 'Expense', colors.muted);
  };

  const netFlow = transactions
    .filter((t) => t.currency === dashboardCurrency)
    .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);

  return (
    <>
      <section className="panel chart-panel" aria-label="Spending by category">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Categories</span>
            <h2>Spending mix</h2>
          </div>
          <span className="panel-total" id="topCategory">{topCategoryLabel}</span>
        </div>
        <canvas 
          ref={categoryCanvasRef} 
          width="640" 
          height="320" 
          aria-label="Spending mix chart"
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
        ></canvas>
        <div id="categoryLegend" className="legend">
          {spendingByCategory.map((item) => (
            <span key={item.category} className="legend-item">
              <span
                className="swatch"
                style={{ background: categoryColors[item.category] || categoryColors.Other || '#66727f' }}
              ></span>
              <span>{`${item.category} ${formatMoney(item.total, dashboardCurrency)}`}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="panel chart-panel" aria-label="Monthly cashflow">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Cashflow</span>
            <h2>Month view</h2>
          </div>
          <span className="panel-total" id="netFlow">{`${formatMoney(netFlow, dashboardCurrency)} net`}</span>
        </div>
        <canvas ref={cashflowCanvasRef} width="640" height="320" aria-label="Cashflow chart"></canvas>
      </section>
    </>
  );
};
export default Charts;
