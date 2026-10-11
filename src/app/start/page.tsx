import Link from "next/link";

export default function StartPage() {
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
              href="/login"
              className="text-black hover:underline transition"
            >
              Sign In →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Role Chooser Content */}
      <main className="flex-1 flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-white border-2 border-black mb-4 neo-shadow-sm">
              Role-First Entry Flow
            </span>
            <h1 className="font-heading font-black text-4xl sm:text-5xl text-black tracking-tighter">
              Choose your role to get started
            </h1>
            <p className="mt-3 text-base sm:text-lg text-black/80 max-w-xl mx-auto font-medium">
              Select how you will participate on BuildMate. Your path begins here.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Card 1: Client / Student */}
            <div className="bg-white rounded-2xl p-8 border-2 border-black neo-shadow-lg flex flex-col justify-between group hover:-translate-y-1 transition-transform">
              <div>
                <div className="w-14 h-14 bg-[#b7c6c2] border-2 border-black rounded-xl flex items-center justify-center text-3xl mb-5 neo-shadow-sm group-hover:bg-[#ffe17c] transition-colors">
                  🎓
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-black bg-[#ffe17c] px-2 py-0.5 border border-black rounded">
                  Client Portal
                </span>
                <h2 className="font-heading font-black text-2xl sm:text-3xl text-black tracking-tight mt-3 mb-2">
                  I&apos;m a Client / Student
                </h2>
                <p className="text-sm text-black/80 font-medium leading-relaxed mb-6">
                  Post software or academic development requirements, review builder quotations, lock deliverables, and safeguard deposits in escrow.
                </p>

                <ul className="space-y-2.5 text-xs font-bold text-black border-t-2 border-black/10 pt-4 mb-8">
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-black text-[#ffe17c] flex items-center justify-center text-[10px]">✓</span>
                    <span>Create and manage software projects</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-black text-[#ffe17c] flex items-center justify-center text-[10px]">✓</span>
                    <span>Milestone escrow &amp; delivery verification</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-black text-[#ffe17c] flex items-center justify-center text-[10px]">✓</span>
                    <span>Direct communication with verified builders</span>
                  </li>
                </ul>
              </div>

              <div>
                <Link
                  href="/login"
                  className="neo-btn-lg w-full py-4 bg-black text-white font-heading font-black text-sm uppercase tracking-wider rounded-xl text-center block"
                >
                  Continue as Client / Student →
                </Link>
                <p className="mt-3 text-xs text-center text-black/60 font-bold">
                  New here?{" "}
                  <Link href="/register" className="font-black text-black underline">
                    Sign up for free
                  </Link>
                </p>
              </div>
            </div>

            {/* Card 2: Builder */}
            <div className="bg-[#b7c6c2] rounded-2xl p-8 border-2 border-black neo-shadow-lg flex flex-col justify-between group hover:-translate-y-1 transition-transform">
              <div>
                <div className="w-14 h-14 bg-white border-2 border-black rounded-xl flex items-center justify-center text-3xl mb-5 neo-shadow-sm group-hover:bg-[#ffe17c] transition-colors">
                  ⚡
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-black bg-white px-2 py-0.5 border border-black rounded">
                    Engineering Network
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-[#ffe17c] border border-black rounded">
                    Invite-Only
                  </span>
                </div>
                <h2 className="font-heading font-black text-2xl sm:text-3xl text-black tracking-tight mt-3 mb-2">
                  I&apos;m a Builder
                </h2>
                <p className="text-sm text-black/80 font-medium leading-relaxed mb-6">
                  Builder access is invite-only right now. We review each application individually to maintain strict engineering quality standards.
                </p>

                <ul className="space-y-2.5 text-xs font-bold text-black border-t-2 border-black/10 pt-4 mb-8">
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-black text-[#ffe17c] flex items-center justify-center text-[10px]">✓</span>
                    <span>Browse verified client projects</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-black text-[#ffe17c] flex items-center justify-center text-[10px]">✓</span>
                    <span>Guaranteed payment escrow protection</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-black text-[#ffe17c] flex items-center justify-center text-[10px]">✓</span>
                    <span>Clear milestone delivery gates</span>
                  </li>
                </ul>
              </div>

              <div>
                <Link
                  href="/builder/apply"
                  className="neo-btn-lg w-full py-4 bg-white text-black font-heading font-black text-sm uppercase tracking-wider rounded-xl text-center block"
                >
                  Apply for Builder Access →
                </Link>
                <p className="mt-3 text-xs text-center text-black/60 font-bold">
                  Already approved?{" "}
                  <Link href="/login" className="font-black text-black underline">
                    Sign in to Builder Portal
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
