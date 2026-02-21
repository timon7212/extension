import { apiFetch } from '../../lib/api';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getEmployees() {
  try {
    return await apiFetch('/analytics/employees');
  } catch {
    return null;
  }
}

export default async function EmployeesPage() {
  const data = await getEmployees();

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center text-3xl">⚠️</div>
          <p className="text-gray-500 text-lg font-medium">Cannot load team data</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[22px] font-bold text-gray-900">Team</h1>
        <p className="text-sm text-gray-400 mt-0.5">{data.employees.length} active members</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {data.employees.map((emp) => {
          const convRate = emp.invited > 0 ? ((emp.connected / emp.invited) * 100).toFixed(0) : 0;
          return (
            <Link key={emp.id} href={`/employees/${emp.id}`}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:border-[#6c5ce7]/30 hover:shadow-md transition-all group">
              {/* Avatar + Name */}
              <div className="flex items-center gap-3.5 mb-5">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#6c5ce7] to-[#a29bfe] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  {emp.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-gray-800 group-hover:text-[#6c5ce7] transition-colors text-[14px]">{emp.name}</div>
                  <div className="text-[11px] text-gray-400">{emp.email}</div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-2 text-center mb-4">
                <StatMini label="Leads" value={emp.total_leads} />
                <StatMini label="Connected" value={emp.connected} color="text-[#00b894]" />
                <StatMini label="Replied" value={emp.replied} color="text-[#6c5ce7]" />
                <StatMini label="Meetings" value={emp.meeting} color="text-[#e17055]" />
              </div>

              {/* Bottom row */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-50 text-[11px]">
                <div className="text-gray-400">
                  {convRate}% accept · {emp.total_events} events
                </div>
                {emp.overdue_tasks > 0 ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-red-50 text-[#d63031] font-semibold">
                    ⚠️ {emp.overdue_tasks} overdue
                  </span>
                ) : (
                  <span className="text-[#00b894] font-semibold">✓ On track</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function StatMini({ label, value, color }) {
  return (
    <div>
      <p className={`text-lg font-bold ${color || 'text-gray-800'}`}>{value}</p>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
    </div>
  );
}
