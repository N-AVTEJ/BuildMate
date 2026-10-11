import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-[#171e19] font-body selection:bg-[#ffe17c] selection:text-black">
      {/* =================================================================== */}
      {/* 1. FIXED HEADER (top-0, h-20, bg #ffe17c, border-b-2 border-black) */}
      {/* =================================================================== */}
      <header className="fixed top-0 left-0 right-0 z-50 h-20 bg-[#ffe17c] border-b-2 border-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-black border-2 border-black flex items-center justify-center neo-shadow-sm group-hover:rotate-6 transition-transform">
              <span className="text-[#ffe17c] font-black text-xl">⚡</span>
            </div>
            <span className="font-heading font-black text-2xl tracking-tighter text-black">
              Build<span className="underline decoration-black decoration-wavy decoration-2">Mate</span>
            </span>
          </Link>

          {/* Center: Navigation Links in bold Satoshi */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-bold text-black font-body">
            <a href="#problem-solution" className="hover:underline decoration-2 underline-offset-4 transition">
              Comparison
            </a>
            <a href="#features" className="hover:underline decoration-2 underline-offset-4 transition">
              Features
            </a>
            <a href="#how-it-works" className="hover:underline decoration-2 underline-offset-4 transition">
              How It Works
            </a>
            <a href="#personas" className="hover:underline decoration-2 underline-offset-4 transition">
              Solutions
            </a>
            <a href="#testimonials" className="hover:underline decoration-2 underline-offset-4 transition">
              Reviews
            </a>
          </nav>

          {/* Right: CTA Group */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-bold text-black hover:bg-black/5 rounded-lg transition"
            >
              Sign In
            </Link>
            <Link
              href="/start"
              className="neo-btn px-5 py-2.5 text-sm font-black font-heading tracking-wide uppercase bg-black text-white rounded-lg"
            >
              Start Free Trial →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content (offset for fixed h-20 header) */}
      <main className="pt-20">
        {/* =================================================================== */}
        {/* 2. HERO SECTION (Two-column, #ffe17c background with neo-dots)     */}
        {/* =================================================================== */}
        <section className="relative bg-[#ffe17c] neo-dots border-b-2 border-black py-16 sm:py-24 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              {/* Left Column: Heading, Badges, Role Chooser CTAs */}
              <div className="lg:col-span-7 space-y-6">
                {/* Pill Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border-2 border-black rounded-full text-xs font-black tracking-wider uppercase neo-shadow-sm">
                  <span className="w-2.5 h-2.5 bg-black rounded-full animate-ping" />
                  <span>NEW: AI Content &amp; Escrow Assistant 2.0</span>
                </div>

                {/* Main Heading in Cabinet Grotesk with text stroke keyword */}
                <h1 className="font-heading font-black text-5xl sm:text-6xl xl:text-7xl tracking-tighter text-black leading-[0.98]">
                  Software Delivery With{" "}
                  <span className="neo-text-stroke uppercase inline-block">Milestone-Locked</span>{" "}
                  Confidence.
                </h1>

                <p className="text-lg sm:text-xl font-medium text-black/80 max-w-xl leading-relaxed">
                  The Neo-Brutalist platform for high-trust software development. Lock project scope, escrow 30% advance deposits, and unlock code delivery only after verified reviews.
                </p>

                {/* Neo-Brutalist CTAs */}
                <div className="pt-2 flex flex-wrap items-center gap-4">
                  <Link
                    href="/start"
                    className="neo-btn-lg px-8 py-4 bg-black text-white font-heading font-black text-base sm:text-lg tracking-tight uppercase flex items-center gap-2"
                  >
                    <span>Choose Your Role</span>
                    <span>→</span>
                  </Link>

                  <Link
                    href="/login"
                    className="neo-btn px-6 py-3.5 bg-white text-black font-heading font-black text-base tracking-tight rounded-xl flex items-center gap-2"
                  >
                    <span>Client Sign In</span>
                    <span>⚡</span>
                  </Link>
                </div>

                {/* Embedded Role Quick Cards (Phase 13 Invariant) */}
                <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Card A: Client */}
                  <div className="bg-white border-2 border-black p-5 rounded-xl neo-shadow flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">🎓</span>
                        <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-[#b7c6c2] border border-black rounded">
                          Clients &amp; Students
                        </span>
                      </div>
                      <h3 className="font-heading font-black text-lg text-black">
                        I&apos;m a Client / Student
                      </h3>
                      <p className="text-xs text-black/70 mt-1 leading-normal">
                        Post software requirements, receive itemized builder quotes, and escrow payments securely.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-black/10 flex items-center justify-between">
                      <Link
                        href="/login"
                        className="text-xs font-black uppercase text-black hover:underline flex items-center gap-1"
                      >
                        Enter Client Portal →
                      </Link>
                      <Link href="/register" className="text-[11px] text-black/60 hover:underline">
                        Sign up
                      </Link>
                    </div>
                  </div>

                  {/* Card B: Builder */}
                  <div className="bg-[#b7c6c2] border-2 border-black p-5 rounded-xl neo-shadow flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">⚡</span>
                        <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-[#ffe17c] border border-black rounded">
                          Invite-Only
                        </span>
                      </div>
                      <h3 className="font-heading font-black text-lg text-black">
                        I&apos;m a Builder
                      </h3>
                      <p className="text-xs text-black/70 mt-1 leading-normal">
                        Join our curated engineering network. Guaranteed milestone payments with zero scope creep.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-black/10 flex items-center justify-between">
                      <Link
                        href="/builder/apply"
                        className="text-xs font-black uppercase text-black hover:underline flex items-center gap-1"
                      >
                        Apply as Builder →
                      </Link>
                      <Link href="/login" className="text-[11px] text-black/60 hover:underline">
                        Sign in
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Browser Mockup Dashboard Container */}
              <div className="lg:col-span-5">
                <div className="bg-white border-2 border-black rounded-2xl neo-shadow-xl overflow-hidden">
                  {/* Mockup Header Bar (Black, 3 colored dots) */}
                  <div className="bg-black px-4 py-3 flex items-center justify-between border-b-2 border-black">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#ff5f57] border border-black" />
                      <span className="w-3 h-3 rounded-full bg-[#febc2e] border border-black" />
                      <span className="w-3 h-3 rounded-full bg-[#28c840] border border-black" />
                    </div>
                    <span className="font-heading text-xs font-bold text-[#b7c6c2] tracking-wider uppercase">
                      buildmate.internal / escrow-gate
                    </span>
                    <span className="text-xs text-white/40 font-mono">v1.0</span>
                  </div>

                  {/* Mockup Content Body */}
                  <div className="p-6 bg-white space-y-4">
                    {/* Status Pill Strip */}
                    <div className="flex items-center justify-between bg-[#f4f4f5] border-2 border-black p-3 rounded-lg">
                      <div>
                        <span className="text-[10px] font-black uppercase text-black/60 block">Project Status</span>
                        <span className="font-heading font-black text-sm text-black">PRJ-4091: E-Commerce Escrow</span>
                      </div>
                      <span className="px-2.5 py-1 bg-[#ffe17c] border border-black font-heading font-black text-xs uppercase rounded">
                        ADVANCE_VERIFIED
                      </span>
                    </div>

                    {/* Milestone Stat Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#b7c6c2] border-2 border-black p-3.5 rounded-lg neo-shadow-sm">
                        <span className="text-[10px] font-black uppercase text-black/70 block">Escrow Protected</span>
                        <div className="font-heading font-black text-2xl text-black mt-0.5">₹42,500</div>
                        <span className="text-[10px] font-bold text-black/80 mt-1 block">30% advance locked</span>
                      </div>
                      <div className="bg-[#171e19] text-white border-2 border-black p-3.5 rounded-lg neo-shadow-sm">
                        <span className="text-[10px] font-black uppercase text-[#b7c6c2] block">Delivery Gate</span>
                        <div className="font-heading font-black text-2xl text-[#ffe17c] mt-0.5">LOCKED</div>
                        <span className="text-[10px] text-white/70 mt-1 block">Release on final review</span>
                      </div>
                    </div>

                    {/* Progress Chart Mockup */}
                    <div className="border-2 border-black p-4 rounded-xl space-y-2 bg-white">
                      <div className="flex justify-between items-center text-xs font-bold font-heading">
                        <span>Milestone Progress</span>
                        <span className="text-black">75% Complete</span>
                      </div>
                      <div className="w-full bg-[#f4f4f5] border border-black h-4 rounded-full overflow-hidden p-0.5">
                        <div className="bg-[#171e19] h-full rounded-full w-3/4 border-r border-black" />
                      </div>
                      <div className="flex justify-between text-[11px] text-black/60 pt-1">
                        <span>Stage 1: Architecture</span>
                        <span>Stage 2: Core API</span>
                        <span className="font-black text-black">Stage 3: Verification</span>
                      </div>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="bg-[#ffe17c] border-2 border-black p-3 rounded-lg flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                        Admin Verification Active
                      </span>
                      <span className="font-heading font-black uppercase underline">View Audit Log →</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 3. SOCIAL PROOF MARQUEE (Background #171e19, border-b-2 border-black) */}
        {/* =================================================================== */}
        <section className="bg-[#171e19] border-b-2 border-black py-5 overflow-hidden">
          <div className="relative flex overflow-x-hidden">
            <div className="animate-marquee whitespace-nowrap flex items-center gap-16 font-heading font-extrabold text-xl sm:text-2xl tracking-wider text-[#b7c6c2]/50 uppercase">
              <span>ACME CORP</span>
              <span>•</span>
              <span>GLOBEX INDUSTRIES</span>
              <span>•</span>
              <span>INITECH SYSTEMS</span>
              <span>•</span>
              <span>UMBRELLA SOFTWARE</span>
              <span>•</span>
              <span>HOOLI CLOUD</span>
              <span>•</span>
              <span>WAYSTAR LABS</span>
              <span>•</span>
              <span>SOYLENT DATA</span>
              <span>•</span>
              <span>MASSIVE DYNAMIC</span>
              <span>•</span>
              <span>CYBERDYNE DEV</span>
              <span>•</span>
              {/* Duplicate for infinite seamless scroll */}
              <span>ACME CORP</span>
              <span>•</span>
              <span>GLOBEX INDUSTRIES</span>
              <span>•</span>
              <span>INITECH SYSTEMS</span>
              <span>•</span>
              <span>UMBRELLA SOFTWARE</span>
              <span>•</span>
              <span>HOOLI CLOUD</span>
              <span>•</span>
              <span>WAYSTAR LABS</span>
              <span>•</span>
              <span>SOYLENT DATA</span>
              <span>•</span>
              <span>MASSIVE DYNAMIC</span>
              <span>•</span>
              <span>CYBERDYNE DEV</span>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 4. PROBLEM VS SOLUTION (White background, two 3xl-rounded cards)    */}
        {/* =================================================================== */}
        <section id="problem-solution" className="bg-white py-20 sm:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="px-3.5 py-1 bg-[#b7c6c2] border-2 border-black font-heading font-black text-xs uppercase tracking-wider rounded-full neo-shadow-sm">
                The Freelance Breakdown
              </span>
              <h2 className="font-heading font-black text-4xl sm:text-5xl text-black tracking-tighter mt-4">
                Why Traditional Hiring Breaks Down
              </h2>
              <p className="text-base sm:text-lg text-black/70 mt-3 font-medium">
                Ghosting, endless scope creep, unverified code, and payment friction cost weeks of wasted time.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
              {/* Card A: Problem (#f4f4f5, 2px dashed gray border, 70% opacity) */}
              <div className="bg-[#f4f4f5] border-2 border-dashed border-gray-400 opacity-75 rounded-3xl p-8 sm:p-10 flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 border border-red-300 rounded-full text-red-700 text-xs font-black uppercase mb-6">
                    <span>✕</span> The Broken Old Way
                  </div>
                  <h3 className="font-heading font-black text-2xl sm:text-3xl text-gray-800 tracking-tight mb-6">
                    Endless Uncertainty &amp; Payment Risk
                  </h3>
                  <ul className="space-y-4 text-sm sm:text-base text-gray-700 font-medium">
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-red-200 text-red-800 flex items-center justify-center font-bold shrink-0">✕</span>
                      <span><strong>Scope Creep Spiral:</strong> Clients change specs mid-flight, builder works unpaid hours, deadlines blow past.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-red-200 text-red-800 flex items-center justify-center font-bold shrink-0">✕</span>
                      <span><strong>Deposit Disasters:</strong> Paying 100% upfront leads to builder ghosting; paying 0% means builders don&apos;t start.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-red-200 text-red-800 flex items-center justify-center font-bold shrink-0">✕</span>
                      <span><strong>Broken Code Handover:</strong> ZIP archives shared over Telegram that fail to build when opened locally.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-red-200 text-red-800 flex items-center justify-center font-bold shrink-0">✕</span>
                      <span><strong>Zero Recourse:</strong> When things go sour, there is no mediation queue or transparent audit log.</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-8 pt-6 border-t border-gray-300 text-xs text-gray-500 font-mono">
                  RESULT: Lost budgets, delayed launches, mutual frustration.
                </div>
              </div>

              {/* Card B: Solution (#ffe17c, 2px solid black border, 8px hard shadow) */}
              <div className="bg-[#ffe17c] border-2 border-black rounded-3xl p-8 sm:p-10 neo-shadow-lg flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-black text-white border-2 border-black rounded-full text-xs font-black uppercase tracking-wider mb-6 neo-shadow-sm">
                    <span>✓</span> The BuildMate Standard
                  </div>
                  <h3 className="font-heading font-black text-2xl sm:text-3xl text-black tracking-tight mb-6">
                    Milestone Escrow &amp; Gated Verification
                  </h3>
                  <ul className="space-y-4 text-sm sm:text-base text-black font-medium">
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-black text-[#ffe17c] flex items-center justify-center font-black shrink-0 neo-shadow-sm">✓</span>
                      <span><strong>Contract Scope Lock:</strong> Requirements are cryptographically locked upon agreement. Any amendment requires formal Change Request.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-black text-[#ffe17c] flex items-center justify-center font-black shrink-0 neo-shadow-sm">✓</span>
                      <span><strong>30% Advance Escrow:</strong> Deposit held in neutral platform escrow; work commences with financial guarantees for both sides.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-black text-[#ffe17c] flex items-center justify-center font-black shrink-0 neo-shadow-sm">✓</span>
                      <span><strong>Delivery Gate Security:</strong> Code repository access is locked until client review and final balance verification complete.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-black text-[#ffe17c] flex items-center justify-center font-black shrink-0 neo-shadow-sm">✓</span>
                      <span><strong>Admin Mediation Queue:</strong> Neutral admin mediator inspects status history and resolves disputes with transparent ledger records.</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-8 pt-6 border-t-2 border-black flex items-center justify-between">
                  <span className="font-heading font-black text-xs uppercase tracking-wider text-black">
                    STANDARD: Guaranteed delivery or escrow refund
                  </span>
                  <Link href="/start" className="neo-btn px-4 py-2 bg-black text-white font-heading font-black text-xs uppercase rounded-lg">
                    Get Started →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 5. FEATURE GRID (#ffe17c background, border-y-2 border-black)      */}
        {/* =================================================================== */}
        <section id="features" className="bg-[#ffe17c] border-y-2 border-black py-20 sm:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="px-3.5 py-1 bg-white border-2 border-black font-heading font-black text-xs uppercase tracking-wider rounded-full neo-shadow-sm">
                Engineered for Integrity
              </span>
              <h2 className="font-heading font-black text-4xl sm:text-5xl text-black tracking-tighter mt-4">
                Built Around Hard Invariants
              </h2>
              <p className="text-base sm:text-lg text-black/80 mt-3 font-medium">
                Every feature is designed to eliminate ambiguity, safeguard milestone funds, and enforce verified delivery gates.
              </p>
            </div>

            {/* 3-Column Grid of White Cards with 2px border, 4px hard shadow */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: "🔒",
                  title: "Scope Lock Protocol",
                  desc: "Immutable requirement versioning. Specifications cannot be silently updated mid-sprint without mutual agreement.",
                },
                {
                  icon: "💳",
                  title: "30% Advance Escrow",
                  desc: "Automated deposit formulas ensure builders never work on speculative promises while keeping clients protected.",
                },
                {
                  icon: "📦",
                  title: "Gated Code Delivery",
                  desc: "Repository and artifact presigned download links remain secured until final milestone inspection is approved.",
                },
                {
                  icon: "⏱️",
                  title: "Lazy Deadline Engine",
                  desc: "Deterministic status reconciliation handles expired acceptance or progress windows automatically without cron drift.",
                },
                {
                  icon: "⚖️",
                  title: "Dispute Mediation",
                  desc: "Centralized admin arbitration with complete timestamped audit trails of messages, quotes, and delivery attempts.",
                },
                {
                  icon: "⚡",
                  title: "Curated Builder Network",
                  desc: "Invite-only engineering talent vetted for modern stacks: Next.js 16, React 19, PostgreSQL, and scalable systems.",
                },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="bg-white border-2 border-black rounded-2xl p-8 neo-shadow flex flex-col justify-between group hover:-translate-y-1 transition-transform"
                >
                  <div>
                    {/* Top 16x16 icon box in #b7c6c2 that turns #ffe17c on hover */}
                    <div className="w-16 h-16 bg-[#b7c6c2] border-2 border-black rounded-xl flex items-center justify-center text-3xl mb-6 neo-shadow-sm group-hover:bg-[#ffe17c] transition-colors">
                      {feature.icon}
                    </div>
                    <h3 className="font-heading font-black text-2xl text-black tracking-tight mb-3">
                      {feature.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-black/70 font-medium">
                      {feature.desc}
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t-2 border-black/10 flex items-center justify-between text-xs font-bold">
                    <span className="font-mono text-black/50">0{i + 1} / INVARIANT</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 6. HOW IT WORKS (Dark Mode #171e19, 3-step horizontal flow)        */}
        {/* =================================================================== */}
        <section id="how-it-works" className="bg-[#171e19] text-white py-20 sm:py-28 border-b-2 border-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-20">
              <span className="px-3.5 py-1 bg-[#272727] text-[#ffe17c] border-2 border-[#ffe17c] font-heading font-black text-xs uppercase tracking-wider rounded-full neo-shadow-sm">
                Step-by-Step Lifecycle
              </span>
              <h2 className="font-heading font-black text-4xl sm:text-5xl text-white tracking-tighter mt-4">
                How BuildMate Works
              </h2>
              <p className="text-base sm:text-lg text-[#b7c6c2] mt-3 font-medium">
                Three clear, unambiguous stages designed to protect clients and builders at every milestone.
              </p>
            </div>

            {/* 3-Step Flow with 24x24 circles and connecting #272727 line */}
            <div className="relative">
              {/* Connecting line for desktop */}
              <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-1 bg-[#272727] -z-0" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10">
                {/* Step 1: Sage Border */}
                <div className="flex flex-col items-center text-center space-y-5">
                  <div className="w-24 h-24 rounded-full bg-[#171e19] border-4 border-[#b7c6c2] flex items-center justify-center neo-shadow text-3xl font-heading font-black text-[#b7c6c2]">
                    01
                  </div>
                  <div className="bg-[#272727] border-2 border-black p-6 rounded-2xl w-full text-left space-y-2 neo-shadow">
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-[#b7c6c2] text-black rounded font-heading">
                      Phase 1: Discovery
                    </span>
                    <h3 className="font-heading font-black text-xl text-white">
                      Scope &amp; Quotation
                    </h3>
                    <p className="text-xs sm:text-sm text-[#b7c6c2] leading-relaxed">
                      Client submits project specifications. A verified builder reviews, itemizes deliverable milestones, and locks in price and timeline.
                    </p>
                  </div>
                </div>

                {/* Step 2: Yellow Border */}
                <div className="flex flex-col items-center text-center space-y-5">
                  <div className="w-24 h-24 rounded-full bg-[#171e19] border-4 border-[#ffe17c] flex items-center justify-center neo-shadow text-3xl font-heading font-black text-[#ffe17c]">
                    02
                  </div>
                  <div className="bg-[#272727] border-2 border-black p-6 rounded-2xl w-full text-left space-y-2 neo-shadow">
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-[#ffe17c] text-black rounded font-heading">
                      Phase 2: Escrow Lock
                    </span>
                    <h3 className="font-heading font-black text-xl text-white">
                      30% Advance Escrow
                    </h3>
                    <p className="text-xs sm:text-sm text-[#b7c6c2] leading-relaxed">
                      Client deposits 30% advance deposit into escrow. The contract scope locks immediately, development begins, and updates are posted.
                    </p>
                  </div>
                </div>

                {/* Step 3: White Border */}
                <div className="flex flex-col items-center text-center space-y-5">
                  <div className="w-24 h-24 rounded-full bg-[#171e19] border-4 border-white flex items-center justify-center neo-shadow text-3xl font-heading font-black text-white">
                    03
                  </div>
                  <div className="bg-[#272727] border-2 border-black p-6 rounded-2xl w-full text-left space-y-2 neo-shadow">
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-white text-black rounded font-heading">
                      Phase 3: Delivery Gate
                    </span>
                    <h3 className="font-heading font-black text-xl text-white">
                      Verified Code Release
                    </h3>
                    <p className="text-xs sm:text-sm text-[#b7c6c2] leading-relaxed">
                      Builder posts delivery artifacts. Deliverable download gates unlock only when client approves review and final balance settles.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 7. USE CASE PERSONAS (White background, 3-column bento-style grid) */}
        {/* =================================================================== */}
        <section id="personas" className="bg-white py-20 sm:py-28 border-b-2 border-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="px-3.5 py-1 bg-[#ffe17c] border-2 border-black font-heading font-black text-xs uppercase tracking-wider rounded-full neo-shadow-sm">
                Built For Both Sides
              </span>
              <h2 className="font-heading font-black text-4xl sm:text-5xl text-black tracking-tighter mt-4">
                Tailored For Your Workflow
              </h2>
              <p className="text-base sm:text-lg text-black/70 mt-3 font-medium">
                Whether posting academic coursework, launching an MVP, or building full-time, BuildMate enforces trust.
              </p>
            </div>

            {/* 3-Column Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Card 1: Sage (#b7c6c2) */}
              <div className="bg-[#b7c6c2] border-2 border-black rounded-3xl p-8 neo-shadow flex flex-col justify-between">
                <div>
                  <div className="inline-block px-3 py-1 bg-white border-2 border-black rounded-full text-xs font-black uppercase tracking-wider mb-6 neo-shadow-sm">
                    🎓 Academic &amp; Students
                  </div>
                  <h3 className="font-heading font-black text-2xl text-black tracking-tight mb-3">
                    Students &amp; Capstone Teams
                  </h3>
                  <p className="text-sm text-black/80 font-medium leading-relaxed mb-6">
                    Get custom semester projects, research prototypes, and complex assignments engineered on time with step-by-step code walkthroughs.
                  </p>
                  <ul className="space-y-2.5 text-xs text-black/90 font-bold border-t border-black/20 pt-4">
                    <li>✓ Fixed price bids with no hidden surprises</li>
                    <li>✓ Clear deadline guarantee or refund</li>
                    <li>✓ Direct messaging with your builder</li>
                  </ul>
                </div>
                <div className="mt-8 pt-4">
                  <Link href="/login" className="neo-btn w-full py-3 bg-white text-black font-heading font-black text-xs uppercase tracking-wider rounded-xl text-center block">
                    Post Student Project →
                  </Link>
                </div>
              </div>

              {/* Card 2: Yellow (#ffe17c) with 8px hard shadow */}
              <div className="bg-[#ffe17c] border-2 border-black rounded-3xl p-8 neo-shadow-lg flex flex-col justify-between">
                <div>
                  <div className="inline-block px-3 py-1 bg-white border-2 border-black rounded-full text-xs font-black uppercase tracking-wider mb-6 neo-shadow-sm">
                    🚀 Founders &amp; Business
                  </div>
                  <h3 className="font-heading font-black text-2xl text-black tracking-tight mb-3">
                    Startups &amp; Product Teams
                  </h3>
                  <p className="text-sm text-black/80 font-medium leading-relaxed mb-6">
                    Commission production SaaS MVPs, integrations, and mobile architectures with airtight scope specifications and code inspection gates.
                  </p>
                  <ul className="space-y-2.5 text-xs text-black/90 font-bold border-t border-black/20 pt-4">
                    <li>✓ Verified modern stack implementations</li>
                    <li>✓ Milestone-based escrow releases</li>
                    <li>✓ Clean IP and repository transfers</li>
                  </ul>
                </div>
                <div className="mt-8 pt-4">
                  <Link href="/login" className="neo-btn-lg w-full py-3 bg-black text-white font-heading font-black text-xs uppercase tracking-wider rounded-xl text-center block">
                    Hire Verified Builder →
                  </Link>
                </div>
              </div>

              {/* Card 3: Dark Gray (#272727) with white text */}
              <div className="bg-[#272727] text-white border-2 border-black rounded-3xl p-8 neo-shadow flex flex-col justify-between">
                <div>
                  <div className="inline-block px-3 py-1 bg-white text-black border-2 border-black rounded-full text-xs font-black uppercase tracking-wider mb-6 neo-shadow-sm">
                    ⚡ Verified Engineers
                  </div>
                  <h3 className="font-heading font-black text-2xl text-white tracking-tight mb-3">
                    Independent Builders
                  </h3>
                  <p className="text-sm text-[#b7c6c2] font-medium leading-relaxed mb-6">
                    Never chase unpaid invoices again. Advance escrow is funded before you write code, and scope changes require paid amendments.
                  </p>
                  <ul className="space-y-2.5 text-xs text-[#b7c6c2] font-bold border-t border-white/20 pt-4">
                    <li>✓ 30% advance guaranteed before work begins</li>
                    <li>✓ Automatic protection from scope creep</li>
                    <li>✓ Zero platform fees on first milestone</li>
                  </ul>
                </div>
                <div className="mt-8 pt-4">
                  <Link href="/builder/apply" className="neo-btn w-full py-3 bg-[#ffe17c] text-black font-heading font-black text-xs uppercase tracking-wider rounded-xl text-center block">
                    Apply for Builder Network →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 8. TESTIMONIALS (Background #b7c6c2, asymmetric rounded cards)     */}
        {/* =================================================================== */}
        <section id="testimonials" className="bg-[#b7c6c2] py-20 sm:py-28 border-b-2 border-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="px-3.5 py-1 bg-white border-2 border-black font-heading font-black text-xs uppercase tracking-wider rounded-full neo-shadow-sm">
                Real Reviews
              </span>
              <h2 className="font-heading font-black text-4xl sm:text-5xl text-black tracking-tighter mt-4">
                Trusted by Clients &amp; Builders
              </h2>
              <p className="text-base sm:text-lg text-black/80 mt-3 font-medium">
                Here is what happens when contracts are backed by software escrow gates.
              </p>
            </div>

            {/* Grid of 3 white cards with Asymmetric Corner Rounding */}
            {/* Top-Right and Bottom-Left are 3xl, Top-Left and Bottom-Right are 2px */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  stars: 5,
                  quote:
                    "BuildMate completely solved my fear of outsourcing. The 30% escrow gave me confidence, and having code delivery locked until review was a game changer.",
                  author: "Rahul S.",
                  role: "Final Year CS Student",
                  avatar: "👨‍💻",
                },
                {
                  stars: 5,
                  quote:
                    "As a builder, getting stiffed on final payments used to ruin my quarters. BuildMate's scope lock and advance escrow ensure I always get paid for my engineering.",
                  author: "Elena Rostova",
                  role: "Full-Stack Builder",
                  avatar: "⚡",
                },
                {
                  stars: 5,
                  quote:
                    "Our seed-stage MVP went from idea to production in 3 weeks. No scope renegotiations, no ambiguity, just crisp milestone releases.",
                  author: "Marcus Vance",
                  role: "FinTech Founder",
                  avatar: "🚀",
                },
              ].map((testi, i) => (
                <div
                  key={i}
                  className="bg-white border-2 border-black p-8 neo-shadow rounded-tr-3xl rounded-bl-3xl rounded-tl-[2px] rounded-br-[2px] flex flex-col justify-between"
                >
                  <div>
                    {/* 5-star rating in #febc2e yellow */}
                    <div className="flex items-center gap-1 text-[#febc2e] text-lg mb-4">
                      {"★".repeat(testi.stars)}
                    </div>
                    <p className="text-sm sm:text-base text-black/80 font-medium italic leading-relaxed mb-6">
                      &ldquo;{testi.quote}&rdquo;
                    </p>
                  </div>
                  <div className="pt-4 border-t-2 border-black/10 flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#ffe17c] border border-black rounded-full flex items-center justify-center text-lg">
                      {testi.avatar}
                    </div>
                    <div>
                      <div className="font-heading font-black text-sm text-black">{testi.author}</div>
                      <div className="text-xs text-black/60">{testi.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 9. FINAL CTA (Background #ffe17c, large centered heading)          */}
        {/* =================================================================== */}
        <section className="bg-[#ffe17c] neo-dots py-24 sm:py-32">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            <div className="inline-block px-4 py-1.5 bg-black text-white border-2 border-black rounded-full text-xs font-black uppercase tracking-widest neo-shadow-sm">
              Ready to Upgrade Your Software Procurement?
            </div>

            <h2 className="font-heading font-black text-5xl sm:text-6xl lg:text-7xl tracking-tighter text-black leading-tight max-w-4xl mx-auto">
              Build Without Risk. Ship With Certainty.
            </h2>

            <p className="text-lg sm:text-xl font-medium text-black/80 max-w-2xl mx-auto leading-relaxed">
              Join students, founders, and verified engineers who develop with milestone escrow protection.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-4">
              <Link
                href="/start"
                className="neo-btn-lg w-full sm:w-auto px-10 py-5 bg-black text-white font-heading font-black text-lg tracking-tight uppercase flex items-center justify-center gap-3"
              >
                <span>Get Started Now</span>
                <span>→</span>
              </Link>
              <Link
                href="/builder/apply"
                className="neo-btn w-full sm:w-auto px-8 py-4 bg-white text-black font-heading font-black text-base tracking-tight rounded-xl flex items-center justify-center gap-2"
              >
                <span>Join Builder Network</span>
                <span>⚡</span>
              </Link>
            </div>

            <p className="text-xs font-bold text-black/60 pt-4">
              No credit card required to post requirements • Verified milestone protection guaranteed
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
