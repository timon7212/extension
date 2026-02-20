'use client';

import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState('open');
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`${API_BASE}/tasks?${params}`);
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch {
      console.error('Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">✅ Задачи</h1>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {['open', 'done', ''].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-brand-500 text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s === '' ? 'Все' : s === 'open' ? '🔵 Открытые' : '✅ Выполненные'}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Загрузка...</div>
        ) : tasks.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Задачи не найдены</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Статус</th>
                <th className="px-6 py-3">Тип задачи</th>
                <th className="px-6 py-3">Лид</th>
                <th className="px-6 py-3">Сотрудник</th>
                <th className="px-6 py-3">Срок</th>
                <th className="px-6 py-3">LinkedIn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tasks.map((task) => {
                const overdue = task.status === 'open' && new Date(task.due_at) < new Date();
                return (
                  <tr
                    key={task.id}
                    className={`hover:bg-gray-50 transition-colors ${overdue ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-6 py-4">
                      {task.status === 'done' ? (
                        <span className="text-green-500">✅</span>
                      ) : overdue ? (
                        <span className="text-red-500">⚠️</span>
                      ) : (
                        <span className="text-blue-500">🔵</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium">{task.type}</td>
                    <td className="px-6 py-4 text-gray-600">{task.lead_name || '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{task.employee_name || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium ${overdue ? 'text-red-600' : 'text-gray-500'}`}>
                        {new Date(task.due_at).toLocaleDateString('ru-RU')} {new Date(task.due_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {task.linkedin_url && (
                        <a
                          href={task.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-500 hover:text-brand-600 text-xs"
                        >
                          Профиль ↗
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
