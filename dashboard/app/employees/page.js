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
          <p className="text-5xl mb-4">⚠️</p>
          <p className="text-gray-500 text-lg font-medium">Cannot load team data</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Team</h1>
        <p className="text-sm text-gray-500 mt-0.5">{data.employees.length} active members</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.employees.map((emp) => {
          const convRate = emp.invited > 0 ? ((emp.connected / emp.invited) * 100).toFixed(0) : 0;
          return (
            <Link key={emp.id} href={`/employees/${emp.id}`}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 text-white flex items-center justify-center font-bold text-sm">
                  {emp.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{emp.name}</div>
                  <div className="text-xs text-gray-400">{emp.email}</div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-2 text-center mb-3">
                <div>
                  <p className="text-lg font-bold text-gray-900">{emp.total_leads}</p>
                  <p className="text-[10px] text-gray-400 uppercase">Leads</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-600">{emp.connected}</p>
                  <p className="text-[10px] text-gray-400 uppercase">Connected</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-purple-600">{emp.replied}</p>
                  <p className="text-[10px] text-gray-400 uppercase">Replied</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-rose-600">{emp.meeting}</p>
                  <p className="text-[10px] text-gray-400 uppercase">Meetings</p>
                </div>
              </div>

              {/* Bottom row */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs">
                <div className="text-gray-500">
                  {convRate}% acceptance · {emp.total_events} events
                </div>
                {emp.overdue_tasks > 0 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
                    ⚠️ {emp.overdue_tasks} overdue
                  </span>
                ) : (
                  <span className="text-emerald-500 font-medium">✓ On track</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
