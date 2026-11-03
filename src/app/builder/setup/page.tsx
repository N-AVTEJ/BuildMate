"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function BuilderSetupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [builderEmail, setBuilderEmail] = useState<string | null>(null);
  const [builderName, setBuilderName] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      setTokenValid(false);
      return;
    }

    async function checkToken() {
      try {
        const res = await fetch(`/api/auth/builder-setup?token=${encodeURIComponent(token!)}`);
        const data = await res.json();
        if (res.ok && data.valid) {
          setTokenValid(true);
          setBuilderEmail(data.email || null);
          setBuilderName(data.name || null);
        } else {
          setTokenValid(false);
          setError(data.error || "This setup link is invalid or has expired.");
        }
      } catch {
        setTokenValid(false);
        setError("Failed to validate invitation token. Please check your connection.");
      } finally {
        setValidating(false);
      }
    }

    checkToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/builder-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to set up password.");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(data.redirectTo || "/login");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
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
              Sign In →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Card */}
      <main className="flex-1 flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-black text-[#ffe17c] border-2 border-black mb-4 neo-shadow-sm">
              ⚡ Builder Account Setup
            </span>
            <h1 className="font-heading font-black text-4xl text-black tracking-tighter">
              Create Your Password
            </h1>
            <p className="mt-2 text-sm text-black/80 font-medium">
              {builderName ? `Welcome, ${builderName}! ` : ""}
              Set a secure password to access your verified builder portal.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 sm:p-10 border-2 border-black neo-shadow-lg">
            {validating ? (
              <div className="py-12 text-center">
                <span className="text-3xl block mb-3 animate-spin">⏳</span>
                <p className="font-heading font-black text-black">Validating invitation token...</p>
              </div>
            ) : !token ? (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 bg-rose-200 border-2 border-black rounded-2xl flex items-center justify-center mx-auto text-2xl font-black">
                  ⚠️
                </div>
                <h3 className="font-heading font-black text-xl text-black">Missing Setup Token</h3>
                <p className="text-xs text-black/70 font-semibold leading-relaxed">
                  No invitation token was found in your link. Please check the email sent by the BuildMate team.
                </p>
                <Link
                  href="/builder/login"
                  className="neo-btn inline-block px-5 py-2.5 bg-black text-[#ffe17c] text-xs font-heading font-black uppercase tracking-wider rounded-xl"
                >
                  Go to Builder Login
                </Link>
              </div>
            ) : !tokenValid ? (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 bg-rose-200 border-2 border-black rounded-2xl flex items-center justify-center mx-auto text-2xl font-black">
                  ❌
                </div>
                <h3 className="font-heading font-black text-xl text-black">Invalid or Expired Link</h3>
                <p className="text-xs text-black/70 font-semibold leading-relaxed">
                  {error || "This invitation link is invalid or has expired. Setup links are valid for 7 days."}
                </p>
                <p className="text-xs text-black/60 font-medium">
                  Please contact the administrator to re-send your invitation link.
                </p>
                <Link
                  href="/builder/login"
                  className="neo-btn inline-block px-5 py-2.5 bg-black text-[#ffe17c] text-xs font-heading font-black uppercase tracking-wider rounded-xl"
                >
                  Return to Login
                </Link>
              </div>
            ) : success ? (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 bg-emerald-200 border-2 border-black rounded-2xl flex items-center justify-center mx-auto text-2xl font-black">
                  ✓
                </div>
                <h3 className="font-heading font-black text-xl text-black">Account Configured!</h3>
                <p className="text-xs text-emerald-900 font-bold leading-relaxed">
                  Your password has been securely hashed and stored. Redirecting you to the Builder Command Center...
                </p>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={handleSubmit}>
                {error && (
                  <div className="bg-rose-100 border-2 border-black text-rose-900 p-3.5 rounded-xl text-xs font-bold flex items-start gap-2.5 neo-shadow-sm">
                    <span className="font-black text-rose-800">⚠️</span>
                    <div>{error}</div>
                  </div>
                )}

                {builderEmail && (
                  <div className="bg-[#fffdf0] border-2 border-black p-3.5 rounded-xl text-xs font-bold text-black flex items-center justify-between">
                    <span className="text-black/60 font-black uppercase tracking-wider">Account Email:</span>
                    <span className="font-mono font-black">{builderEmail}</span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="block text-xs font-black uppercase tracking-wider text-black">
                      New Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-xs font-heading font-black uppercase tracking-wider text-black/70 hover:text-black flex items-center gap-1 focus:outline-none"
                    >
                      <span>{showPassword ? "Hide" : "Show"}</span>
                    </button>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-black text-sm font-medium text-black placeholder-gray-400 focus:outline-none focus:bg-[#ffe17c]/20 neo-shadow-sm transition"
                  />
                  <p className="text-[11px] text-black/60 font-semibold mt-1">
                    Minimum 8 characters (or a 4-word passphrase).
                  </p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-black text-sm font-medium text-black placeholder-gray-400 focus:outline-none focus:bg-[#ffe17c]/20 neo-shadow-sm transition"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="neo-btn-lg w-full py-4 bg-black text-[#ffe17c] font-heading font-black text-base uppercase tracking-wider rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/90 transition shadow-sm"
                  >
                    {isSubmitting ? "Setting Password..." : "Activate Builder Account ⚡"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function BuilderSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#ffe17c] flex items-center justify-center font-heading font-black text-lg">
          Loading Builder Setup...
        </div>
      }
    >
      <BuilderSetupForm />
    </Suspense>
  );
}
