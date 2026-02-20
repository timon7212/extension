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
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">⚠️ Не удалось загрузить данные</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">👥 Сотрудники</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-3">Имя</th>
              <th className="px-6 py-3">Лидов</th>
              <th className="px-6 py-3">Invited</th>
              <th className="px-6 py-3">Connected</th>
              <th className="px-6 py-3">Messaged</th>
              <th className="px-6 py-3">Replied</th>
              <th className="px-6 py-3">Meeting</th>
              <th className="px-6 py-3">Событий</th>
              <th className="px-6 py-3">Просрочено</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium">{emp.name}</td>
                <td className="px-6 py-4">{emp.total_leads}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    {emp.invited}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    {emp.connected}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                    {emp.messaged}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                    {emp.replied}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    {emp.meeting}
                  </span>
                </td>
                <td className="px-6 py-4">{emp.total_events}</td>
                <td className="px-6 py-4">
                  {emp.overdue_tasks > 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      ⚠️ {emp.overdue_tasks}
                    </span>
                  ) : (
                    <span className="text-green-500 text-xs">✅ 0</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <Link
                    href={`/employees/${emp.id}`}
                    className="text-brand-500 hover:text-brand-600 text-xs font-semibold"
                  >
                    Подробнее →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
