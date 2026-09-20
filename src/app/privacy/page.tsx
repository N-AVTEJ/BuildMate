import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | BuildMate",
  description: "Privacy and data protection policy for the BuildMate platform.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8 sm:p-12">
        <div className="mb-8 border-b border-gray-200 pb-6">
          <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-800 mb-2 inline-block">
            ← Return to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mt-2">Effective Date: September 2026</p>
        </div>

        <div className="prose prose-blue max-w-none text-gray-700 space-y-6 text-sm sm:text-base leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">1. Data We Collect</h2>
            <p>
              BuildMate collects user account information (full name, email address, password hashes), project specifications, transaction references, and payment proof screenshots. Passwords are never stored in plain text and are hashed using modern Argon2id algorithms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">2. Ephemeral Storage of Payment Proofs</h2>
            <p>
              Screenshots and receipts submitted as payment proofs are stored securely in dedicated object storage. To protect user financial privacy, download and inspection URLs are short-lived and presigned on-demand with restricted time-to-live (TTL) limits. Permanent direct download links are never exposed.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">3. Session Security &amp; Cookies</h2>
            <p>
              Authentication state is maintained exclusively using HttpOnly, SameSite session cookies containing opaque server-generated tokens. We do not store sensitive user claims or JWT credentials in client-accessible browser storage.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">4. Third-Party Services</h2>
            <p>
              BuildMate interacts with transactional email providers (Resend) for mandatory verification links, and Redis/Upstash for distributed IP rate-limiting defense. We do not sell user data to advertising or marketing third parties.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
