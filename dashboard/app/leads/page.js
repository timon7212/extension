'use client';

import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const STAGES = ['', 'New', 'Invited', 'Connected', 'Messaged', 'Replied', 'Meeting'];

const STAGE_COLORS = {
  New: 'bg-gray-100 text-gray-700',
  Invited: 'bg-blue-100 text-blue-700',
  Connected: 'bg-green-100 text-green-700',
  Messaged: 'bg-orange-100 text-orange-700',
  Replied: 'bg-purple-100 text-purple-700',
  Meeting: 'bg-red-100 text-red-700',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ stage: '', owner: '', campaign: '' });
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 25 });
      if (filters.stage) params.set('stage', filters.stage);
      if (filters.owner) params.set('owner', filters.owner);
      if (filters.campaign) params.set('campaign', filters.campaign);

      const res = await fetch(`${API_BASE}/leads?${params}`);
      const data = await res.json();
      setLeads(data.leads || []);
      setTotal(data.total || 0);
    } catch {
      console.error('Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const totalPages = Math.ceil(total / 25);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">🎯 Лиды</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filters.stage}
          onChange={(e) => { setFilters((f) => ({ ...f, stage: e.target.value })); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Все стадии</option>
          {STAGES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Фильтр по кампании..."
          value={filters.campaign}
          onChange={(e) => { setFilters((f) => ({ ...f, campaign: e.target.value })); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />

        <span className="flex items-center text-sm text-gray-400">
          Всего: {total}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Загрузка...</div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Лиды не найдены</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Имя</th>
                <th className="px-6 py-3">Компания</th>
                <th className="px-6 py-3">Должность</th>
                <th className="px-6 py-3">Стадия</th>
                <th className="px-6 py-3">Владелец</th>
                <th className="px-6 py-3">Кампания</th>
                <th className="px-6 py-3">Создан</th>
                <th className="px-6 py-3">LinkedIn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium">{lead.name}</td>
                  <td className="px-6 py-4 text-gray-600">{lead.company || '—'}</td>
                  <td className="px-6 py-4 text-gray-600 max-w-[200px] truncate">{lead.title || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[lead.stage] || ''}`}>
                      {lead.stage}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{lead.owner_name || '—'}</td>
                  <td className="px-6 py-4">
                    {lead.campaign_tag ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-600">
                        {lead.campaign_tag}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-xs">
                    {new Date(lead.created_at).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-6 py-4">
                    <a
                      href={lead.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-500 hover:text-brand-600 text-xs"
                    >
                      Профиль ↗
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
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            ← Назад
          </button>
          <span className="text-sm text-gray-500">
            Стр. {page} из {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Вперёд →
          </button>
        </div>
      )}
    </div>
  );
}
