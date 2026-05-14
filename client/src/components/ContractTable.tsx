import { Award } from '../types';

interface ContractTableProps {
  contracts: Award[];
  title?: string;
}

function formatMoney(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function competedBadge(extent?: string) {
  if (!extent) return null;
  const u = extent.toUpperCase();
  if (u.includes('NOT COMPETED') || u.includes('NOT AVAILABLE') || u.includes('ONLY ONE'))
    return <span className="text-xs mono bg-red-950 text-red-400 border border-red-800 rounded px-1.5 py-0.5">NO-BID</span>;
  if (u.includes('FULL'))
    return <span className="text-xs mono bg-green-950 text-green-400 border border-green-800 rounded px-1.5 py-0.5">COMPETED</span>;
  return <span className="text-xs mono bg-slate-800 text-slate-400 border border-slate-700 rounded px-1.5 py-0.5">{extent.slice(0, 20)}</span>;
}

export default function ContractTable({ contracts, title = 'Top Contracts' }: ContractTableProps) {
  if (!contracts || contracts.length === 0) return null;

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-dark-500">
        <h3 className="font-semibold text-white">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5">Sorted by award amount — from connected data</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-500 text-slate-500 text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3">Award ID</th>
              <th className="text-left px-4 py-3">Recipient</th>
              <th className="text-left px-4 py-3">Agency</th>
              <th className="text-right px-4 py-3">Amount</th>
              <th className="text-left px-4 py-3">Competition</th>
              <th className="text-left px-4 py-3">Date</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-500">
            {contracts.map((c, i) => (
              <tr key={c['Award ID'] || i} className="hover:bg-dark-600 transition-colors">
                <td className="px-5 py-3 font-mono text-xs text-slate-300 whitespace-nowrap">
                  {c['Award ID']}
                </td>
                <td className="px-4 py-3 text-slate-200 max-w-[180px] truncate">
                  {c['Recipient Name']}
                </td>
                <td className="px-4 py-3 text-slate-400 max-w-[160px] truncate">
                  {c['Awarding Agency']}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-white whitespace-nowrap">
                  {formatMoney(c['Award Amount'] || 0)}
                </td>
                <td className="px-4 py-3">
                  {competedBadge(c['Extent Competed'])}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                  {c['Start Date']}
                </td>
                <td className="px-4 py-3"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
