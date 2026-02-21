import { apiFetch } from '../../../lib/api';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getEmployeeDetail(id) {
  try {
    return await apiFetch(`/analytics/employee/${id}`);
  } catch {
    return null;
  }
}

export default async function EmployeeDetailPage({ params }) {
  const { id } = await params;
  const data = await getEmployeeDetail(id);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-5xl mb-4">⚠️</p>
          <p className="text-gray-500 text-lg font-medium">Could not load employee data</p>
        </div>
      </div>
    );
  }

  const stageOrder = ['New', 'Invited', 'Connected', 'Messaged', 'Replied', 'Meeting'];
  const stages = {};
  (data.funnel || []).forEach((f) => { stages[f.stage] = f.count; });
  const totalLeads = stageOrder.reduce((s, st) => s + (stages[st] || 0), 0);

  const EVENT_ICONS = {
    invite_sent: '📩', connected: '🤝', message_sent: '💬',
    reply_received: '📨', meeting_booked: '📅',
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/employees" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          ← Back to Team
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 text-white flex items-center justify-center font-bold text-2xl">
          {data.employee?.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{data.employee?.name || 'Unknown'}</h1>
          <p className="text-sm text-gray-500">{data.employee?.email} · {data.employee?.role}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Leads" value={totalLeads} />
        <KpiCard label="Avg Reply Time" value={data.avgReplyHours ? `${data.avgReplyHours}h` : 'N/A'} />
        <KpiCard label="Active Days (30d)" value={data.activityPerDay?.length || 0} />
        <KpiCard
          label="Overdue Tasks"
          value={data.tasks?.filter(t => t.status === 'open' && new Date(t.due_at) < new Date()).length || 0}
          alert
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Funnel */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Pipeline</h2>
          {totalLeads === 0 ? (
            <p className="text-sm text-gray-400">No leads yet</p>
          ) : (
            <>
              <div className="flex h-8 rounded-lg overflow-hidden mb-3">
                {stageOrder.map((stage) => {
                  const count = stages[stage] || 0;
                  if (count === 0) return null;
                  const pct = (count / totalLeads) * 100;
                  const colors = {
                    New: 'bg-gray-400', Invited: 'bg-blue-500', Connected: 'bg-emerald-500',
                    Messaged: 'bg-orange-500', Replied: 'bg-purple-500', Meeting: 'bg-rose-500',
                  };
                  return (
                    <div key={stage} className={`${colors[stage]} flex items-center justify-center text-xs font-bold text-white`}
                         style={{ width: `${pct}%` }} title={`${stage}: ${count}`}>
                      {pct > 10 ? count : ''}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                {stageOrder.map((s) => (
                  <span key={s}>{s}: <strong>{stages[s] || 0}</strong></span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Activity Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Activity (30 days)</h2>
          {(!data.activityPerDay || data.activityPerDay.length === 0) ? (
            <p className="text-sm text-gray-400">No activity</p>
          ) : (
            <div className="flex items-end gap-0.5 h-24">
              {data.activityPerDay.map((day) => {
                const maxCount = Math.max(...data.activityPerDay.map((d) => d.count));
                const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                return (
                  <div key={day.date} className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors relative group"
                       style={{ height: `${Math.max(height, 4)}%` }} title={`${day.date}: ${day.count}`}>
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {day.count}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Events */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Recent Events</h2>
          {(!data.recentEvents || data.recentEvents.length === 0) ? (
            <p className="text-sm text-gray-400">No events</p>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto">
              {data.recentEvents.map((ev) => (
                <div key={ev.id} className="flex items-start gap-3 text-sm">
                  <span className="text-base">{EVENT_ICONS[ev.type] || '📌'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{ev.lead_name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">
                      {ev.type.replace(/_/g, ' ')} · {new Date(ev.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  {ev.linkedin_url && (
                    <a href={ev.linkedin_url} target="_blank" rel="noopener noreferrer"
                       className="text-xs text-blue-600 hover:underline flex-shrink-0">↗</a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Tasks</h2>
          {(!data.tasks || data.tasks.length === 0) ? (
            <p className="text-sm text-gray-400">No tasks</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {data.tasks.map((task) => {
                const overdue = task.status === 'open' && new Date(task.due_at) < new Date();
                return (
                  <div key={task.id} className={`flex items-center gap-3 p-2.5 rounded-lg text-sm ${overdue ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <span>{task.status === 'done' ? '✅' : overdue ? '🔴' : '⬜'}</span>
                    <div className="flex-1 min-w-0">
                      <span className={`font-medium ${task.status === 'done' ? 'text-gray-400 line-through' : ''}`}>{task.type}</span>
                      <span className="text-xs text-gray-400 ml-2">— {task.lead_name}</span>
                    </div>
                    <span className={`text-xs font-medium flex-shrink-0 ${overdue ? 'text-red-600' : 'text-gray-400'}`}>
                      {new Date(task.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, alert }) {
  return (
    <div className={`rounded-xl border p-4 ${alert ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${alert ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
