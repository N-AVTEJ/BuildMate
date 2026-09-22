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
      if (roles.length > 1) {
        router.push("/portal-select");
      } else if (roles.includes("ADMIN")) {
        router.push("/admin");
      } else if (roles.includes("BUILDER")) {
        router.push("/builder");
      } else {
        router.push("/dashboard");
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
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
          Sign in to BuildMate
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500">
          Enter your credentials to access your portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-gray-200">
          {/* Quick Autofill Trigger (Strictly Local Development Only) */}
          {isDevelopment && (
            <div className="mb-6 p-3 bg-blue-50/80 border border-blue-200 rounded-lg flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-blue-900 flex items-center gap-1">
                  <span>⚡</span> Builder Quick Login (Dev Only)
                </div>
                <div className="text-[11px] text-blue-700">Autofill verified builder credentials</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAutofillPrompt(!showAutofillPrompt);
                  setAutofillError(null);
                  setAutofillPasscode("");
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-sm transition"
              >
                {showAutofillPrompt ? "Cancel" : "Autofill"}
              </button>
            </div>
          )}

          {/* Passcode Prompt for Autofill (Development Only) */}
          {isDevelopment && showAutofillPrompt && (
            <form onSubmit={handleAutofillSubmit} className="mb-6 p-4 bg-gray-50 border border-gray-300 rounded-lg space-y-3">
              <label htmlFor="passcode" className="block text-xs font-bold text-gray-800">
                Enter Passcode (1234) to Autofill &amp; Sign In:
              </label>
              <div className="flex gap-2">
                <input
                  id="passcode"
                  type="password"
                  autoFocus
                  placeholder="Enter 1234"
                  value={autofillPasscode}
                  onChange={(e) => setAutofillPasscode(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? "Logging in..." : "Unlock & Login"}
                </button>
              </div>
              {autofillError && (
                <p className="text-xs text-red-600 font-medium">{autofillError}</p>
              )}
            </form>
          )}

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition"
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="font-semibold text-blue-600 hover:text-blue-500">
                Create a client account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
