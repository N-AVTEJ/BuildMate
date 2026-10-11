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
              The high-trust escrow development platform. Milestone-gated deposits, verified code releases, and strict scope locking for modern software engineering.
            </p>
            {/* Social Icons */}
            <div className="flex items-center gap-3 pt-2">
              {[
                { name: "𝕏", href: "https://x.com" },
                { name: "GH", href: "https://github.com/N-AVTEJ/BuildMate" },
                { name: "IN", href: "https://linkedin.com" },
                { name: "DS", href: "https://discord.com" },
              ].map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="w-10 h-10 bg-[#272727] border-2 border-[#b7c6c2]/40 text-xs font-bold font-heading text-white flex items-center justify-center hover:bg-[#ffe17c] hover:text-black hover:border-black transition neo-shadow-sm"
                  aria-label={s.name}
                >
                  {s.name}
                </a>
              ))}
            </div>
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
                <Link href="/builder/apply" className="hover:text-[#ffe17c] transition">
                  Builder Network (Invite-Only) →
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

          {/* Column 3: Platform & Escrow */}
          <div>
            <h3 className="font-heading font-black text-sm tracking-wider uppercase text-white mb-4">
              Escrow Architecture
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <span className="text-white font-medium">30% Advance Escrow</span>
                <span className="block text-xs text-[#b7c6c2]/60">Released on formal scope lock</span>
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
            &copy; {new Date().getFullYear()} BuildMate Platform. Built with Neo-Brutalist Escrow Security.
          </div>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="hover:text-white transition">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
            <Link href="/login" className="hover:text-white transition">Sign In</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
