import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | BuildMate",
  description: "Privacy and data protection policy for the BuildMate platform.",
};

export default function PrivacyPage() {
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
              Data Security &amp; Privacy
            </span>
            <h1 className="font-heading font-black text-4xl text-black tracking-tighter">
              Privacy Policy
            </h1>
            <p className="text-xs font-bold text-black/60 mt-1 uppercase tracking-wider">
              Effective Date: September 2026 • Encrypted Data Protection
            </p>
          </div>

          <div className="space-y-6 text-sm sm:text-base leading-relaxed text-black/90 font-medium">
            <section>
              <h2 className="font-heading font-black text-xl text-black mb-2">1. Data We Collect</h2>
              <p>
                BuildMate collects user account information (full name, email address, password hashes), project specifications, transaction references, and payment proof screenshots. Passwords are never stored in plain text and are hashed using modern Argon2id algorithms.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-black text-xl text-black mb-2">2. Ephemeral Storage of Payment Proofs</h2>
              <div className="rounded-2xl bg-[#ffe17c]/40 border-2 border-black p-5 neo-shadow-sm">
                <p className="font-heading font-black text-sm uppercase text-black mb-1">
                  Time-Limited Presigned Access:
                </p>
                <p className="text-sm text-black/90">
                  Screenshots and receipts submitted as payment proofs are stored securely in dedicated object storage. To protect user financial privacy, download and inspection URLs are short-lived and presigned on-demand with restricted time-to-live (TTL) limits. Permanent direct download links are never exposed.
                </p>
              </div>
            </section>

            <section>
              <h2 className="font-heading font-black text-xl text-black mb-2">3. Session Security &amp; Cookies</h2>
              <p>
                Authentication state is maintained exclusively using HttpOnly, SameSite session cookies containing opaque server-generated tokens. We do not store sensitive user claims or JWT credentials in client-accessible browser storage.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-black text-xl text-black mb-2">4. Third-Party Services</h2>
              <p>
                We do not sell user data to data brokers or third parties. We utilize transactional infrastructure solely for operational fulfillment: secure cloud storage (AWS S3 / Cloudflare R2), rate limiting (Upstash Redis), and transactional emails (Resend).
              </p>
            </section>
          </div>

          <div className="pt-6 border-t-2 border-black/10 flex justify-between items-center text-xs font-bold text-black/60">
            <span>&copy; {new Date().getFullYear()} BuildMate Escrow Platform</span>
            <Link href="/terms" className="text-black underline font-black">
              View Terms of Service →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
