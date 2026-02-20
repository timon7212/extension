import './globals.css';

export const metadata = {
  title: 'Outreach Dashboard',
  description: 'Internal outreach management dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        <div className="min-h-screen flex">
          {/* Sidebar navigation */}
          <aside className="w-64 bg-brand-700 text-white flex flex-col">
            <div className="p-6 border-b border-brand-600">
              <h1 className="text-xl font-bold">📋 Outreach</h1>
              <p className="text-xs text-brand-100 mt-1">Management Dashboard</p>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              <a href="/" className="block px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
                📊 Обзор
              </a>
              <a href="/employees" className="block px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
                👥 Сотрудники
              </a>
              <a href="/leads" className="block px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
                🎯 Лиды
              </a>
              <a href="/tasks" className="block px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
                ✅ Задачи
              </a>
            </nav>
            <div className="p-4 border-t border-brand-600 text-xs text-brand-100">
              v1.0.0 — Internal Tool
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-auto">
            <div className="p-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
