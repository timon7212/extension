'use client';

import { useState, useEffect, useCallback } from 'react';

const API_BASE = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || '/api')
  : 'http://localhost:3001/api';
const API_KEY = 'outreach-internal-key';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [employeeFilter, setEmployeeFilter] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/analytics/employees`, { headers: { 'X-API-Key': API_KEY } });
        const data = await res.json();
        setEmployees(data.employees || []);
      } catch {}
    })();
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (statusFilter) params.set('status', statusFilter);
      if (employeeFilter) params.set('employee_id', employeeFilter);
      const res = await fetch(`${API_BASE}/tasks?${params}`, { headers: { 'X-API-Key': API_KEY } });
      const data = await res.json();
      setTasks(data.tasks || []);
      setTotal(data.total || 0);
    } catch { console.error('Failed to fetch tasks'); }
    finally { setLoading(false); }
  }, [statusFilter, employeeFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const overdueCount = tasks.filter(t => t.status === 'open' && new Date(t.due_at) < new Date()).length;

  return (
    <div>
      {/* Header */}
      <div className="mb-8 animate-slide-up">
        <p className="text-xs font-semibold text-ink-400 uppercase tracking-widest mb-1">Workflow</p>
        <div className="flex items-end justify-between">
          <h1 className="text-[28px] font-bold text-ink-900 tracking-tight">Tasks</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-400 font-medium">{total} tasks</span>
            {overdueCount > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-red-500 bg-red-50 px-2.5 py-1 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse-soft" />
                {overdueCount} overdue
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <div className="flex gap-1">
          {[
            { val: 'open', label: 'Open', icon: '○' },
            { val: 'done', label: 'Done', icon: '✓' },
            { val: '', label: 'All', icon: null },
          ].map(({ val, label, icon }) => (
            <button key={val} onClick={() => setStatusFilter(val)}
                    className={`pill-btn flex items-center gap-1.5 ${
                      statusFilter === val
                        ? 'bg-ink-900 text-white shadow-md'
                        : 'bg-white border border-surface-200 text-ink-500 hover:border-brand-300 shadow-sm'
                    }`}>
              {icon && <span className="text-[10px]">{icon}</span>}
              {label}
            </button>
          ))}
        </div>

        <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}
                className="ml-auto px-4 py-2.5 border border-surface-200 rounded-xl text-[13px] bg-white
                           focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400
                           shadow-sm transition-all text-ink-600">
          <option value="">All team members</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden animate-slide-up" style={{ animationDelay: '0.1s' }}>
        {loading ? (
          <div className="p-20 text-center">
            <div className="w-8 h-8 mx-auto border-2 border-surface-200 border-t-brand-500 rounded-full animate-spin mb-3" />
            <p className="text-sm text-ink-400">Loading tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-100 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <p className="text-sm font-medium text-ink-500">All clear!</p>
            <p className="text-xs text-ink-300 mt-1">No tasks match your filters</p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[10px] font-bold text-ink-300 uppercase tracking-wider border-b border-surface-100">
                <th className="px-5 py-3.5 w-10" />
                <th className="px-5 py-3.5">Task</th>
                <th className="px-5 py-3.5">Lead</th>
                <th className="px-5 py-3.5">Assigned</th>
                <th className="px-5 py-3.5">Due</th>
                <th className="px-5 py-3.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, i) => {
                const overdue = task.status === 'open' && new Date(task.due_at) < new Date();
                const isToday = task.status === 'open' && isDateToday(task.due_at);
                return (
                  <tr key={task.id}
                      className={`border-b border-surface-50 transition-colors group table-row-enter ${overdue ? 'bg-red-50/40' : 'hover:bg-brand-50/30'}`}
                      style={{ animationDelay: `${i * 0.02}s` }}>
                    <td className="px-5 py-4">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold
                        ${task.status === 'done' ? 'bg-emerald-100 text-emerald-600' :
                          overdue ? 'bg-red-100 text-red-500' :
                          isToday ? 'bg-amber-100 text-amber-600' :
                          'bg-surface-100 text-ink-300'}`}>
                        {task.status === 'done' ? '✓' : overdue ? '!' : isToday ? '•' : '○'}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-medium ${task.status === 'done' ? 'text-ink-300 line-through' : 'text-ink-800'}`}>
                        {task.type}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-ink-700">{task.lead_name || '—'}</p>
                      {task.lead_company && <p className="text-[11px] text-ink-400">{task.lead_company}</p>}
                    </td>
                    <td className="px-5 py-4 text-ink-500 text-[12px]">{task.employee_name || '—'}</td>
                    <td className="px-5 py-4">
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${
                        overdue ? 'bg-red-100 text-red-600' :
                        isToday ? 'bg-amber-100 text-amber-700' :
                        task.status === 'done' ? 'text-ink-300' : 'text-ink-500 bg-surface-100'
                      }`}>
                        {formatDue(task.due_at)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {task.linkedin_url && (
                        <a href={task.linkedin_url} target="_blank" rel="noopener noreferrer"
                           className="opacity-0 group-hover:opacity-100 text-brand-500 text-[11px] font-semibold transition-all">↗</a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function isDateToday(dateStr) {
  const d = new Date(dateStr); const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function formatDue(dateStr) {
  const d = new Date(dateStr); const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((dateStart - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < -1) return `${Math.abs(diff)}d overdue`;
  if (diff <= 7) return `In ${diff}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
