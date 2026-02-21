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
          <p className="text-5xl mb-4">⚠️</p>
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
    connected: { icon: '🤝', label: 'Connected', color: 'text-green-600' },
    message_sent: { icon: '💬', label: 'Message Sent', color: 'text-orange-600' },
    reply_received: { icon: '📨', label: 'Reply Received', color: 'text-purple-600' },
    meeting_booked: { icon: '📅', label: 'Meeting Booked', color: 'text-red-600' },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">Pipeline health and team activity</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard label="Total Leads" value={data.totalLeads} icon="🎯" />
        <KpiCard label="Acceptance Rate" value={`${data.acceptanceRate}%`} sub="Connected / Invites" icon="🤝" />
        <KpiCard label="Reply Rate" value={`${data.replyRate}%`} sub="Replies / Messages" icon="💬" />
        <KpiCard label="Meetings" value={data.meetings} icon="📅" />
        <KpiCard label="Overdue Tasks" value={data.overdueTasks} icon="⚠️" alert={data.overdueTasks > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funnel — 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Pipeline Funnel</h2>
          {/* Bar */}
          <div className="flex h-10 rounded-lg overflow-hidden mb-4">
            {stageOrder.map((stage) => {
              const count = data.stages[stage] || 0;
              if (count === 0) return null;
              const pct = total > 0 ? (count / total) * 100 : 0;
              const colors = {
                New: 'bg-gray-400', Invited: 'bg-blue-500', Connected: 'bg-emerald-500',
                Messaged: 'bg-orange-500', Replied: 'bg-purple-500', Meeting: 'bg-rose-500',
              };
              return (
                <div key={stage} className={`${colors[stage]} flex items-center justify-center text-xs font-bold text-white`}
                     style={{ width: `${pct}%` }} title={`${stage}: ${count}`}>
                  {pct > 8 ? count : ''}
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {stageOrder.map((stage) => {
              const colors = {
                New: 'bg-gray-400', Invited: 'bg-blue-500', Connected: 'bg-emerald-500',
                Messaged: 'bg-orange-500', Replied: 'bg-purple-500', Meeting: 'bg-rose-500',
              };
              return (
                <div key={stage} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className={`w-2.5 h-2.5 rounded-full ${colors[stage]}`} />
                  {stage}: <span className="font-semibold">{data.stages[stage] || 0}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity Feed — 1 column */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Recent Activity</h2>
          {(!feed || !feed.events || feed.events.length === 0) ? (
            <p className="text-sm text-gray-400">No recent activity</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {feed.events.map((ev) => {
                const meta = EVENT_LABELS[ev.type] || { icon: '📌', label: ev.type, color: 'text-gray-600' };
                const timeAgo = getTimeAgo(ev.created_at);
                return (
                  <div key={ev.id} className="flex items-start gap-3 text-sm">
                    <span className="text-base mt-0.5">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{ev.lead_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">
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

function KpiCard({ label, value, sub, icon, alert }) {
  return (
    <div className={`rounded-xl border p-4 ${alert ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
        <span className="text-xl opacity-50">{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${alert ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
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
