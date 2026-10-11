import Link from "next/link";

export default function StartPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between selection:bg-blue-100 selection:text-blue-900">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-black text-xl tracking-tight text-gray-900">
            <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
              B
            </span>
            <span>Build<span className="text-blue-600">Mate</span></span>
          </Link>
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link
              href="/login"
              className="text-gray-600 hover:text-gray-900 transition"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Role Chooser Content */}
      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 mb-4">
              Get Started with BuildMate
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Choose your role to get started
            </h1>
            <p className="mt-3 text-base text-gray-600 max-w-xl mx-auto">
              Select how you will participate on BuildMate. Your path begins here.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Client / Student */}
            <div className="bg-white rounded-2xl p-8 border-2 border-blue-200 hover:border-blue-500 shadow-sm hover:shadow-md transition flex flex-col justify-between group">
              <div>
                <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-3xl mb-5 group-hover:scale-105 transition-transform">
                  🎓
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Client Portal</span>
                <h2 className="text-2xl font-bold text-gray-900 mt-1 mb-2">
                  I&apos;m a Client / Student
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed mb-6">
                  Post software or academic development requirements, review builder quotations, lock deliverables, and safeguard deposits in escrow.
                </p>

                <ul className="space-y-2 text-xs text-gray-600 mb-8 border-t border-gray-100 pt-4">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span> Create and manage software projects
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span> Milestone escrow &amp; delivery verification
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span> Direct communication with verified builders
                  </li>
                </ul>
              </div>

              <div>
                <Link
                  href="/login"
                  className="w-full inline-flex justify-center items-center py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition active:scale-98"
                >
                  Continue as Client / Student →
                </Link>
                <p className="mt-3 text-xs text-center text-gray-500">
                  New here?{" "}
                  <Link href="/register" className="font-semibold text-blue-600 hover:underline">
                    Sign up for free
                  </Link>
                </p>
              </div>
            </div>

            {/* Card 2: Builder */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200 hover:border-amber-400 shadow-sm hover:shadow-md transition flex flex-col justify-between group">
              <div>
                <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-3xl mb-5 group-hover:scale-105 transition-transform">
                  ⚡
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Engineering Network</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                    Invite-Only
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mt-1 mb-2">
                  I&apos;m a Builder
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed mb-6">
                  Builder access is invite-only right now. We review each application individually to maintain strict engineering quality standards.
                </p>

                <ul className="space-y-2 text-xs text-gray-600 mb-8 border-t border-gray-100 pt-4">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span> Browse verified client projects
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span> Guaranteed payment escrow protection
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span> Clear milestone delivery gates
                  </li>
                </ul>
              </div>

              <div>
                <Link
                  href="/builder/apply"
                  className="w-full inline-flex justify-center items-center py-3.5 px-4 rounded-xl text-sm font-semibold text-gray-800 bg-gray-100 hover:bg-gray-200 border border-gray-300 transition active:scale-98"
                >
                  Apply for Builder Access →
                </Link>
                <p className="mt-3 text-xs text-center text-gray-500">
                  Already approved?{" "}
                  <Link href="/login" className="font-semibold text-blue-600 hover:underline">
                    Sign in to Builder Portal
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} BuildMate Escrow Guard. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
