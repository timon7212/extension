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
          {/* Sidebar — Apollo-inspired clean dark */}
          <aside className="w-[220px] bg-[#1e1f2b] text-gray-400 flex flex-col flex-shrink-0 border-r border-[#2a2b3d]">
            {/* Logo */}
            <div className="px-5 py-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6c5ce7] to-[#a29bfe] flex items-center justify-center text-white text-sm font-bold shadow-md">
                  O
                </div>
                <div>
                  <h1 className="text-[15px] font-bold text-white leading-none">Outreach</h1>
                  <p className="text-[10px] text-gray-500 mt-0.5">Management Dashboard</p>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-2 space-y-0.5">
              <NavItem href="/" icon={<OverviewIcon />} label="Overview" />
              <NavItem href="/leads" icon={<LeadsIcon />} label="Leads" />
              <NavItem href="/tasks" icon={<TasksIcon />} label="Tasks" />
              <NavItem href="/employees" icon={<TeamIcon />} label="Team" />
            </nav>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[#2a2b3d] text-[10px] text-gray-600">
              v1.3.0 — Internal Tool
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-auto bg-[#f7f8fc]">
            <div className="max-w-7xl mx-auto px-8 py-7">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}

function NavItem({ href, icon, label }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium
                 hover:bg-white/[0.06] hover:text-white transition-all group"
    >
      <span className="w-5 h-5 text-gray-500 group-hover:text-[#a29bfe] transition-colors">
        {icon}
      </span>
      {label}
    </a>
  );
}

/* SVG Icons — minimal, Apollo-style */
function OverviewIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM5.5 9h2a.5.5 0 01.5.5v4a.5.5 0 01-.5.5h-2a.5.5 0 01-.5-.5v-4a.5.5 0 01.5-.5zm3.5-3h2a.5.5 0 01.5.5v7a.5.5 0 01-.5.5H9a.5.5 0 01-.5-.5v-7A.5.5 0 019 6zm3.5 1.5h2a.5.5 0 01.5.5v5.5a.5.5 0 01-.5.5h-2a.5.5 0 01-.5-.5V8a.5.5 0 01.5-.5z" />
    </svg>
  );
}

function LeadsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
    </svg>
  );
}
