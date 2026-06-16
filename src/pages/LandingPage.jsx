import { Link } from 'react-router-dom'

const CARDS = [
  { id: 1, title: 'Design empty states', tag: 'UI', col: 0 },
  { id: 2, title: 'Write webhook handler', tag: 'API', col: 0 },
  { id: 3, title: 'Fix RLS policy bug', tag: 'DB', col: 1 },
  { id: 4, title: 'Realtime chat sync', tag: 'RT', col: 1, dragging: true },
  { id: 5, title: 'Ship landing page', tag: 'WEB', col: 2 },
  { id: 6, title: 'Set up billing', tag: 'PAY', col: 2 },
]

const COLUMNS = ['To do', 'In progress', 'Done']

function MiniBoard() {
  return (
    <div className="relative">
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {COLUMNS.map((label, colIdx) => (
          <div key={label} className="bg-[#F1EFE7] rounded-xl p-2.5 sm:p-3">
            <p className="font-mono text-[10px] sm:text-xs uppercase tracking-wider text-[#8A8F98] mb-2 px-1">
              {label} · {CARDS.filter((c) => c.col === colIdx).length}
            </p>
            <div className="space-y-2">
              {CARDS.filter((c) => c.col === colIdx).map((card) => (
                <div
                  key={card.id}
                  className={`bg-white rounded-lg p-2.5 sm:p-3 shadow-sm border border-black/5 ${
                    card.dragging
                      ? 'relative -translate-y-1 rotate-[-1.5deg] shadow-lg ring-1 ring-[#6E56CF]/30 z-10'
                      : ''
                  }`}
                >
                  <p className="text-xs sm:text-sm text-[#0F1115] font-medium leading-snug">{card.title}</p>
                  <span className="inline-block mt-1.5 font-mono text-[9px] sm:text-[10px] uppercase tracking-wide text-[#8A8F98] bg-[#FAFAF7] rounded px-1.5 py-0.5">
                    {card.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* drop shadow ghost trailing the dragging card, suggesting motion */}
      <div className="absolute left-[calc(33.33%+0.5rem)] top-[3.1rem] w-[28%] h-12 bg-[#6E56CF]/5 rounded-lg blur-sm pointer-events-none hidden sm:block" />
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="bg-[#FAFAF7] text-[#0F1115] min-h-screen">
      {/* Nav */}
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#0F1115] rounded-md flex items-center justify-center">
            <div className="w-2 h-2 bg-[#6E56CF] rounded-sm" />
          </div>
          <span className="font-semibold text-lg tracking-tight">Tasklane</span>
        </div>
        <nav className="flex items-center gap-6">
          <a href="#pricing" className="text-sm text-[#8A8F98] hover:text-[#0F1115] hidden sm:inline">
            Pricing
          </a>
          <Link to="/login" className="text-sm text-[#8A8F98] hover:text-[#0F1115]">
            Log in
          </Link>
          <Link
            to="/signup"
            className="text-sm bg-[#0F1115] text-white rounded-full px-4 py-2 hover:bg-[#0F1115]/90 transition-colors"
          >
            Get started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-10 sm:pt-16 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-[#6E56CF] mb-4">
              For small teams who ship
            </p>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] mb-5">
              Watch the work move.
            </h1>
            <p className="text-base sm:text-lg text-[#8A8F98] leading-relaxed mb-8 max-w-md">
              A board for your tasks, a thread for your team, and a plan that grows with you.
              No setup calls, no seat spreadsheets, no waiting on IT.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/signup"
                className="bg-[#6E56CF] text-white rounded-full px-6 py-3 text-sm font-medium hover:bg-[#6E56CF]/90 transition-colors"
              >
                Start for free
              </Link>
              <a href="#how" className="text-sm text-[#0F1115] underline underline-offset-4">
                See how it works
              </a>
            </div>
            <p className="text-xs text-[#8A8F98] mt-5">No credit card required · 3 members free, forever</p>
          </div>

          <div className="lg:pl-4">
            <MiniBoard />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-6xl mx-auto px-6 py-16 border-t border-black/5">
        <p className="font-mono text-xs uppercase tracking-wider text-[#6E56CF] mb-3">How it works</p>
        <div className="grid sm:grid-cols-3 gap-8 mt-6">
          <div>
            <h3 className="font-semibold mb-2">Drag tasks across lanes</h3>
            <p className="text-sm text-[#8A8F98] leading-relaxed">
              To do, in progress, review, done. Move work with a click and drag — everyone sees
              the change the instant it happens.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Talk where the work lives</h3>
            <p className="text-sm text-[#8A8F98] leading-relaxed">
              Team chat sits next to the board, not in a different app. Comment on a task or
              message the whole team without losing context.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Grow without re-platforming</h3>
            <p className="text-sm text-[#8A8F98] leading-relaxed">
              Start free with one project. Add projects, members, and file storage as your team
              grows — same board, same habits.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-16 border-t border-black/5">
        <p className="font-mono text-xs uppercase tracking-wider text-[#6E56CF] mb-3">Pricing</p>
        <h2 className="text-2xl font-semibold tracking-tight mb-8">Simple, by team size.</h2>
        <div className="grid sm:grid-cols-3 gap-5">
          <div className="border border-black/10 rounded-2xl p-6">
            <p className="font-medium text-[#8A8F98] mb-1">Free</p>
            <p className="text-3xl font-semibold mb-4">$0</p>
            <ul className="text-sm text-[#8A8F98] space-y-2 mb-6">
              <li>1 project</li>
              <li>3 team members</li>
            </ul>
            <Link
              to="/signup"
              className="block text-center text-sm border border-black/10 rounded-full py-2.5 hover:bg-black/[0.03]"
            >
              Start free
            </Link>
          </div>

          <div className="border-2 border-[#6E56CF] rounded-2xl p-6 relative">
            <span className="absolute -top-3 left-6 bg-[#6E56CF] text-white text-[10px] font-mono uppercase tracking-wide px-2 py-1 rounded-full">
              Most teams
            </span>
            <p className="font-medium text-[#8A8F98] mb-1">Pro</p>
            <p className="text-3xl font-semibold mb-4">
              $10<span className="text-sm font-normal text-[#8A8F98]">/mo</span>
            </p>
            <ul className="text-sm text-[#8A8F98] space-y-2 mb-6">
              <li>5 projects</li>
              <li>10 members per project</li>
              <li>Team chat</li>
            </ul>
            <Link
              to="/signup"
              className="block text-center text-sm bg-[#6E56CF] text-white rounded-full py-2.5 hover:bg-[#6E56CF]/90"
            >
              Start with Pro
            </Link>
          </div>

          <div className="border border-black/10 rounded-2xl p-6">
            <p className="font-medium text-[#8A8F98] mb-1">Company</p>
            <p className="text-3xl font-semibold mb-4">
              $29<span className="text-sm font-normal text-[#8A8F98]">/mo</span>
            </p>
            <ul className="text-sm text-[#8A8F98] space-y-2 mb-6">
              <li>Unlimited projects</li>
              <li>Unlimited members</li>
              <li>Team chat</li>
              <li>File uploads</li>
            </ul>
            <Link
              to="/signup"
              className="block text-center text-sm border border-black/10 rounded-full py-2.5 hover:bg-black/[0.03]"
            >
              Start with Company
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-10 border-t border-black/5 flex items-center justify-between">
        <span className="text-sm text-[#8A8F98]">© {new Date().getFullYear()} Tasklane</span>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-[#0F1115] rounded-md flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-[#6E56CF] rounded-sm" />
          </div>
        </div>
      </footer>
    </div>
  )
}