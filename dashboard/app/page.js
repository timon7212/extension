import { apiFetch } from '../lib/api';

export const dynamic = 'force-dynamic';

async function getOverview() {
  try {
    return await apiFetch('/analytics/overview');
  } catch {
    return null;
  }
}

async function getActivityFeed() {
  try {
    return await apiFetch('/analytics/activity-feed?limit=15');
  } catch {
    return null;
  }
}

export default async function OverviewPage() {
  const [data, feed] = await Promise.all([getOverview(), getActivityFeed()]);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center text-3xl">⚠️</div>
          <p className="text-gray-500 text-lg font-medium">Cannot connect to backend</p>
          <p className="text-gray-400 text-sm mt-1">Make sure the server is running on port 3001</p>
        </div>
      </div>
    );
  }

  const stageOrder = ['New', 'Invited', 'Connected', 'Messaged', 'Replied', 'Meeting'];
  const total = stageOrder.reduce((s, st) => s + (data.stages[st] || 0), 0);

  const EVENT_LABELS = {
    invite_sent: { icon: '📩', label: 'Invite Sent', color: 'text-blue-600' },
    connected: { icon: '🤝', label: 'Connected', color: 'text-emerald-600' },
    message_sent: { icon: '💬', label: 'Message Sent', color: 'text-orange-500' },
    reply_received: { icon: '📨', label: 'Reply Received', color: 'text-purple-600' },
    meeting_booked: { icon: '📅', label: 'Meeting Booked', color: 'text-rose-600' },
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[22px] font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-400 mt-0.5">Pipeline health and team activity</p>
      </div>

      {/* KPI Cards — Apollo-style rounded cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <KpiCard label="Total Leads" value={data.totalLeads} icon="🎯" color="bg-purple-50 text-purple-600" />
        <KpiCard label="Accept Rate" value={`${data.acceptanceRate}%`} sub="Connected / Invites" icon="🤝" color="bg-emerald-50 text-emerald-600" />
        <KpiCard label="Reply Rate" value={`${data.replyRate}%`} sub="Replies / Messages" icon="💬" color="bg-blue-50 text-blue-600" />
        <KpiCard label="Meetings" value={data.meetings} icon="📅" color="bg-orange-50 text-orange-600" />
        <KpiCard label="Overdue Tasks" value={data.overdueTasks} icon="⚠️" alert={data.overdueTasks > 0} color="bg-red-50 text-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Funnel — 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-5">Pipeline Funnel</h2>
          
          {/* Funnel bars */}
          <div className="flex h-11 rounded-xl overflow-hidden mb-5 shadow-inner bg-gray-50">
            {stageOrder.map((stage) => {
              const count = data.stages[stage] || 0;
              if (count === 0) return null;
              const pct = total > 0 ? (count / total) * 100 : 0;
              const colors = {
                New: 'bg-gray-400', Invited: 'bg-[#6c5ce7]', Connected: 'bg-[#00b894]',
                Messaged: 'bg-[#fdcb6e]', Replied: 'bg-[#a29bfe]', Meeting: 'bg-[#e17055]',
              };
              return (
                <div key={stage} className={`${colors[stage]} flex items-center justify-center text-xs font-bold text-white transition-all`}
                     style={{ width: `${pct}%` }} title={`${stage}: ${count}`}>
                  {pct > 8 ? count : ''}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {stageOrder.map((stage) => {
              const colors = {
                New: 'bg-gray-400', Invited: 'bg-[#6c5ce7]', Connected: 'bg-[#00b894]',
                Messaged: 'bg-[#fdcb6e]', Replied: 'bg-[#a29bfe]', Meeting: 'bg-[#e17055]',
              };
              return (
                <div key={stage} className="flex items-center gap-2 text-[13px] text-gray-500">
                  <span className={`w-2.5 h-2.5 rounded-full ${colors[stage]}`} />
                  {stage}: <span className="font-semibold text-gray-700">{data.stages[stage] || 0}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity Feed — 1 column */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-5">Recent Activity</h2>
          {(!feed || !feed.events || feed.events.length === 0) ? (
            <p className="text-sm text-gray-400">No recent activity</p>
          ) : (
            <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
              {feed.events.map((ev) => {
                const meta = EVENT_LABELS[ev.type] || { icon: '📌', label: ev.type, color: 'text-gray-600' };
                const timeAgo = getTimeAgo(ev.created_at);
                return (
                  <div key={ev.id} className="flex items-start gap-3 text-sm group">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 text-base">
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate text-[13px]">{ev.lead_name || 'Unknown'}</p>
                      <p className="text-[11px] text-gray-400">
                        <span className={meta.color}>{meta.label}</span> · {ev.employee_name} · {timeAgo}
                      </p>
                    </div>
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

function KpiCard({ label, value, sub, icon, alert, color }) {
  return (
    <div className={`rounded-2xl border p-5 transition-all hover:shadow-md ${alert ? 'bg-red-50/60 border-red-200' : 'bg-white border-gray-100 shadow-sm'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${color || 'bg-gray-50 text-gray-500'} flex items-center justify-center text-sm`}>
          {icon}
        </div>
      </div>
      <p className={`text-2xl font-bold ${alert ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function getTimeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  const days = Math.floor(seconds / 86400);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
