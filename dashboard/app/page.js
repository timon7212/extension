import { apiFetch } from '../lib/api';

export const dynamic = 'force-dynamic';

async function getOverview() {
  try { return await apiFetch('/analytics/overview'); } catch { return null; }
}

async function getActivityFeed() {
  try { return await apiFetch('/analytics/activity-feed?limit=12'); } catch { return null; }
}

export default async function OverviewPage() {
  const [data, feed] = await Promise.all([getOverview(), getActivityFeed()]);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center animate-scale-in">
          <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <p className="text-ink-800 text-lg font-semibold">Cannot connect to backend</p>
          <p className="text-ink-400 text-sm mt-1.5">Make sure the server is running on port 3001</p>
        </div>
      </div>
    );
  }

  const stageOrder = ['New', 'Invited', 'Connected', 'Messaged', 'Replied', 'Meeting'];
  const total = stageOrder.reduce((s, st) => s + (data.stages[st] || 0), 0);

  const EVENT_META = {
    invite_sent: { icon: '📩', label: 'Invite Sent', color: 'text-blue-500' },
    connected: { icon: '🤝', label: 'Connected', color: 'text-emerald-500' },
    message_sent: { icon: '💬', label: 'Message Sent', color: 'text-amber-500' },
    reply_received: { icon: '📨', label: 'Reply Received', color: 'text-violet-500' },
    meeting_booked: { icon: '📅', label: 'Meeting Booked', color: 'text-rose-500' },
  };

  const STAGE_COLORS = {
    New: '#94a3b8', Invited: '#6e62e5', Connected: '#22c55e',
    Messaged: '#f59e0b', Replied: '#8b83ff', Meeting: '#ef4444',
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 animate-slide-up">
        <p className="text-xs font-semibold text-ink-400 uppercase tracking-widest mb-1">Dashboard</p>
        <h1 className="text-[28px] font-bold text-ink-900 tracking-tight">Overview</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8 stagger-children">
        <KpiCard
          label="Total Leads"
          value={data.totalLeads}
          gradient="from-brand-500/10 to-brand-400/5"
          iconBg="bg-brand-500"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>}
        />
        <KpiCard
          label="Accept Rate"
          value={`${data.acceptanceRate}%`}
          sub="Connected / Invites"
          gradient="from-emerald-500/10 to-emerald-400/5"
          iconBg="bg-emerald-500"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
        />
        <KpiCard
          label="Reply Rate"
          value={`${data.replyRate}%`}
          sub="Replies / Messages"
          gradient="from-blue-500/10 to-blue-400/5"
          iconBg="bg-blue-500"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
        />
        <KpiCard
          label="Meetings"
          value={data.meetings}
          gradient="from-amber-500/10 to-amber-400/5"
          iconBg="bg-amber-500"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
        />
        <KpiCard
          label="Overdue"
          value={data.overdueTasks}
          alert={data.overdueTasks > 0}
          gradient={data.overdueTasks > 0 ? 'from-red-500/10 to-red-400/5' : 'from-emerald-500/10 to-emerald-400/5'}
          iconBg={data.overdueTasks > 0 ? 'bg-red-500' : 'bg-emerald-500'}
          icon={data.overdueTasks > 0
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Funnel — 2 col */}
        <div className="lg:col-span-2 glass-card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-ink-800">Pipeline Funnel</h2>
            <span className="text-xs text-ink-400 font-medium">{total} total</span>
          </div>

          {/* Visual funnel */}
          <div className="space-y-2.5 mb-6">
            {stageOrder.map((stage) => {
              const count = data.stages[stage] || 0;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={stage} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: STAGE_COLORS[stage] }} />
                      <span className="text-[13px] font-medium text-ink-700">{stage}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-ink-800">{count}</span>
                      <span className="text-[11px] text-ink-400">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${Math.max(pct, 1)}%`, background: STAGE_COLORS[stage] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity Feed — 1 col */}
        <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-sm font-semibold text-ink-800 mb-5">Recent Activity</h2>
          {(!feed || !feed.events || feed.events.length === 0) ? (
            <div className="text-center py-8">
              <p className="text-ink-300 text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
              {feed.events.map((ev, i) => {
                const meta = EVENT_META[ev.type] || { icon: '📌', label: ev.type, color: 'text-ink-500' };
                return (
                  <div key={ev.id} className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl hover:bg-surface-50 transition-colors group"
                       style={{ animationDelay: `${i * 0.03}s` }}>
                    <div className="w-8 h-8 rounded-xl bg-surface-100 flex items-center justify-center text-sm flex-shrink-0 group-hover:scale-110 transition-transform">
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-ink-800 truncate">{ev.lead_name || 'Unknown'}</p>
                      <p className="text-[11px] text-ink-400">
                        <span className={meta.color}>{meta.label}</span>
                        <span className="mx-1.5 text-ink-300">·</span>
                        {ev.employee_name}
                        <span className="mx-1.5 text-ink-300">·</span>
                        {getTimeAgo(ev.created_at)}
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

function KpiCard({ label, value, sub, gradient, iconBg, icon, alert }) {
  return (
    <div className={`glass-card glass-card-hover p-5 bg-gradient-to-br ${gradient} relative overflow-hidden`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center shadow-lg`}>
          {icon}
        </div>
      </div>
      <p className={`text-[26px] font-bold tracking-tight ${alert ? 'text-red-500' : 'text-ink-900'}`}>{value}</p>
      {sub && <p className="text-[11px] text-ink-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function getTimeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  const days = Math.floor(seconds / 86400);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
