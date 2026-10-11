import Link from "next/link";

export const metadata = {
  title: "Terms of Service | BuildMate",
  description: "Terms and conditions governing the use of BuildMate platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#ffe17c] neo-dots flex flex-col justify-between font-body text-[#171e19] selection:bg-black selection:text-white">
      {/* Top Header */}
      <header className="bg-[#ffe17c] border-b-2 border-black h-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-black border-2 border-black flex items-center justify-center neo-shadow-sm group-hover:rotate-6 transition-transform">
              <span className="text-[#ffe17c] font-black text-xl">⚡</span>
            </div>
            <span className="font-heading font-black text-2xl tracking-tighter text-black">
              Build<span className="underline decoration-black decoration-wavy decoration-2">Mate</span>
            </span>
          </Link>
          <div className="flex items-center gap-4 text-sm font-bold">
            <Link
              href="/"
              className="text-black hover:underline transition"
            >
              ← Return Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Legal Content */}
      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <div className="bg-white rounded-3xl p-8 sm:p-12 border-2 border-black neo-shadow-lg space-y-8">
          <div className="border-b-2 border-black/10 pb-6">
            <span className="inline-block px-3 py-1 bg-[#b7c6c2] border-2 border-black rounded-full text-xs font-black uppercase tracking-wider mb-3 neo-shadow-sm">
              Platform Governance
            </span>
            <h1 className="font-heading font-black text-4xl text-black tracking-tighter">
              Terms of Service
            </h1>
            <p className="text-xs font-bold text-black/60 mt-1 uppercase tracking-wider">
              Effective Date: September 2026 • Version 1.0 Escrow Standard
            </p>
          </div>

          <div className="space-y-6 text-sm sm:text-base leading-relaxed text-black/90 font-medium">
            <section>
              <h2 className="font-heading font-black text-xl text-black mb-2">1. Overview and Acceptance</h2>
              <p>
                By accessing, registering with, or utilizing BuildMate (&quot;the Platform&quot;), clients, builders, and administrators agree to be bound by these Terms of Service. BuildMate operates as a milestone-managed software development and builder procurement platform.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-black text-xl text-black mb-2">2. Non-Refundable Advance Payment Clause</h2>
              <div className="rounded-2xl bg-[#ffe17c]/40 border-2 border-black p-5 neo-shadow-sm">
                <p className="font-heading font-black text-sm uppercase text-black mb-1">
                  Advance Payment Non-Refundability Policy:
                </p>
                <p className="text-sm text-black/90">
                  Advance payments (typically 30% to 50% of the agreed total project quotation) are collected to secure builder resource allocation and cover initial design, architecture, and milestone setup. Once verified and the project transitions to <strong className="font-mono font-bold bg-white px-1.5 py-0.5 border border-black rounded">IN_PROGRESS</strong> status, advance payments are strictly non-refundable, except where an administrator explicitly orders a refund following formal dispute adjudication.
                </p>
              </div>
            </section>

            <section>
              <h2 className="font-heading font-black text-xl text-black mb-2">3. Admin Unavailability and Escalation (5-Business-Day Clause)</h2>
              <div className="rounded-2xl bg-[#b7c6c2]/40 border-2 border-black p-5 neo-shadow-sm">
                <p className="font-heading font-black text-sm uppercase text-black mb-1">
                  5-Business-Day Resolution Commitment:
                </p>
                <p className="text-sm text-black/90">
                  BuildMate administrators commit to reviewing, mediating, and rendering a final determination on all submitted disputes within five (5) business days of dispute initiation. If an assigned administrator becomes unresponsive or fails to act within this SLA, the dispute automatically escalates to senior supervisory review.
                </p>
              </div>
            </section>

            <section>
              <h2 className="font-heading font-black text-xl text-black mb-2">4. Code Delivery Gate &amp; Deliverables Protection</h2>
              <p>
                Repository source code, build artifacts, and deliverables remain locked behind platform delivery security gates until the client validates delivery acceptance and final milestone settlement has been verified.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-black text-xl text-black mb-2">5. User Conduct and Integrity</h2>
              <p>
                Users agree not to bypass the platform for off-platform payment avoidance, submit fraudulent proof receipts, or harass counter-parties. Violations result in immediate account suspension and escrow forfeiture.
              </p>
            </section>
          </div>

          <div className="pt-6 border-t-2 border-black/10 flex justify-between items-center text-xs font-bold text-black/60">
            <span>&copy; {new Date().getFullYear()} BuildMate Escrow Platform</span>
            <Link href="/privacy" className="text-black underline font-black">
              View Privacy Policy →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
