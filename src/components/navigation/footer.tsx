import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-[#171e19] text-[#b7c6c2] border-t-2 border-black font-body">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Column 1: Brand & Bio */}
          <div className="space-y-4">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="w-10 h-10 bg-black border-2 border-white flex items-center justify-center neo-shadow-sm">
                <span className="text-[#ffe17c] font-black text-xl">⚡</span>
              </div>
              <span className="font-heading font-black text-2xl tracking-tighter text-white">
                Build<span className="text-[#ffe17c]">Mate</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-[#b7c6c2]/80">
              The high-trust software development platform. Milestone-based delivery, verified code releases, and strict scope locking for modern software engineering.
            </p>
          </div>

          {/* Column 2: Portals & Workflows */}
          <div>
            <h3 className="font-heading font-black text-sm tracking-wider uppercase text-white mb-4">
              Workspaces &amp; Roles
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/login" className="hover:text-[#ffe17c] transition">
                  Client &amp; Student Portal →
                </Link>
              </li>
              <li>
                <Link href="/builder/login" className="hover:text-[#ffe17c] transition">
                  Builder Portal Sign In ⚡
                </Link>
              </li>
              <li>
                <Link href="/builder/apply" className="hover:text-[#ffe17c] transition">
                  Apply for Builder Access →
                </Link>
              </li>
              <li>
                <Link href="/projects" className="hover:text-[#ffe17c] transition">
                  Active Projects
                </Link>
              </li>
              <li>
                <Link href="/start" className="hover:text-[#ffe17c] transition">
                  Role Chooser (/start)
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-[#ffe17c] transition">
                  Admin Control Center
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Platform & Milestones */}
          <div>
            <h3 className="font-heading font-black text-sm tracking-wider uppercase text-white mb-4">
              Milestone Architecture
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <span className="text-white font-medium">Phase-Wise Milestones</span>
                <span className="block text-xs text-[#b7c6c2]/60">Structured around verified deliverables</span>
              </li>
              <li>
                <span className="text-white font-medium">Code Delivery Gate</span>
                <span className="block text-xs text-[#b7c6c2]/60">Presigned repo release upon verification</span>
              </li>
              <li>
                <span className="text-white font-medium">Admin Mediation</span>
                <span className="block text-xs text-[#b7c6c2]/60">Neutral dispute resolution queue</span>
              </li>
              <li>
                <span className="text-white font-medium">Lazy Deadline Engine</span>
                <span className="block text-xs text-[#b7c6c2]/60">Real-time SLA reconciliation</span>
              </li>
            </ul>
          </div>

          {/* Column 4: Legal & Security */}
          <div>
            <h3 className="font-heading font-black text-sm tracking-wider uppercase text-white mb-4">
              Trust &amp; Governance
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/terms" className="hover:text-[#ffe17c] transition">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-[#ffe17c] transition">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/cancellation-refund" className="hover:text-[#ffe17c] transition">
                  Cancellation &amp; Refund Policy
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-[#ffe17c] transition">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/builder/apply" className="hover:text-[#ffe17c] transition">
                  Apply for Builder Access
                </Link>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-[#ffe17c] transition">
                  Verification Protocol
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t-2 border-black flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#b7c6c2]/60">
          <div>
            &copy; {new Date().getFullYear()} BuildMate Platform. Built with Neo-Brutalist Milestone Security.
          </div>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <Link href="/terms" className="hover:text-white transition">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
            <Link href="/cancellation-refund" className="hover:text-white transition">Refunds</Link>
            <Link href="/contact" className="hover:text-white transition">Contact</Link>
            <Link href="/login" className="hover:text-white transition">Sign In</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
