'use client';

import { useState, useEffect, useCallback } from 'react';

const API_BASE = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || '/api')
  : 'http://localhost:3001/api';

const API_KEY = 'outreach-internal-key';

const STAGES = ['New', 'Invited', 'Connected', 'Messaged', 'Replied', 'Meeting'];

const STAGE_STYLES = {
  New: 'bg-gray-100 text-gray-700',
  Invited: 'bg-blue-50 text-blue-700',
  Connected: 'bg-emerald-50 text-emerald-700',
  Messaged: 'bg-orange-50 text-orange-700',
  Replied: 'bg-purple-50 text-purple-700',
  Meeting: 'bg-rose-50 text-rose-700',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (stageFilter) params.set('stage', stageFilter);
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
  }, [page, stageFilter, search]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const totalPages = Math.ceil(total / 30);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total leads in pipeline</p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, company, title..."
            className="w-72 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          <button type="submit" className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">
            Search
          </button>
        </form>

        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => { setStageFilter(''); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !stageFilter ? 'bg-slate-900 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => { setStageFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                stageFilter === s ? 'bg-slate-900 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="inline-block w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin mb-2"></div>
            <p>Loading...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-3xl mb-2">🔍</p>
            <p>No leads found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Company</th>
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Stage</th>
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-gray-900">{lead.name}</div>
                    {lead.location && <div className="text-xs text-gray-400 mt-0.5">{lead.location}</div>}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{lead.company || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500 max-w-[200px] truncate">{lead.title || '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STAGE_STYLES[lead.stage] || ''}`}>
                      {lead.stage}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{lead.owner_name || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">
                    {new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5">
                    <a
                      href={lead.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-800 text-xs font-medium transition-opacity"
                    >
                      LinkedIn ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages} · Showing {leads.length} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-30 hover:bg-gray-50 transition-colors"
            >
              ← Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-30 hover:bg-gray-50 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
