'use client';

import { useState, useEffect, useCallback } from 'react';

const API_BASE = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || '/api')
  : 'http://localhost:3001/api';

const API_KEY = 'outreach-internal-key';

const STAGES = ['New', 'Invited', 'Connected', 'Messaged', 'Replied', 'Meeting'];

const STAGE_COLORS = {
  New: 'bg-gray-100 text-gray-600',
  Invited: 'bg-[#6c5ce7]/10 text-[#6c5ce7]',
  Connected: 'bg-[#00b894]/10 text-[#00b894]',
  Messaged: 'bg-[#fdcb6e]/20 text-[#e17055]',
  Replied: 'bg-[#a29bfe]/10 text-[#6c5ce7]',
  Meeting: 'bg-[#e17055]/10 text-[#e17055]',
};

const QUALITY_LABELS = {
  complete: { dot: 'bg-[#00b894]', label: 'Complete', tip: 'All data present' },
  partial: { dot: 'bg-[#fdcb6e]', label: 'Partial', tip: 'Missing some data — visit profile to enrich' },
  needs_enrichment: { dot: 'bg-[#d63031]', label: 'Needs Enrichment', tip: 'No title/company — visit profile page' },
};

function formatTenure(months) {
  if (!months && months !== 0) return '';
  if (months < 1) return '<1 mo';
  if (months < 12) return `${months} mo`;
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

      const res = await fetch(`${API_BASE}/leads?${params}`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const data = await res.json();
      setLeads(data.leads || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  }, [page, stageFilter, qualityFilter, search]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const totalPages = Math.ceil(total / 30);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total} total leads in pipeline</p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, company, title..."
            className="w-72 px-4 py-2.5 text-[13px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]/20 focus:border-[#6c5ce7] transition-all shadow-sm"
          />
          <button type="submit" className="px-5 py-2.5 text-[13px] font-semibold bg-[#6c5ce7] text-white rounded-xl hover:bg-[#5a4bd1] transition-colors shadow-sm">
            Search
          </button>
        </form>

        <div className="flex gap-1 ml-auto">
          <FilterPill active={!stageFilter} onClick={() => { setStageFilter(''); setPage(1); }} label="All" />
          {STAGES.map((s) => (
            <FilterPill key={s} active={stageFilter === s} onClick={() => { setStageFilter(s); setPage(1); }} label={s} />
          ))}
        </div>
      </div>

      {/* Quality filter row */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mr-1">Data quality:</span>
        <QualityPill active={!qualityFilter} onClick={() => { setQualityFilter(''); setPage(1); }} label="All" />
        <QualityPill active={qualityFilter === 'complete'} onClick={() => { setQualityFilter('complete'); setPage(1); }} label="✓ Complete" color="text-[#00b894]" />
        <QualityPill active={qualityFilter === 'partial'} onClick={() => { setQualityFilter('partial'); setPage(1); }} label="⚠ Partial" color="text-[#e17055]" />
        <QualityPill active={qualityFilter === 'needs_enrichment'} onClick={() => { setQualityFilter('needs_enrichment'); setPage(1); }} label="🔍 Needs Enrichment" color="text-[#d63031]" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-gray-400">
            <div className="inline-block w-7 h-7 border-2 border-gray-200 border-t-[#6c5ce7] rounded-full animate-spin mb-3"></div>
            <p className="text-[13px]">Loading...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gray-50 flex items-center justify-center text-2xl">🔍</div>
            <p className="text-[13px] font-medium">No leads found</p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-gray-50/60 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="px-5 py-3.5 w-6"></th>
                <th className="px-5 py-3.5">Name</th>
                <th className="px-5 py-3.5">Company</th>
                <th className="px-5 py-3.5">Title</th>
                <th className="px-5 py-3.5">Tenure</th>
                <th className="px-5 py-3.5">Stage</th>
                <th className="px-5 py-3.5">Owner</th>
                <th className="px-5 py-3.5">Created</th>
                <th className="px-5 py-3.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leads.map((lead) => {
                const q = QUALITY_LABELS[lead.data_quality] || QUALITY_LABELS.complete;
                return (
                  <tr key={lead.id} className="hover:bg-[#f7f8fc] transition-colors group">
                    {/* Quality indicator dot */}
                    <td className="pl-5 py-3.5">
                      <div
                        className={`w-2 h-2 rounded-full ${q.dot}`}
                        title={q.tip}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-gray-800">{lead.name}</div>
                      {lead.location && <div className="text-[11px] text-gray-400 mt-0.5">{lead.location}</div>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{lead.company || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-500 max-w-[200px] truncate">{lead.title || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5">
                      {lead.tenure_months ? (
                        <span className="text-[12px] font-medium text-[#6c5ce7] bg-[#6c5ce7]/5 px-2 py-0.5 rounded-md">
                          {formatTenure(lead.tenure_months)}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold ${STAGE_COLORS[lead.stage] || ''}`}>
                        {lead.stage}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{lead.owner_name || '—'}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-[12px]">
                      {new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3.5">
                      <a
                        href={lead.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 text-[#6c5ce7] hover:text-[#5a4bd1] text-[11px] font-semibold transition-opacity"
                      >
                        LinkedIn ↗
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
        <div className="flex items-center justify-between mt-5">
          <p className="text-[13px] text-gray-400">
            Page {page} of {totalPages} · {leads.length} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-[13px] font-medium border border-gray-200 rounded-xl disabled:opacity-30 hover:bg-white hover:shadow-sm transition-all"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 text-[13px] font-medium border border-gray-200 rounded-xl disabled:opacity-30 hover:bg-white hover:shadow-sm transition-all"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterPill({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-xl text-[12px] font-semibold transition-all ${
        active
          ? 'bg-[#6c5ce7] text-white shadow-sm'
          : 'bg-white border border-gray-200 text-gray-500 hover:border-[#6c5ce7]/30 hover:text-[#6c5ce7]'
      }`}
    >
      {label}
    </button>
  );
}

function QualityPill({ active, onClick, label, color }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all ${
        active
          ? 'bg-gray-800 text-white'
          : `bg-white border border-gray-200 ${color || 'text-gray-500'} hover:bg-gray-50`
      }`}
    >
      {label}
    </button>
  );
}
