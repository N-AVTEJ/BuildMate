"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Autofill Passcode state (strictly local development only)
  const isDevelopment = process.env.NODE_ENV === "development";
  const [showAutofillPrompt, setShowAutofillPrompt] = useState(false);
  const [autofillPasscode, setAutofillPasscode] = useState("");
  const [autofillError, setAutofillError] = useState<string | null>(null);

  const executeLogin = async (emailToUse: string, passwordToUse: string) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: emailToUse,
          password: passwordToUse,
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
        router.push("/projects");
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An error occurred during login.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeLogin(formData.email, formData.password);
  };

  const handleAutofillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAutofillError(null);

    if (autofillPasscode.trim() !== "1234") {
      setAutofillError("Incorrect passcode. Please enter 1234.");
      return;
    }

    const builderEmail = "madipadiganavtej@gmail.com";
    const builderPass = "Navtej2006";

    setFormData({
      email: builderEmail,
      password: builderPass,
    });
    setShowAutofillPrompt(false);
    setAutofillPasscode("");

    await executeLogin(builderEmail, builderPass);
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
              href="/"
              className="text-black hover:underline transition"
            >
              ← Return Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white border-2 border-black mb-4 neo-shadow-sm">
              Authorized Portal Access
            </span>
            <h1 className="font-heading font-black text-4xl text-black tracking-tighter">
              Sign In to BuildMate
            </h1>
            <p className="mt-2 text-sm text-black/80 font-medium">
              Enter your credentials to access your client or builder workspace.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 sm:p-10 border-2 border-black neo-shadow-lg">
            {/* Quick Autofill Trigger (Strictly Local Development Only) */}
            {isDevelopment && (
              <div className="mb-6 p-3.5 bg-[#b7c6c2]/40 border-2 border-black rounded-xl flex items-center justify-between neo-shadow-sm">
                <div>
                  <div className="text-xs font-black font-heading text-black flex items-center gap-1 uppercase tracking-wider">
                    <span>⚡</span> Builder Quick Login
                  </div>
                  <div className="text-[11px] text-black/70 font-medium">Autofill verified builder test account</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAutofillPrompt(!showAutofillPrompt);
                    setAutofillError(null);
                    setAutofillPasscode("");
                  }}
                  className="neo-btn px-3 py-1 bg-black text-white text-xs font-black font-heading uppercase tracking-wider rounded-lg"
                >
                  {showAutofillPrompt ? "Cancel" : "Autofill"}
                </button>
              </div>
            )}

            {/* Passcode Prompt for Autofill (Development Only) */}
            {isDevelopment && showAutofillPrompt && (
              <form onSubmit={handleAutofillSubmit} className="mb-6 p-4 bg-[#ffe17c]/30 border-2 border-black rounded-xl space-y-3 neo-shadow-sm">
                <label htmlFor="passcode" className="block text-xs font-black text-black uppercase tracking-wider">
                  Enter Passcode (1234) to Unlock &amp; Sign In:
                </label>
                <div className="flex gap-2">
                  <input
                    id="passcode"
                    type="password"
                    autoFocus
                    placeholder="Enter 1234"
                    value={autofillPasscode}
                    onChange={(e) => setAutofillPasscode(e.target.value)}
                    className="flex-1 rounded-lg border-2 border-black px-3 py-2 text-sm font-medium focus:bg-[#ffe17c]/20 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="neo-btn px-4 py-2 bg-black text-white text-xs font-black font-heading uppercase rounded-lg disabled:opacity-50"
                  >
                    {isSubmitting ? "..." : "Unlock"}
                  </button>
                </div>
                {autofillError && (
                  <p className="text-xs text-red-600 font-bold">{autofillError}</p>
                )}
              </form>
            )}

            {error && (
              <div className="mb-6 bg-red-100 border-2 border-black text-red-900 p-3.5 rounded-xl text-sm font-bold flex items-start gap-2.5 neo-shadow-sm">
                <span className="font-black text-red-800">✕</span>
                <div>{error}</div>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-black text-sm font-medium text-black placeholder-gray-400 focus:outline-none focus:bg-[#ffe17c]/20 neo-shadow-sm transition"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-black text-sm font-medium text-black placeholder-gray-400 focus:outline-none focus:bg-[#ffe17c]/20 neo-shadow-sm transition"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="neo-btn-lg w-full py-4 bg-black text-white font-heading font-black text-base uppercase tracking-wider rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Signing In..." : "Sign In →"}
                </button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t-2 border-black/10 text-center space-y-2">
              <p className="text-xs font-bold text-black/70">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="font-black text-black underline">
                  Register as Client
                </Link>
              </p>
              <p className="text-xs font-bold text-black/70">
                Want to build?{" "}
                <Link href="/builder/apply" className="font-black text-black underline">
                  Apply for Builder Access (Invite-Only)
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
