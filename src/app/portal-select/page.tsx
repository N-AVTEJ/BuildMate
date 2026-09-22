import { redirect } from "next/navigation";
import Link from "next/link";
import { getOptionalAuth } from "@/lib/auth/guards";
import { PortalHeader } from "@/components/navigation/portal-header";

export default async function PortalSelectPage() {
  const auth = await getOptionalAuth();

  if (!auth) {
    redirect("/login");
  }

  const { user, roles } = auth;
  const isClient = roles.includes("CLIENT");
  const isBuilder = roles.includes("BUILDER");
  const isAdmin = roles.includes("ADMIN");

  // If the user only has a single role, automatically send them to their authorized portal
  if (roles.length === 1) {
    if (isClient) redirect("/dashboard");
    if (isBuilder) redirect("/builder");
    if (isAdmin) redirect("/admin");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PortalHeader
        user={user}
        roles={roles}
        currentPortalTitle="Portal Selection"
      />

      <main className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <div className="text-center mb-10">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 mb-3">
            Authorized Account Portals
          </span>
          <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl tracking-tight">
            How will you use BuildMate?
          </h1>
          <p className="mt-3 text-base text-gray-600 max-w-xl mx-auto">
            Welcome back, <span className="font-semibold text-gray-900">{user.name}</span>.
            Select the workspace you want to enter. You can switch between your authorized portals at any time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Option 1: Student / Client */}
          {isClient ? (
            <div className="bg-white rounded-2xl p-8 border-2 border-blue-200 shadow-sm hover:shadow-md hover:border-blue-500 transition flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-2xl mb-5">
                  🎓
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Student / Client
                </h2>
                <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                  Post your academic/software project and hire a builder.
                </p>

                <ul className="space-y-2.5 text-xs text-gray-600 mb-8 border-t border-gray-100 pt-4">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span> Create and manage software projects
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span> Review and accept verified builder quotations
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span> Track milestones, payments, and deliverables
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span> Direct messaging with your assigned builder
                  </li>
                </ul>
              </div>

              <Link
                href="/dashboard"
                className="w-full inline-flex justify-center items-center py-3 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition"
              >
                Enter Client Portal →
              </Link>
            </div>
          ) : (
            <div className="bg-gray-100 rounded-2xl p-8 border border-gray-200 opacity-60 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 bg-gray-200 text-gray-400 rounded-xl flex items-center justify-center text-2xl mb-5">
                  🎓
                </div>
                <h2 className="text-xl font-bold text-gray-500 mb-2">
                  Student / Client
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                  Post your academic/software project and hire a builder.
                </p>
                <p className="text-xs text-gray-400 italic">
                  Not authorized for this account.
                </p>
              </div>
              <button disabled className="w-full py-3 px-4 rounded-xl text-sm font-medium text-gray-400 bg-gray-200 cursor-not-allowed">
                Not Authorized
              </button>
            </div>
          )}

          {/* Option 2: Builder / Admin */}
          {isBuilder || isAdmin ? (
            <div className="bg-white rounded-2xl p-8 border-2 border-emerald-200 shadow-sm hover:shadow-md hover:border-emerald-500 transition flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-2xl mb-5">
                  ⚡
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {isAdmin ? "Builder / Admin" : "Builder"}
                </h2>
                <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                  Accept projects, submit quotations, manage development and payments.
                </p>

                <ul className="space-y-2.5 text-xs text-gray-600 mb-8 border-t border-gray-100 pt-4">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span> Browse available projects and client requirements
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span> Submit itemized quotations with milestone schedules
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span> Post development progress and repository deliverables
                  </li>
                  {isAdmin && (
                    <li className="flex items-center gap-2 font-medium text-indigo-700">
                      <span className="text-indigo-500 font-bold">★</span> Admin verification, dispute, and escrow controls
                    </li>
                  )}
                </ul>
              </div>

              <div className="space-y-2">
                {isBuilder && (
                  <Link
                    href="/builder"
                    className="w-full inline-flex justify-center items-center py-3 px-4 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition"
                  >
                    Enter Builder Portal →
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="w-full inline-flex justify-center items-center py-2.5 px-4 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition border border-indigo-200"
                  >
                    Open Admin Dashboard →
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-100 rounded-2xl p-8 border border-gray-200 opacity-60 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 bg-gray-200 text-gray-400 rounded-xl flex items-center justify-center text-2xl mb-5">
                  ⚡
                </div>
                <h2 className="text-xl font-bold text-gray-500 mb-2">
                  Builder / Admin
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                  Accept projects, submit quotations, manage development and payments.
                </p>
                <p className="text-xs text-gray-400 italic">
                  Builder accounts require invitation and administrator onboarding.
                </p>
              </div>
              <button disabled className="w-full py-3 px-4 rounded-xl text-sm font-medium text-gray-400 bg-gray-200 cursor-not-allowed">
                Not Authorized
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
