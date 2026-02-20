import { apiFetch } from '../../../lib/api';
import FunnelBar from '../../../components/FunnelBar';
import StatCard from '../../../components/StatCard';

export const dynamic = 'force-dynamic';

async function getEmployeeDetail(id) {
  try {
    return await apiFetch(`/analytics/employee/${id}`);
  } catch {
    return null;
  }
}

export default async function EmployeeDetailPage({ params }) {
  const { id } = params;
  const data = await getEmployeeDetail(id);

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">⚠️ Не удалось загрузить данные сотрудника</p>
      </div>
    );
  }

  // Convert funnel array to stages object
  const stages = {};
  (data.funnel || []).forEach((f) => {
    stages[f.stage] = f.count;
  });

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <a href="/employees" className="text-brand-500 hover:text-brand-600 text-sm">← Назад</a>
        <h1 className="text-2xl font-bold">Детали сотрудника</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Среднее время ответа"
          value={data.avgReplyHours ? `${data.avgReplyHours}ч` : 'N/A'}
          icon="⏱️"
          color="blue"
        />
        <StatCard
          title="Просроченных задач"
          value={data.overdueTasks.length}
          icon="⚠️"
          color={data.overdueTasks.length > 0 ? 'red' : 'green'}
        />
        <StatCard
          title="Дней с активностью (30д)"
          value={data.activityPerDay.length}
          icon="📈"
          color="purple"
        />
      </div>

      {/* Funnel */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Воронка</h2>
        <FunnelBar stages={stages} />
      </div>

      {/* Activity per day */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Активность за 30 дней</h2>
        {data.activityPerDay.length === 0 ? (
          <p className="text-gray-400 text-sm">Нет активности</p>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {data.activityPerDay.map((day) => {
              const maxCount = Math.max(...data.activityPerDay.map((d) => d.count));
              const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
              return (
                <div
                  key={day.date}
                  className="flex-1 bg-brand-500 rounded-t hover:bg-brand-600 transition-colors relative group"
                  style={{ height: `${Math.max(height, 4)}%` }}
                  title={`${day.date}: ${day.count} событий`}
                >
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {day.count}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Overdue tasks */}
      {data.overdueTasks.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 p-6">
          <h2 className="text-lg font-semibold mb-4 text-red-700">⚠️ Просроченные задачи</h2>
          <div className="space-y-2">
            {data.overdueTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div>
                  <span className="font-medium text-sm">{task.type}</span>
                  <span className="text-xs text-gray-500 ml-2">— {task.lead_name}</span>
                </div>
                <span className="text-xs text-red-600 font-medium">
                  {new Date(task.due_at).toLocaleDateString('ru-RU')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
