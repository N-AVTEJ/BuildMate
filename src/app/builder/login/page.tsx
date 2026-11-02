"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function BuilderLoginForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed.");
      }

      const roles: string[] = data.user?.roles || [];
      if (roles.includes("ADMIN")) {
        router.push("/admin");
      } else if (roles.includes("BUILDER")) {
        router.push("/builder");
      } else {
        setError(
          "Access Restricted: Your account does not hold the BUILDER role. This portal is strictly for verified builders. Please sign in via the Client Portal."
        );
        return;
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An error occurred during login.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
              className="px-3.5 py-1.5 bg-white border-2 border-black rounded-lg text-black hover:bg-black hover:text-white transition font-heading font-black text-xs uppercase neo-shadow-sm"
            >
              Client Portal Sign In →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Builder Login Card */}
      <main className="flex-1 flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-black text-[#ffe17c] border-2 border-black mb-4 neo-shadow-sm">
              ⚡ Verified Builder Portal
            </span>
            <h1 className="font-heading font-black text-4xl text-black tracking-tighter">
              Builder Command Center
            </h1>
            <p className="mt-2 text-sm text-black/80 font-medium">
              Enter your assigned builder credentials to access projects and deliverables.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 sm:p-10 border-2 border-black neo-shadow-lg">
            {error && (
              <div className="mb-6 bg-red-100 border-2 border-black text-red-900 p-3.5 rounded-xl text-sm font-bold flex items-start gap-2.5 neo-shadow-sm">
                <span className="font-black text-red-800">⚠️</span>
                <div>{error}</div>
              </div>
            )}

            <div className="mb-6 bg-[#ffe17c]/20 border-2 border-black p-3.5 rounded-xl text-xs font-bold text-black/80 flex items-center gap-2 neo-shadow-sm">
              <span>🔒</span>
              <span>
                <strong>Builder Access is by manual verification.</strong> Google sign-in is disabled for builders. Use your provisioned email &amp; password.
              </span>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                  Builder Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="builder@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-black text-sm font-medium text-black placeholder-gray-400 focus:outline-none focus:bg-[#ffe17c]/20 neo-shadow-sm transition"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-xs font-black uppercase tracking-wider text-black">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs font-heading font-black uppercase tracking-wider text-black/70 hover:text-black flex items-center gap-1 focus:outline-none"
                  >
                    <span>{showPassword ? "Hide" : "Show"}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-black text-sm font-medium text-black placeholder-gray-400 focus:outline-none focus:bg-[#ffe17c]/20 neo-shadow-sm transition pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-black/60 hover:text-black transition"
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="neo-btn-lg w-full py-4 bg-black text-[#ffe17c] font-heading font-black text-base uppercase tracking-wider rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/90 transition shadow-sm"
                >
                  {isSubmitting ? "Authenticating..." : "Enter Command Center ⚡"}
                </button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t-2 border-black/10 text-center space-y-2">
              <p className="text-xs font-bold text-black/70">
                Not a verified builder yet?{" "}
                <Link href="/builder/apply" className="font-black text-black underline">
                  Apply for Builder Access
                </Link>
              </p>
              <p className="text-xs font-bold text-black/70">
                Are you a client?{" "}
                <Link href="/login" className="font-black text-black underline">
                  Client Sign In (Google &amp; Email)
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function BuilderLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#ffe17c] flex items-center justify-center font-heading font-black text-lg">
          Loading Builder Portal...
        </div>
      }
    >
      <BuilderLoginForm />
    </Suspense>
  );
}
