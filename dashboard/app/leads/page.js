'use client';

import { useState, useEffect, useCallback } from 'react';

const API_BASE = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || '/api')
  : 'http://localhost:3001/api';
const API_KEY = 'outreach-internal-key';

const STAGES = ['New', 'Invited', 'Connected', 'Messaged', 'Replied', 'Meeting'];

const STAGE_STYLES = {
  New: 'bg-slate-100 text-slate-600',
  Invited: 'bg-brand-50 text-brand-600',
  Connected: 'bg-emerald-50 text-emerald-600',
  Messaged: 'bg-amber-50 text-amber-600',
  Replied: 'bg-violet-50 text-violet-600',
  Meeting: 'bg-rose-50 text-rose-600',
};

const QUALITY_CONFIG = {
  complete: { dot: 'bg-emerald-400', label: 'Complete', color: 'text-emerald-600' },
  partial: { dot: 'bg-amber-400', label: 'Partial', color: 'text-amber-600' },
  needs_enrichment: { dot: 'bg-red-400', label: 'Needs data', color: 'text-red-500' },
};

function formatTenure(months) {
  if (!months && months !== 0) return null;
  if (months < 1) return '<1m';
  if (months < 12) return `${months}m`;
  const yrs = Math.floor(months / 12);
  const mo = months % 12;
  return mo > 0 ? `${yrs}y ${mo}m` : `${yrs}y`;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (stageFilter) params.set('stage', stageFilter);
      if (qualityFilter) params.set('quality', qualityFilter);
      if (search) params.set('search', search);
      const res = await fetch(`${API_BASE}/leads?${params}`, { headers: { 'X-API-Key': API_KEY } });
      const data = await res.json();
      setLeads(data.leads || []);
      setTotal(data.total || 0);
    } catch (err) { console.error('Failed to fetch leads:', err); }
    finally { setLoading(false); }
  }, [page, stageFilter, qualityFilter, search]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleSearch = (e) => { e.preventDefault(); setSearch(searchInput); setPage(1); };
  const totalPages = Math.ceil(total / 30);

  return (
    <div>
      {/* Header */}
      <div className="mb-8 animate-slide-up">
        <p className="text-xs font-semibold text-ink-400 uppercase tracking-widest mb-1">CRM</p>
        <div className="flex items-end justify-between">
          <h1 className="text-[28px] font-bold text-ink-900 tracking-tight">Leads</h1>
          <span className="text-sm text-ink-400 font-medium">{total} total</span>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              type="text" value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search leads..."
              className="w-64 pl-10 pr-4 py-2.5 text-[13px] bg-white border border-surface-200 rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400
                         shadow-sm transition-all placeholder:text-ink-300"
            />
          </div>
          <button type="submit" className="pill-btn bg-ink-900 text-white hover:bg-ink-800 shadow-sm">
            Search
          </button>
        </form>

        <div className="flex gap-1 ml-auto">
          <PillFilter active={!stageFilter} onClick={() => { setStageFilter(''); setPage(1); }}>All</PillFilter>
          {STAGES.map((s) => (
            <PillFilter key={s} active={stageFilter === s} onClick={() => { setStageFilter(s); setPage(1); }}>{s}</PillFilter>
          ))}
        </div>
      </div>

      {/* Quality filter */}
      <div className="flex items-center gap-2 mb-5 animate-slide-up" style={{ animationDelay: '0.08s' }}>
        <span className="text-[10px] font-bold text-ink-300 uppercase tracking-widest">Quality</span>
        <QualityPill active={!qualityFilter} onClick={() => { setQualityFilter(''); setPage(1); }}>All</QualityPill>
        <QualityPill active={qualityFilter === 'complete'} onClick={() => { setQualityFilter('complete'); setPage(1); }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block mr-1" />Complete
        </QualityPill>
        <QualityPill active={qualityFilter === 'partial'} onClick={() => { setQualityFilter('partial'); setPage(1); }}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block mr-1" />Partial
        </QualityPill>
        <QualityPill active={qualityFilter === 'needs_enrichment'} onClick={() => { setQualityFilter('needs_enrichment'); setPage(1); }}>
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block mr-1" />Needs data
        </QualityPill>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden animate-slide-up" style={{ animationDelay: '0.1s' }}>
        {loading ? (
          <div className="p-20 text-center">
            <div className="w-8 h-8 mx-auto border-2 border-surface-200 border-t-brand-500 rounded-full animate-spin mb-3" />
            <p className="text-sm text-ink-400">Loading leads...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-100 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </div>
            <p className="text-sm font-medium text-ink-500">No leads found</p>
            <p className="text-xs text-ink-300 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[10px] font-bold text-ink-300 uppercase tracking-wider border-b border-surface-100">
                <th className="px-5 py-3.5 w-8" />
                <th className="px-5 py-3.5">Name</th>
                <th className="px-5 py-3.5">Company</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Tenure</th>
                <th className="px-5 py-3.5">Stage</th>
                <th className="px-5 py-3.5">Owner</th>
                <th className="px-5 py-3.5">Added</th>
                <th className="px-5 py-3.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {leads.map((lead, i) => {
                const q = QUALITY_CONFIG[lead.data_quality] || QUALITY_CONFIG.complete;
                const tenure = formatTenure(lead.tenure_months);
                return (
                  <tr key={lead.id}
                      className="border-b border-surface-50 hover:bg-brand-50/30 transition-colors group table-row-enter"
                      style={{ animationDelay: `${i * 0.02}s` }}>
                    <td className="pl-5 py-4">
                      <div className={`w-2 h-2 rounded-full ${q.dot}`} title={q.label} />
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-ink-800 group-hover:text-brand-600 transition-colors">{lead.name}</p>
                      {lead.location && <p className="text-[11px] text-ink-400 mt-0.5">{lead.location}</p>}
                    </td>
                    <td className="px-5 py-4 text-ink-600">{lead.company || <span className="text-ink-200">—</span>}</td>
                    <td className="px-5 py-4 text-ink-500 max-w-[180px] truncate">{lead.title || <span className="text-ink-200">—</span>}</td>
                    <td className="px-5 py-4">
                      {tenure ? (
                        <span className="text-[11px] font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md">{tenure}</span>
                      ) : <span className="text-ink-200">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold ${STAGE_STYLES[lead.stage] || ''}`}>
                        {lead.stage}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-ink-500 text-[12px]">{lead.owner_name || '—'}</td>
                    <td className="px-5 py-4 text-ink-300 text-[11px]">
                      {new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-5 py-4">
                      <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer"
                         className="opacity-0 group-hover:opacity-100 text-brand-500 hover:text-brand-700 text-[11px] font-semibold transition-all">
                        ↗
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5 animate-fade-in">
          <p className="text-[12px] text-ink-400">
            Page <span className="font-semibold text-ink-600">{page}</span> of {totalPages}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="pill-btn bg-white border border-surface-200 text-ink-600 disabled:opacity-30 hover:bg-surface-50 shadow-sm">
              ← Prev
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="pill-btn bg-white border border-surface-200 text-ink-600 disabled:opacity-30 hover:bg-surface-50 shadow-sm">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PillFilter({ active, onClick, children }) {
  return (
    <button onClick={onClick}
            className={`pill-btn ${active
              ? 'bg-ink-900 text-white shadow-md'
              : 'bg-white border border-surface-200 text-ink-500 hover:border-brand-300 hover:text-brand-600 shadow-sm'
            }`}>
      {children}
    </button>
  );
}

function QualityPill({ active, onClick, children }) {
  return (
    <button onClick={onClick}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 flex items-center ${
              active
                ? 'bg-ink-800 text-white'
                : 'bg-white border border-surface-200 text-ink-500 hover:bg-surface-50'
            }`}>
      {children}
    </button>
  );
}
