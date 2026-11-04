import React from 'react';
import { Users, UserCheck, UserX, Shield, Key } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const EmployeeManagementCard: React.FC = () => {
  const { employees, toggleEmployeeStatus } = useStore();

  return (
    <div className="bg-white p-5 rounded-xl border border-[#E2DED6] shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#1B2A5C]" />
          <div>
            <h3 className="font-bold text-base text-[#1B2A5C]">
              Manajemen Akun & PIN Karyawan
            </h3>
            <p className="text-xs text-[#6B7280]">
              Pemilik dapat mengaktifkan atau menonaktifkan akses akun kasir kapan saja.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {employees.map((emp) => (
          <div
            key={emp.id}
            className={`p-4 rounded-xl border transition-all ${
              emp.isActive
                ? 'bg-white border-[#E2DED6]'
                : 'bg-gray-50 border-gray-200 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold text-sm text-[#1F2937]">{emp.name}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                      emp.role === 'pemilik'
                        ? 'bg-[#1B2A5C] text-white'
                        : 'bg-[#1B2A5C]/10 text-[#1B2A5C]'
                    }`}
                  >
                    {emp.role === 'pemilik' ? 'Pemilik Outlet' : 'Kasir / Karyawan'}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      emp.isActive
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-[#FCE8E9] text-[#D7262E]'
                    }`}
                  >
                    {emp.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-[#E2DED6] flex items-center justify-between text-xs">
              <div className="flex items-center gap-1 text-[#6B7280]">
                <Key className="w-3.5 h-3.5 text-[#1B2A5C]" />
                <span>PIN:</span>
                <span className="font-mono font-bold text-[#1B2A5C] tabular-nums">
                  {emp.pin}
                </span>
              </div>

              {emp.role !== 'pemilik' && (
                <button
                  type="button"
                  onClick={() => toggleEmployeeStatus(emp.id, !emp.isActive)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1 ${
                    emp.isActive
                      ? 'bg-[#FCE8E9] text-[#D7262E] hover:bg-red-200'
                      : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  }`}
                >
                  {emp.isActive ? (
                    <>
                      <UserX className="w-3.5 h-3.5" />
                      <span>Nonaktifkan</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Aktifkan</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
