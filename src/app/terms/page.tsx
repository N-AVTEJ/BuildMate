import Link from "next/link";

export const metadata = {
  title: "Terms of Service | BuildMate",
  description: "Terms and conditions governing the use of BuildMate platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8 sm:p-12">
        <div className="mb-8 border-b border-gray-200 pb-6">
          <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-800 mb-2 inline-block">
            ← Return to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Terms of Service</h1>
          <p className="text-sm text-gray-500 mt-2">Effective Date: September 2026</p>
        </div>

        <div className="prose prose-blue max-w-none text-gray-700 space-y-6 text-sm sm:text-base leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">1. Overview and Acceptance</h2>
            <p>
              By accessing, registering with, or utilizing BuildMate (&quot;the Platform&quot;), clients, builders, and administrators agree to be bound by these Terms of Service. BuildMate operates as a milestone-managed software development and builder procurement platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">2. Non-Refundable Advance Payment Clause</h2>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-900">
              <p className="font-semibold mb-1">Advance Payment Non-Refundability Policy:</p>
              <p className="text-sm">
                Advance payments (typically 30% to 50% of the agreed total project quotation) are collected to secure builder resource allocation and cover initial design, architecture, and milestone setup. Once verified and the project transitions to <strong className="font-mono">IN_PROGRESS</strong> status, advance payments are strictly non-refundable, except where an administrator explicitly orders a refund following formal dispute adjudication.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">3. Admin Unavailability and Escalation (5-Business-Day Clause)</h2>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-blue-900">
              <p className="font-semibold mb-1">Administrative Timelines &amp; 5-Business-Day Safeguard:</p>
              <p className="text-sm">
                Platform administrators are responsible for verifying payment proofs, reviewing change requests, and resolving disputes. If a pending verification or dispute remains unaddressed by platform administrators for more than five (5) consecutive business days, the affected client or builder may invoke dispute cancellation, request automated escalation, or withdraw open disputes back to the pre-dispute project milestone to avoid permanent escrow or delivery lockup.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">4. Milestone and Delivery Security</h2>
            <p>
              Project deliverables (source code, repository access, documentation, and live deployment credentials) remain strictly locked on the server until the final payment is submitted by the client and verified by a platform administrator. Unlocking deliverables requires meeting all seven delivery security invariants enforced by the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">5. Project Integrity and Academic Honesty</h2>
            <p>
              Users must certify that project specifications represent legitimate work requirements. Misrepresenting identity, uploading malicious binaries, attempting path traversal, or spoofing server timestamps constitutes a material violation of these Terms and results in immediate account termination.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
