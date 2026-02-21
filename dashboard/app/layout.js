import './globals.css';

export const metadata = {
  title: 'Outreach Dashboard',
  description: 'Internal outreach management dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex">
          {/* Sidebar */}
          <aside className="w-60 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0">
            <div className="px-5 py-5 border-b border-slate-800">
              <h1 className="text-lg font-bold text-white tracking-tight">📋 Outreach</h1>
              <p className="text-[10px] text-slate-500 mt-0.5 tracking-wide uppercase">Management Dashboard</p>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5">
              <a href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-white/5 hover:text-white transition-colors">
                <span className="text-base">📊</span> Overview
              </a>
              <a href="/leads" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-white/5 hover:text-white transition-colors">
                <span className="text-base">🎯</span> Leads
              </a>
              <a href="/tasks" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-white/5 hover:text-white transition-colors">
                <span className="text-base">✅</span> Tasks
              </a>
              <a href="/employees" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-white/5 hover:text-white transition-colors">
                <span className="text-base">👥</span> Team
              </a>
            </nav>
            <div className="px-5 py-3 border-t border-slate-800 text-[10px] text-slate-600">
              v1.2.0 — Internal Tool
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto px-6 py-6">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
