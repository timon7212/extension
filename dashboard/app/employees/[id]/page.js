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
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center text-3xl">⚠️</div>
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
      <div className="mb-6">
        <Link href="/employees" className="text-[13px] text-[#6c5ce7] hover:text-[#5a4bd1] font-medium">
          ← Back to Team
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6c5ce7] to-[#a29bfe] text-white flex items-center justify-center font-bold text-2xl shadow-sm">
          {data.employee?.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">{data.employee?.name || 'Unknown'}</h1>
          <p className="text-sm text-gray-400">{data.employee?.email} · {data.employee?.role}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <KpiCard label="Total Leads" value={totalLeads} />
        <KpiCard label="Avg Reply Time" value={data.avgReplyHours ? `${data.avgReplyHours}h` : 'N/A'} />
        <KpiCard label="Active Days (30d)" value={data.activityPerDay?.length || 0} />
        <KpiCard
          label="Overdue Tasks"
          value={data.tasks?.filter(t => t.status === 'open' && new Date(t.due_at) < new Date()).length || 0}
          alert
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-7">
        {/* Pipeline */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-5">Pipeline</h2>
          {totalLeads === 0 ? (
            <p className="text-[13px] text-gray-400">No leads yet</p>
          ) : (
            <>
              <div className="flex h-9 rounded-xl overflow-hidden mb-4 shadow-inner bg-gray-50">
                {stageOrder.map((stage) => {
                  const count = stages[stage] || 0;
                  if (count === 0) return null;
                  const pct = (count / totalLeads) * 100;
                  const colors = {
                    New: 'bg-gray-400', Invited: 'bg-[#6c5ce7]', Connected: 'bg-[#00b894]',
                    Messaged: 'bg-[#fdcb6e]', Replied: 'bg-[#a29bfe]', Meeting: 'bg-[#e17055]',
                  };
                  return (
                    <div key={stage} className={`${colors[stage]} flex items-center justify-center text-[11px] font-bold text-white`}
                         style={{ width: `${pct}%` }} title={`${stage}: ${count}`}>
                      {pct > 10 ? count : ''}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-gray-500">
                {stageOrder.map((s) => (
                  <span key={s}>{s}: <strong className="text-gray-700">{stages[s] || 0}</strong></span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Activity Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-5">Activity (30 days)</h2>
          {(!data.activityPerDay || data.activityPerDay.length === 0) ? (
            <p className="text-[13px] text-gray-400">No activity</p>
          ) : (
            <div className="flex items-end gap-0.5 h-24">
              {data.activityPerDay.map((day) => {
                const maxCount = Math.max(...data.activityPerDay.map((d) => d.count));
                const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                return (
                  <div key={day.date} className="flex-1 bg-[#6c5ce7] rounded-t hover:bg-[#5a4bd1] transition-colors relative group"
                       style={{ height: `${Math.max(height, 4)}%` }} title={`${day.date}: ${day.count}`}>
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-5">Recent Events</h2>
          {(!data.recentEvents || data.recentEvents.length === 0) ? (
            <p className="text-[13px] text-gray-400">No events</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {data.recentEvents.map((ev) => (
                <div key={ev.id} className="flex items-start gap-3 text-[13px]">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-sm flex-shrink-0">
                    {EVENT_ICONS[ev.type] || '📌'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{ev.lead_name || 'Unknown'}</p>
                    <p className="text-[11px] text-gray-400">
                      {ev.type.replace(/_/g, ' ')} · {new Date(ev.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  {ev.linkedin_url && (
                    <a href={ev.linkedin_url} target="_blank" rel="noopener noreferrer"
                       className="text-[11px] text-[#6c5ce7] hover:underline flex-shrink-0">↗</a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-5">Tasks</h2>
          {(!data.tasks || data.tasks.length === 0) ? (
            <p className="text-[13px] text-gray-400">No tasks</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {data.tasks.map((task) => {
                const overdue = task.status === 'open' && new Date(task.due_at) < new Date();
                return (
                  <div key={task.id} className={`flex items-center gap-3 p-3 rounded-xl text-[13px] ${overdue ? 'bg-red-50/60' : 'bg-gray-50/60'}`}>
                    <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-sm shadow-sm">
                      {task.status === 'done' ? '✅' : overdue ? '🔴' : '⬜'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`font-medium ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{task.type}</span>
                      <span className="text-[11px] text-gray-400 ml-2">— {task.lead_name}</span>
                    </div>
                    <span className={`text-[11px] font-semibold flex-shrink-0 ${overdue ? 'text-[#d63031]' : 'text-gray-400'}`}>
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
    <div className={`rounded-2xl border p-5 ${alert ? 'bg-red-50/60 border-red-200' : 'bg-white border-gray-100 shadow-sm'}`}>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold ${alert ? 'text-[#d63031]' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
