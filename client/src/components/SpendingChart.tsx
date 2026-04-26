import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { SpendingOverTime } from '../types';

interface SpendingChartProps {
  data: SpendingOverTime[];
  title?: string;
}

function formatTick(value: number) {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-600 border border-dark-500 rounded-lg px-4 py-3 shadow-xl">
      <p className="text-slate-400 text-xs mb-1">FY {label}</p>
      <p className="text-white font-bold mono">{formatTick(payload[0].value)}</p>
    </div>
  );
}

export default function SpendingChart({ data, title = 'Spending Over Time' }: SpendingChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="card px-5 py-8 text-center text-slate-500 text-sm">
        No historical spending data available.
      </div>
    );
  }

  const chartData = data.map((d) => ({ year: d.fiscalYear, amount: d.amount }));

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2d40" />
          <XAxis
            dataKey="year"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={{ stroke: '#1f2d40' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatTick}
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={68}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#spendGrad)"
            dot={{ fill: '#3b82f6', r: 3 }}
            activeDot={{ r: 5, fill: '#60a5fa' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
