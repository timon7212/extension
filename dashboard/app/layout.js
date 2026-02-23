import './globals.css';

export const metadata = {
  title: 'Outreach',
  description: 'Internal outreach management platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="overflow-hidden">
        <div className="h-screen flex">
          {/* ── Sidebar ── Dark macOS-style */}
          <aside className="w-[240px] flex-shrink-0 bg-[#0f0f14] flex flex-col relative overflow-hidden">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a24] via-transparent to-transparent opacity-50 pointer-events-none" />

            {/* Logo */}
            <div className="relative z-10 px-6 pt-7 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-[#6e62e5] to-[#8b83ff] flex items-center justify-center shadow-lg shadow-[#6e62e5]/20">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-[15px] font-bold text-white tracking-tight leading-none">Outreach</h1>
                  <p className="text-[10px] text-white/30 mt-0.5 font-medium">Management Platform</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="relative z-10 flex-1 px-3 space-y-1">
              <p className="text-[10px] font-semibold text-white/20 uppercase tracking-widest px-3 mb-2">Menu</p>
              <NavItem href="/" label="Overview">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="2" />
                  <rect x="14" y="3" width="7" height="7" rx="2" />
                  <rect x="3" y="14" width="7" height="7" rx="2" />
                  <rect x="14" y="14" width="7" height="7" rx="2" />
                </svg>
              </NavItem>
              <NavItem href="/leads" label="Leads">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </NavItem>
              <NavItem href="/tasks" label="Tasks">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              </NavItem>
              <NavItem href="/employees" label="Team">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 4.354a4 4 0 1 1 0 7.292" />
                  <path d="M15 21H3v-1a6 6 0 0 1 12 0v1z" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  <path d="M21 21v-1a4 4 0 0 0-3-3.85" />
                </svg>
              </NavItem>
            </nav>

            {/* Footer */}
            <div className="relative z-10 px-6 py-4 border-t border-white/[0.04]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-soft" />
                <span className="text-[10px] text-white/25 font-medium">System online</span>
              </div>
            </div>
          </aside>

          {/* ── Main Content ── */}
          <main className="flex-1 overflow-auto bg-[#f5f6fa]">
            <div className="max-w-[1200px] mx-auto px-8 py-8 animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}

function NavItem({ href, label, children }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium
                 text-white/50 hover:text-white/90 hover:bg-white/[0.06]
                 transition-all duration-200 group"
    >
      <span className="text-white/30 group-hover:text-[#8b83ff] transition-colors duration-200">
        {children}
      </span>
      {label}
    </a>
  );
}
