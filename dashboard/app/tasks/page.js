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
    async function loadEmployees() {
      try {
        const res = await fetch(`${API_BASE}/analytics/employees`, {
          headers: { 'X-API-Key': API_KEY },
        });
        const data = await res.json();
        setEmployees(data.employees || []);
      } catch { /* ignore */ }
    }
    loadEmployees();
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (statusFilter) params.set('status', statusFilter);
      if (employeeFilter) params.set('employee_id', employeeFilter);

      const res = await fetch(`${API_BASE}/tasks?${params}`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const data = await res.json();
      setTasks(data.tasks || []);
      setTotal(data.total || 0);
    } catch {
      console.error('Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, employeeFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const overdueCount = tasks.filter(t => t.status === 'open' && new Date(t.due_at) < new Date()).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {total} tasks
            {overdueCount > 0 && <span className="text-[#d63031] font-semibold ml-1">· {overdueCount} overdue</span>}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1">
          {[
            { val: 'open', label: '🔵 Open' },
            { val: 'done', label: '✅ Done' },
            { val: '', label: 'All' },
          ].map(({ val, label }) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={`px-3.5 py-1.5 rounded-xl text-[12px] font-semibold transition-all ${
                statusFilter === val
                  ? 'bg-[#6c5ce7] text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-500 hover:border-[#6c5ce7]/30 hover:text-[#6c5ce7]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className="ml-auto px-4 py-2 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]/20 focus:border-[#6c5ce7] transition-all shadow-sm"
        >
          <option value="">All team members</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-gray-400">
            <div className="inline-block w-7 h-7 border-2 border-gray-200 border-t-[#6c5ce7] rounded-full animate-spin mb-3"></div>
            <p className="text-[13px]">Loading...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gray-50 flex items-center justify-center text-2xl">🎉</div>
            <p className="text-[13px] font-medium">No tasks found</p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-gray-50/60 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="px-5 py-3.5 w-10"></th>
                <th className="px-5 py-3.5">Task</th>
                <th className="px-5 py-3.5">Lead</th>
                <th className="px-5 py-3.5">Assigned To</th>
                <th className="px-5 py-3.5">Due</th>
                <th className="px-5 py-3.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tasks.map((task) => {
                const overdue = task.status === 'open' && new Date(task.due_at) < new Date();
                const isToday = task.status === 'open' && isDateToday(task.due_at);
                return (
                  <tr key={task.id} className={`transition-colors group ${overdue ? 'bg-red-50/40' : 'hover:bg-[#f7f8fc]'}`}>
                    <td className="px-5 py-3.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${
                        task.status === 'done' ? 'bg-emerald-50' :
                        overdue ? 'bg-red-50' :
                        isToday ? 'bg-orange-50' :
                        'bg-gray-50'
                      }`}>
                        {task.status === 'done' ? '✅' : overdue ? '🔴' : isToday ? '🟠' : '⬜'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`font-medium ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                        {task.type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-gray-700">{task.lead_name || '—'}</div>
                      {task.lead_company && <div className="text-[11px] text-gray-400">{task.lead_company}</div>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{task.employee_name || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[12px] font-semibold px-2.5 py-1 rounded-lg ${
                        overdue ? 'bg-red-100 text-red-700' :
                        isToday ? 'bg-orange-100 text-orange-700' :
                        task.status === 'done' ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {formatDue(task.due_at)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {task.linkedin_url && (
                        <a
                          href={task.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="opacity-0 group-hover:opacity-100 text-[#6c5ce7] hover:text-[#5a4bd1] text-[11px] font-semibold transition-opacity"
                        >
                          Open ↗
                        </a>
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
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function formatDue(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
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
