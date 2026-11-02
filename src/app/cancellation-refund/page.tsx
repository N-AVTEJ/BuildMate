import Link from "next/link";

export const metadata = {
  title: "Cancellation & Refund Policy | BuildMate",
  description: "Cancellation, milestone return, and refund policies for the BuildMate platform.",
};

export default function CancellationRefundPage() {
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
              Consumer Protection &amp; Settlement
            </span>
            <h1 className="font-heading font-black text-4xl text-black tracking-tighter">
              Cancellation &amp; Refund Policy
            </h1>
            <p className="text-xs font-bold text-black/60 mt-1 uppercase tracking-wider">
              Last Updated: November 2026 • Compliant with RBI Payment Aggregator Guidelines
            </p>
          </div>

          <div className="space-y-6 text-sm sm:text-base leading-relaxed text-black/90 font-medium">
            <section>
              <h2 className="font-heading font-black text-xl text-black mb-2">1. Overview</h2>
              <p>
                BuildMate facilitates milestone-managed software development and software procurement between verified builders and clients. We believe in transparent, equitable commercial terms. This Cancellation and Refund Policy governs the circumstances and process under which payments may be cancelled or refunded.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-black text-xl text-black mb-2">2. Cancellation Policy</h2>
              <div className="rounded-2xl bg-[#fffdf0] border-2 border-black p-5 neo-shadow-sm space-y-3">
                <p>
                  <strong>Pre-Commencement Cancellation:</strong> Clients may cancel a project request at any time prior to accepting a builder&apos;s quotation without incurring any fee or financial charge.
                </p>
                <p>
                  <strong>Post-Milestone Cancellation:</strong> Once an initial milestone payment has been completed and the project has transitioned to <span className="font-mono font-bold bg-white px-1.5 py-0.5 border border-black rounded text-xs">IN_PROGRESS</span> status, cancellation requests must be submitted through our Dispute &amp; Mediation Center to assess completed deliverables.
                </p>
              </div>
            </section>

            <section>
              <h2 className="font-heading font-black text-xl text-black mb-2">3. Refund Eligibility &amp; Dispute Mediation</h2>
              <p>Refunds are evaluated and granted under the following conditions:</p>
              <ul className="list-disc pl-6 space-y-2 text-black/80 mt-2">
                <li>
                  <strong>Builder Inaction / Non-Performance:</strong> If a builder fails to commence development within the agreed SLA or fails to deliver work according to agreed scope specifications.
                </li>
                <li>
                  <strong>Mutual Cancellation:</strong> If both client and builder mutually agree to terminate the project prior to delivery milestones being completed.
                </li>
                <li>
                  <strong>Administrative Adjudication:</strong> If an administrative review of a formal dispute resolves in favor of the client following examination of project history and communications.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading font-black text-xl text-black mb-2">4. Refund Processing Timelines</h2>
              <div className="rounded-2xl bg-[#ffe17c]/40 border-2 border-black p-5 neo-shadow-sm">
                <p className="font-heading font-black text-sm uppercase text-black mb-1">
                  5 to 7 Business Days Processing Timeline:
                </p>
                <p className="text-sm text-black/90">
                  Approved refunds are initiated immediately by BuildMate administrators and will be credited to the customer&apos;s original payment method (Credit/Debit Card, Net Banking, UPI, or Wallet) within <strong>5 to 7 working days</strong>, subject to bank processing cycles.
                </p>
              </div>
            </section>

            <section>
              <h2 className="font-heading font-black text-xl text-black mb-2">5. How to Request a Refund or Cancellation</h2>
              <p>
                To initiate a cancellation or refund inquiry, you may open a dispute ticket directly within your project workspace or contact our support team at{" "}
                <a href="mailto:support@buildmate.dev" className="text-black font-black underline">
                  support@buildmate.dev
                </a>{" "}
                with your Project Code and transaction details.
              </p>
            </section>
          </div>

          <div className="pt-6 border-t-2 border-black/10 flex flex-wrap justify-between items-center gap-4 text-xs font-bold text-black/60">
            <span>&copy; {new Date().getFullYear()} BuildMate Platform</span>
            <div className="flex items-center gap-4">
              <Link href="/terms" className="text-black underline font-black">
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-black underline font-black">
                Privacy Policy
              </Link>
              <Link href="/contact" className="text-black underline font-black">
                Contact Support
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
