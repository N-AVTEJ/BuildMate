import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col selection:bg-blue-100 selection:text-blue-900">
      {/* 1. Public Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 font-black text-xl sm:text-2xl tracking-tight text-gray-900">
              <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                B
              </span>
              <span>Build<span className="text-blue-600">Mate</span></span>
            </Link>
            <span className="hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              V1 Escrow Guard
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#how-it-works" className="hover:text-blue-600 transition">How It Works</a>
            <a href="#features" className="hover:text-blue-600 transition">Features</a>
            <a href="#workflows" className="hover:text-blue-600 transition">Workflows</a>
            <a href="#security" className="hover:text-blue-600 transition">Security & Trust</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-3.5 py-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition active:scale-95"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* 2. Hero Section */}
        <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28 bg-gradient-to-b from-blue-50/50 via-white to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100/80 border border-blue-200/80 text-blue-800 text-xs sm:text-sm font-semibold mb-8 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                Verified Software Procurement &amp; Delivery Gate
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 leading-[1.12]">
                Software Development With{" "}
                <span className="text-blue-600 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                  Milestone-Locked
                </span>{" "}
                Security
              </h1>

              <p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed">
                Connect with verified software builders, lock project specifications, safeguard advance deposits in escrow, and release final payment only after verified code delivery.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/projects/new"
                  className="w-full sm:w-auto px-6 py-3.5 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md hover:shadow-lg transition text-center"
                >
                  Post a Project
                </Link>
                <Link
                  href="/register"
                  className="w-full sm:w-auto px-6 py-3.5 text-base font-semibold text-gray-800 bg-white hover:bg-gray-50 border border-gray-300 rounded-xl shadow-xs transition text-center"
                >
                  Become a Builder
                </Link>
              </div>

              <p className="mt-4 text-xs sm:text-sm text-gray-500">
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-blue-600 hover:underline">
                  Sign in here →
                </Link>
              </p>
            </div>

            {/* Trust Highlights Strip */}
            <div className="mt-16 sm:mt-20 max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 border-t border-b border-gray-200 py-8">
              <div className="text-center px-4">
                <div className="font-bold text-2xl text-gray-900">30% Advance</div>
                <div className="text-xs sm:text-sm text-gray-500 mt-1">Escrowed on Scope Lock</div>
              </div>
              <div className="text-center px-4 border-l border-gray-200">
                <div className="font-bold text-2xl text-gray-900">Locked Gates</div>
                <div className="text-xs sm:text-sm text-gray-500 mt-1">Code Withheld Until Verified</div>
              </div>
              <div className="text-center px-4 border-l border-gray-200">
                <div className="font-bold text-2xl text-gray-900">7 Invariants</div>
                <div className="text-xs sm:text-sm text-gray-500 mt-1">Enforced Delivery Security</div>
              </div>
              <div className="text-center px-4 border-l border-gray-200">
                <div className="font-bold text-2xl text-gray-900">5-Day SLA</div>
                <div className="text-xs sm:text-sm text-gray-500 mt-1">Admin Escalation Safeguard</div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. How BuildMate Works */}
        <section id="how-it-works" className="py-20 bg-gray-50 border-t border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-xs sm:text-sm font-bold tracking-widest text-blue-600 uppercase">
                Step-by-Step Architecture
              </h2>
              <p className="mt-2 text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                How BuildMate Protects Every Milestone
              </p>
              <p className="mt-4 text-base sm:text-lg text-gray-600">
                Our milestone state machine ensures both parties are protected against scope creep, unpaid revisions, and incomplete deliverables.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {/* Step 1 */}
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-xs relative">
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center mb-4">
                  01
                </div>
                <h3 className="text-lg font-bold text-gray-900">Define &amp; Post</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  Client defines technical specifications, budget boundaries, and timeline with mandatory integrity acknowledgement.
                </p>
                <span className="inline-block mt-4 text-xs font-mono font-semibold px-2 py-1 bg-gray-100 text-gray-700 rounded">
                  Status: AVAILABLE
                </span>
              </div>

              {/* Step 2 */}
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-xs relative">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center mb-4">
                  02
                </div>
                <h3 className="text-lg font-bold text-gray-900">Accept &amp; Quote</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  A verified builder accepts the project, submits a structured quotation, and locks the initial scope version.
                </p>
                <span className="inline-block mt-4 text-xs font-mono font-semibold px-2 py-1 bg-indigo-50 text-indigo-700 rounded">
                  Status: QUOTATION_SENT
                </span>
              </div>

              {/* Step 3 */}
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-xs relative">
                <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 font-bold flex items-center justify-center mb-4">
                  03
                </div>
                <h3 className="text-lg font-bold text-gray-900">Advance Escrow</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  Client submits 30% advance payment proof. Platform admin independently validates proof before builder initiates development.
                </p>
                <span className="inline-block mt-4 text-xs font-mono font-semibold px-2 py-1 bg-amber-50 text-amber-700 rounded">
                  Status: IN_PROGRESS
                </span>
              </div>

              {/* Step 4 */}
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-xs relative">
                <div className="w-10 h-10 rounded-lg bg-green-100 text-green-700 font-bold flex items-center justify-center mb-4">
                  04
                </div>
                <h3 className="text-lg font-bold text-gray-900">Gated Release</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  Builder submits code and deployment. Deliverable remains locked until final payment is verified, followed by client review.
                </p>
                <span className="inline-block mt-4 text-xs font-mono font-semibold px-2 py-1 bg-green-50 text-green-700 rounded">
                  Status: COMPLETED
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Key Platform Features */}
        <section id="features" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-xs sm:text-sm font-bold tracking-widest text-blue-600 uppercase">
                Core Capabilities
              </h2>
              <p className="mt-2 text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                Engineered for High-Trust Software Delivery
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-6 rounded-xl border border-gray-200 bg-white shadow-xs hover:border-blue-200 transition">
                <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4 text-xl">
                  🔒
                </div>
                <h3 className="text-xl font-bold text-gray-900">Sealed Delivery Gate</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  Source code repositories, branches, commit hashes, and credentials remain inaccessible to clients until final milestone payments are verified by platform admins.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-gray-200 bg-white shadow-xs hover:border-blue-200 transition">
                <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4 text-xl">
                  📝
                </div>
                <h3 className="text-xl font-bold text-gray-900">Formal Change Requests</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  Avoid scope creep. When features expand during development, builders submit formal change requests with atomic budget and timeline recalculations.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-gray-200 bg-white shadow-xs hover:border-blue-200 transition">
                <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4 text-xl">
                  💬
                </div>
                <h3 className="text-xl font-bold text-gray-900">Scoped Project Chat</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  Integrated messaging strictly scoped to project participants with automated server-side HTML and script sanitization to prevent injection attacks.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-gray-200 bg-white shadow-xs hover:border-blue-200 transition">
                <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4 text-xl">
                  ⚖️
                </div>
                <h3 className="text-xl font-bold text-gray-900">Admin Adjudication</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  Either party can raise a structured dispute. An independent administrator reviews versioned scopes and deliverables with a 5-business-day resolution safeguard.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-gray-200 bg-white shadow-xs hover:border-blue-200 transition">
                <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4 text-xl">
                  ⏱️
                </div>
                <h3 className="text-xl font-bold text-gray-900">Automated Expiry Windows</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  Acceptance and advance payment countdowns prevent stalled projects, using server-side lazy reconciliation to re-open abandoned requests.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-gray-200 bg-white shadow-xs hover:border-blue-200 transition">
                <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4 text-xl">
                  🛡️
                </div>
                <h3 className="text-xl font-bold text-gray-900">Strict Multi-Tenant Isolation</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  Zero cross-tenant information leakage. Centralized IDOR authorization ensures clients, builders, and administrators only access authorized entities.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Workflows: Client vs Builder */}
        <section id="workflows" className="py-20 bg-gray-50 border-t border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-xs sm:text-sm font-bold tracking-widest text-blue-600 uppercase">
                Role-Based Experiences
              </h2>
              <p className="mt-2 text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                Designed For Clients And Builders Alike
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Client Workflow */}
              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-xs">
                <div className="flex items-center gap-3 mb-6">
                  <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
                    C
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">For Clients</h3>
                    <p className="text-xs text-gray-500">Project Creators &amp; Buyers</p>
                  </div>
                </div>

                <ul className="space-y-4 text-sm text-gray-600">
                  <li className="flex items-start gap-3">
                    <span className="text-blue-600 font-bold mt-0.5">✓</span>
                    <span><strong>Full Budget Control:</strong> Specify min and max budget boundaries; builders cannot bid above your threshold.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-blue-600 font-bold mt-0.5">✓</span>
                    <span><strong>Escrow Protection:</strong> Advance payments remain guarded. No full payouts are triggered before verified milestones.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-blue-600 font-bold mt-0.5">✓</span>
                    <span><strong>Inspectable Deliverables:</strong> Receive complete GitHub repository URLs, branches, commit hashes, and demo deployments.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-blue-600 font-bold mt-0.5">✓</span>
                    <span><strong>Formal Dispute Redress:</strong> Escalate missing features or deviations directly to administrators.</span>
                  </li>
                </ul>

                <div className="mt-8 pt-6 border-t border-gray-100">
                  <Link
                    href="/projects/new"
                    className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-800"
                  >
                    Post a Project as Client →
                  </Link>
                </div>
              </div>

              {/* Builder Workflow */}
              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-xs">
                <div className="flex items-center gap-3 mb-6">
                  <span className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg">
                    B
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">For Builders</h3>
                    <p className="text-xs text-gray-500">Engineers &amp; Development Teams</p>
                  </div>
                </div>

                <ul className="space-y-4 text-sm text-gray-600">
                  <li className="flex items-start gap-3">
                    <span className="text-indigo-600 font-bold mt-0.5">✓</span>
                    <span><strong>Guaranteed Advance:</strong> 30% advance deposit is collected and confirmed before writing a single line of code.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-indigo-600 font-bold mt-0.5">✓</span>
                    <span><strong>Scope Lock Protection:</strong> Specifications are versioned. Clients cannot demand unpaid additions outside scope.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-indigo-600 font-bold mt-0.5">✓</span>
                    <span><strong>Code Protection:</strong> Your repository remains locked on the server until the client pays the remaining balance.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-indigo-600 font-bold mt-0.5">✓</span>
                    <span><strong>Fair Adjudication:</strong> Protection against unresponsive clients through administrative auto-resolution.</span>
                  </li>
                </ul>

                <div className="mt-8 pt-6 border-t border-gray-100">
                  <Link
                    href="/register"
                    className="inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Register as a Builder →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Security & Trust Messaging */}
        <section id="security" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-blue-950 text-white rounded-3xl p-8 sm:p-12 lg:p-16 shadow-xl relative overflow-hidden">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-6 border border-blue-400/30">
                  🛡️ Security Invariants
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                  Transparent Terms &amp; Escrow Integrity
                </h2>
                <p className="mt-4 text-base sm:text-lg text-gray-300 leading-relaxed">
                  BuildMate operates under clear, legally binding policies governing non-refundable advance deposits, 5-day administrative escalation safeguards, and 7 strict server-side delivery invariants.
                </p>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-300">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400 font-bold">•</span>
                    <span>Argon2id cryptographic password hashing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400 font-bold">•</span>
                    <span>HttpOnly SameSite session cookies</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400 font-bold">•</span>
                    <span>Server-enforced deadline calculations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400 font-bold">•</span>
                    <span>Short-lived presigned upload &amp; download tokens</span>
                  </div>
                </div>

                <div className="mt-10 flex flex-wrap gap-4">
                  <Link
                    href="/terms"
                    className="px-4 py-2 text-sm font-semibold text-gray-200 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition"
                  >
                    Read Terms of Service →
                  </Link>
                  <Link
                    href="/privacy"
                    className="px-4 py-2 text-sm font-semibold text-gray-200 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition"
                  >
                    Privacy Policy →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Bottom Call-To-Action Banner */}
        <section className="py-16 bg-blue-600 text-white text-center">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Ready to build software with complete milestone protection?
            </h2>
            <p className="mt-4 text-base sm:text-lg text-blue-100">
              Create your account now to post your project or discover verified software development opportunities.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="w-full sm:w-auto px-6 py-3.5 text-base font-semibold text-blue-700 bg-white hover:bg-blue-50 rounded-xl shadow-md transition"
              >
                Create an Account
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto px-6 py-3.5 text-base font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-xl transition"
              >
                Sign In to Portal
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
