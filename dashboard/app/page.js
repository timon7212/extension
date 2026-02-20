import { apiFetch } from '../lib/api';
import StatCard from '../components/StatCard';
import FunnelBar from '../components/FunnelBar';

export const dynamic = 'force-dynamic';

async function getOverview() {
  try {
    return await apiFetch('/analytics/overview');
  } catch {
    return null;
  }
}

export default async function OverviewPage() {
  const data = await getOverview();

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">⚠️ Не удалось загрузить данные</p>
        <p className="text-gray-300 text-sm mt-2">Убедитесь, что backend запущен на порту 3001</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">📊 Обзор пайплайна</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          title="Всего лидов"
          value={data.totalLeads}
          icon="🎯"
          color="blue"
        />
        <StatCard
          title="Acceptance Rate"
          value={`${data.acceptanceRate}%`}
          subtitle="Connected / Invites"
          icon="🤝"
          color="green"
        />
        <StatCard
          title="Reply Rate"
          value={`${data.replyRate}%`}
          subtitle="Replies / Messages"
          icon="💬"
          color="orange"
        />
        <StatCard
          title="Встречи"
          value={data.meetings}
          icon="📅"
          color="purple"
        />
        <StatCard
          title="Просроченные задачи"
          value={data.overdueTasks}
          icon="⚠️"
          color={data.overdueTasks > 0 ? 'red' : 'gray'}
        />
      </div>

      {/* Funnel */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Воронка</h2>
        <FunnelBar stages={data.stages} />
      </div>

      {/* Events breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Все события</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(data.events || {}).map(([type, count]) => (
            <div key={type} className="text-center p-3 rounded-lg bg-gray-50">
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs text-gray-500 mt-1">{type.replace(/_/g, ' ')}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
