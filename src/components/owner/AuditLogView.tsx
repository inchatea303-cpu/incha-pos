import React from 'react';
import { ScrollText, ShieldCheck } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatDateWIB } from '../../utils/calculations';

export const AuditLogView: React.FC = () => {
  const { auditLogs } = useStore();

  return (
    <div className="bg-white rounded-xl border border-[#E2DED6] shadow-sm overflow-hidden">
      <div className="p-5 border-b border-[#E2DED6] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-[#1B2A5C]" />
          <div>
            <h3 className="font-bold text-base text-[#1B2A5C]">Audit Log & Jejak Perubahan</h3>
            <p className="text-xs text-[#6B7280]">
              Pencatatan real-time seluruh aktivitas penting (perubahan harga, restock, void, login/logout)
            </p>
          </div>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-[#1B2A5C]/10 text-[#1B2A5C] font-semibold tabular-nums">
          {auditLogs.length} Catatan
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#FAF8F4] text-[#1B2A5C] uppercase font-semibold border-b border-[#E2DED6]">
            <tr>
              <th className="py-3 px-4">Waktu (WIB)</th>
              <th className="py-3 px-4">Pelaku</th>
              <th className="py-3 px-4">Aktivitas</th>
              <th className="py-3 px-4">Rincian Perubahan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2DED6]">
            {auditLogs.map((log) => (
              <tr key={log.id} className="hover:bg-[#FAF8F4]/50">
                <td className="py-3 px-4 text-[#6B7280] tabular-nums whitespace-nowrap">
                  {formatDateWIB(log.timestamp)}
                </td>
                <td className="py-3 px-4 font-semibold text-[#1F2937] whitespace-nowrap">
                  {log.actor}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1B2A5C]/10 text-[#1B2A5C]">
                    {log.action}
                  </span>
                </td>
                <td className="py-3 px-4 text-[#1F2937] leading-relaxed">
                  {log.details}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
