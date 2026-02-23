import { apiFetch } from '../../../lib/api';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getEmployee(id) {
  try { return await apiFetch(`/analytics/employees/${id}`); } catch { return null; }
}

export default async function EmployeeDetailPage({ params }) {
  const { id } = await params;
  const data = await getEmployee(id);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center animate-scale-in">
          <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <p className="text-ink-800 text-lg font-semibold">Employee not found</p>
          <Link href="/employees" className="text-brand-500 text-sm mt-2 inline-block hover:underline">← Back to team</Link>
        </div>
      </div>
    );
  }

  const { employee, leads, events, stages, tasks } = data;
  const initials = employee.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const stageOrder = ['New', 'Invited', 'Connected', 'Messaged', 'Replied', 'Meeting'];
  const totalStageLeads = stageOrder.reduce((s, st) => s + (stages[st] || 0), 0);

  const STAGE_COLORS = {
    New: '#94a3b8', Invited: '#6e62e5', Connected: '#22c55e',
    Messaged: '#f59e0b', Replied: '#8b83ff', Meeting: '#ef4444',
  };

  const EVENT_META = {
    invite_sent: { icon: '📩', color: 'bg-blue-50 text-blue-600' },
    connected: { icon: '🤝', color: 'bg-emerald-50 text-emerald-600' },
    message_sent: { icon: '💬', color: 'bg-amber-50 text-amber-600' },
    reply_received: { icon: '📨', color: 'bg-violet-50 text-violet-600' },
    meeting_booked: { icon: '📅', color: 'bg-rose-50 text-rose-600' },
  };

  // Activity chart — last 14 days
  const chart = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayEvents = events.filter(e => e.created_at?.startsWith(key));
    chart.push({ label: d.toLocaleDateString('en-US', { weekday: 'narrow' }), day: d.getDate(), count: dayEvents.length });
  }
  const chartMax = Math.max(...chart.map(c => c.count), 1);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6 animate-fade-in">
        <Link href="/employees" className="text-xs font-medium text-ink-400 hover:text-brand-500 transition-colors">
          ← Back to Team
        </Link>
      </div>

      {/* Hero */}
      <div className="glass-card p-6 mb-6 animate-slide-up relative overflow-hidden">
        {/* Decorative glow */}
        <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 opacity-[0.05]" />

        <div className="relative flex items-center gap-5">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-brand-500/20">
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink-900 tracking-tight">{employee.name}</h1>
            <p className="text-[13px] text-ink-400">{employee.email}</p>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4 mb-6 stagger-children">
        <KpiTile label="Leads" value={leads.length} icon="👤" />
        <KpiTile label="Events" value={events.length} icon="⚡" />
        <KpiTile label="Open Tasks" value={tasks?.filter(t => t.status === 'open').length || 0} icon="📋" />
        <KpiTile
          label="Reply Rate"
          value={`${getReplyRate(stages)}%`}
          icon="💬"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Pipeline Funnel */}
        <div className="lg:col-span-1 glass-card p-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h3 className="text-sm font-semibold text-ink-800 mb-4">Pipeline</h3>
          <div className="space-y-2.5">
            {stageOrder.map(stage => {
              const count = stages[stage] || 0;
              const pct = totalStageLeads > 0 ? (count / totalStageLeads) * 100 : 0;
              return (
                <div key={stage}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: STAGE_COLORS[stage] }} />
                      <span className="text-[12px] font-medium text-ink-600">{stage}</span>
                    </div>
                    <span className="text-[12px] font-bold text-ink-700">{count}</span>
                  </div>
                  <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                         style={{ width: `${Math.max(pct, 2)}%`, background: STAGE_COLORS[stage] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity Chart */}
        <div className="lg:col-span-2 glass-card p-5 animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <h3 className="text-sm font-semibold text-ink-800 mb-4">Activity · 14 days</h3>
          <div className="flex items-end gap-1 h-[120px]">
            {chart.map((bar, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
                <div className="relative flex-1 w-full flex items-end justify-center">
                  <div className="w-full max-w-[24px] rounded-t-lg transition-all duration-300 group-hover:opacity-80"
                       style={{
                         height: `${Math.max((bar.count / chartMax) * 100, 4)}%`,
                         background: bar.count > 0 ? 'linear-gradient(to top, #6e62e5, #8b83ff)' : '#e8ecf1',
                       }} />
                  {bar.count > 0 && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      {bar.count}
                    </span>
                  )}
                </div>
                <span className="text-[9px] text-ink-300 mt-1.5 font-medium">{bar.day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Events */}
        <div className="glass-card p-5 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h3 className="text-sm font-semibold text-ink-800 mb-4">Recent Events</h3>
          {events.length === 0 ? (
            <p className="text-sm text-ink-300 text-center py-8">No events yet</p>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
              {events.slice(0, 25).map((ev, i) => {
                const meta = EVENT_META[ev.type] || { icon: '📌', color: 'bg-surface-100 text-ink-600' };
                return (
                  <div key={ev.id || i} className="flex items-center gap-3 p-2.5 -mx-1 rounded-xl hover:bg-surface-50 transition-colors group">
                    <div className="w-8 h-8 rounded-xl bg-surface-100 flex items-center justify-center text-sm flex-shrink-0 group-hover:scale-110 transition-transform">
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-ink-700 truncate">{ev.lead_name || 'Unknown'}</p>
                      <p className="text-[11px] text-ink-400">{ev.type?.replace(/_/g, ' ')} · {getTimeAgo(ev.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="glass-card p-5 animate-slide-up" style={{ animationDelay: '0.25s' }}>
          <h3 className="text-sm font-semibold text-ink-800 mb-4">Tasks</h3>
          {(!tasks || tasks.length === 0) ? (
            <p className="text-sm text-ink-300 text-center py-8">No tasks</p>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
              {tasks.slice(0, 25).map((task, i) => {
                const overdue = task.status === 'open' && new Date(task.due_at) < new Date();
                return (
                  <div key={task.id || i} className={`flex items-center gap-3 p-2.5 -mx-1 rounded-xl transition-colors ${overdue ? 'bg-red-50/40' : 'hover:bg-surface-50'}`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      task.status === 'done' ? 'bg-emerald-100 text-emerald-600' :
                      overdue ? 'bg-red-100 text-red-500' : 'bg-surface-100 text-ink-300'
                    }`}>
                      {task.status === 'done' ? '✓' : overdue ? '!' : '○'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-medium truncate ${task.status === 'done' ? 'text-ink-300 line-through' : 'text-ink-700'}`}>
                        {task.type} — {task.lead_name || 'Unknown'}
                      </p>
                      <p className={`text-[11px] ${overdue ? 'text-red-500 font-semibold' : 'text-ink-400'}`}>
                        {formatDue(task.due_at)}
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

function KpiTile({ label, value, icon }) {
  return (
    <div className="glass-card glass-card-hover p-4 text-center">
      <span className="text-lg">{icon}</span>
      <p className="text-[22px] font-bold text-ink-900 mt-1">{value}</p>
      <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

function getReplyRate(stages) {
  const messaged = (stages.Messaged || 0) + (stages.Replied || 0) + (stages.Meeting || 0);
  const replied = (stages.Replied || 0) + (stages.Meeting || 0);
  return messaged > 0 ? Math.round((replied / messaged) * 100) : 0;
}

function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  const days = Math.floor(seconds / 86400);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDue(dateStr) {
  const d = new Date(dateStr); const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((dateStart - today) / 86400000);
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  return `Due in ${diff}d`;
}
