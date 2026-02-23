import { apiFetch } from '../../lib/api';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getEmployees() {
  try { return await apiFetch('/analytics/employees'); } catch { return null; }
}

export default async function TeamPage() {
  const data = await getEmployees();

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center animate-scale-in">
          <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <p className="text-ink-800 text-lg font-semibold">Cannot connect to backend</p>
          <p className="text-ink-400 text-sm mt-1.5">Make sure the server is running</p>
        </div>
      </div>
    );
  }

  const totalLeads = data.employees.reduce((s, e) => s + (e.lead_count || 0), 0);
  const totalEvents = data.employees.reduce((s, e) => s + (e.event_count || 0), 0);

  const GRADIENT_PALETTES = [
    ['from-brand-400', 'to-brand-600'],
    ['from-emerald-400', 'to-emerald-600'],
    ['from-amber-400', 'to-amber-600'],
    ['from-blue-400', 'to-blue-600'],
    ['from-rose-400', 'to-rose-600'],
    ['from-violet-400', 'to-violet-600'],
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8 animate-slide-up">
        <p className="text-xs font-semibold text-ink-400 uppercase tracking-widest mb-1">People</p>
        <h1 className="text-[28px] font-bold text-ink-900 tracking-tight">Team</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8 stagger-children">
        <MiniStat label="Team Members" value={data.employees.length} icon="👥" />
        <MiniStat label="Total Leads" value={totalLeads} icon="📊" />
        <MiniStat label="Total Activity" value={totalEvents} icon="⚡" />
      </div>

      {/* Team Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
        {data.employees.map((emp, i) => {
          const palette = GRADIENT_PALETTES[i % GRADIENT_PALETTES.length];
          const initials = emp.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
          return (
            <Link key={emp.id} href={`/employees/${emp.id}`}
                  className="glass-card glass-card-hover group p-5 relative overflow-hidden">
              {/* Decorative glow */}
              <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${palette[0]} ${palette[1]} opacity-[0.06] group-hover:opacity-[0.1] transition-opacity`} />

              <div className="relative flex items-start gap-4">
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${palette[0]} ${palette[1]} flex items-center justify-center text-white text-sm font-bold shadow-lg flex-shrink-0`}>
                  {initials}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-semibold text-ink-800 group-hover:text-brand-600 transition-colors truncate">{emp.name}</h3>
                  <p className="text-[11px] text-ink-400 truncate">{emp.email}</p>

                  {/* Mini-stats */}
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-md bg-surface-100 flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                      </div>
                      <span className="text-[12px] font-semibold text-ink-700">{emp.lead_count}</span>
                      <span className="text-[10px] text-ink-300">leads</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-md bg-surface-100 flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>
                      </div>
                      <span className="text-[12px] font-semibold text-ink-700">{emp.event_count}</span>
                      <span className="text-[10px] text-ink-300">events</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <svg className="w-4 h-4 text-ink-200 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all mt-1"
                     viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon }) {
  return (
    <div className="glass-card glass-card-hover p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-surface-100 flex items-center justify-center text-lg">{icon}</div>
      <div>
        <p className="text-[22px] font-bold text-ink-900 leading-tight">{value}</p>
        <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}
