import Link from "next/link";

export const metadata = {
  title: "Contact Us | BuildMate",
  description: "Get in touch with the BuildMate team, customer support, and grievance officer.",
};

export default function ContactPage() {
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

      {/* Main Contact Content */}
      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <div className="bg-white rounded-3xl p-8 sm:p-12 border-2 border-black neo-shadow-lg space-y-8">
          <div className="border-b-2 border-black/10 pb-6">
            <span className="inline-block px-3 py-1 bg-[#b7c6c2] border-2 border-black rounded-full text-xs font-black uppercase tracking-wider mb-3 neo-shadow-sm">
              Customer Support &amp; Grievance
            </span>
            <h1 className="font-heading font-black text-4xl text-black tracking-tighter">
              Contact BuildMate
            </h1>
            <p className="text-xs font-bold text-black/60 mt-1 uppercase tracking-wider">
              We respond to inquiries within 24 to 48 business hours
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#fffdf0] border-2 border-black rounded-2xl p-6 neo-shadow-sm space-y-3">
              <span className="text-3xl block">📧</span>
              <h3 className="font-heading font-black text-lg text-black">General Support &amp; Billing</h3>
              <p className="text-xs text-black/70 font-medium">
                For questions regarding project milestones, checkout issues, or general platform inquiries:
              </p>
              <div className="pt-2">
                <a
                  href="mailto:support@buildmate.dev"
                  className="font-mono text-sm font-black text-black hover:underline block"
                >
                  support@buildmate.dev
                </a>
                <a
                  href="mailto:madipadiganavtej@gmail.com"
                  className="font-mono text-xs text-black/70 hover:underline block mt-0.5"
                >
                  madipadiganavtej@gmail.com
                </a>
              </div>
            </div>

            <div className="bg-[#b7c6c2]/30 border-2 border-black rounded-2xl p-6 neo-shadow-sm space-y-3">
              <span className="text-3xl block">⚖️</span>
              <h3 className="font-heading font-black text-lg text-black">Grievance &amp; Dispute Officer</h3>
              <p className="text-xs text-black/70 font-medium">
                Designated officer for administrative dispute escalation and regulatory compliance:
              </p>
              <div className="pt-2 font-medium text-xs text-black/90 space-y-1">
                <p><strong>Name:</strong> Navtej Madipadiga</p>
                <p><strong>Role:</strong> Grievance Redressal Officer</p>
                <p><strong>Email:</strong> grievances@buildmate.dev</p>
              </div>
            </div>
          </div>

          <div className="bg-[#ffe17c]/30 border-2 border-black rounded-2xl p-6 neo-shadow-sm">
            <h3 className="font-heading font-black text-base text-black mb-2 flex items-center gap-2">
              <span>📍</span> Operating Location
            </h3>
            <p className="text-sm text-black/80 font-medium">
              BuildMate Technologies • Hyderabad, Telangana, India
            </p>
            <p className="text-xs text-black/60 font-medium mt-1">
              Digital procurement platform operating across pan-India and global software development workflows.
            </p>
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
              <Link href="/cancellation-refund" className="text-black underline font-black">
                Cancellation &amp; Refunds
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
