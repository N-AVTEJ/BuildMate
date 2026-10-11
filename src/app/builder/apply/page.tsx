"use client";

import { useState } from "react";
import Link from "next/link";

export default function BuilderApplyPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("Please provide your name.");
      return;
    }

    if (!formData.email.trim()) {
      setError("Please provide your email address.");
      return;
    }

    if (formData.message.length > 1000) {
      setError("Message cannot exceed 1000 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/builder-inquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit inquiry.");
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between selection:bg-blue-100 selection:text-blue-900">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-black text-xl tracking-tight text-gray-900">
            <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
              B
            </span>
            <span>Build<span className="text-blue-600">Mate</span></span>
          </Link>
          <div className="flex items-center gap-4 text-sm font-medium">
            <span className="text-gray-500 hidden sm:inline">Already approved?</span>
            <Link
              href="/login"
              className="text-blue-600 hover:text-blue-700 font-semibold transition"
            >
              Sign In →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-lg w-full">
          {submitted ? (
            <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-sm border border-gray-200 text-center animate-fade-in">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-6 shadow-xs">
                ✓
              </div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Thanks — we&apos;ll be in touch.
              </h1>
              <p className="mt-3 text-sm text-gray-600 leading-relaxed">
                We review every builder inquiry personally to guarantee software delivery excellence on BuildMate.
                Keep an eye on your inbox for our invite and onboarding instructions.
              </p>

              <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition text-center"
                >
                  Return Home
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition text-center shadow-sm"
                >
                  Sign In
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-sm border border-gray-200">
              {/* Badge & Title */}
              <div className="text-center mb-8">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 mb-4">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Invite-Only Network
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                  Apply for Builder Access
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                  Builder access is invite-only right now. Submit your details below to join the verification queue.
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-3">
                  <span className="font-bold text-red-500">!</span>
                  <div>{error}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                    Your Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    maxLength={255}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Alex Morgan"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    maxLength={255}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="alex@example.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="message" className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                      Message / Portfolio <span className="text-gray-400 font-normal lowercase">(optional)</span>
                    </label>
                    <span className="text-xs text-gray-400">
                      {formData.message.length} / 1000
                    </span>
                  </div>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    maxLength={1000}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Tell us about your tech stack, previous projects, GitHub profile, or domain expertise..."
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition active:scale-98"
                >
                  {isSubmitting ? "Submitting Inquiry..." : "Submit Builder Application →"}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-500">
                  Looking to post a project instead?{" "}
                  <Link href="/login" className="font-semibold text-blue-600 hover:underline">
                    Sign in as Client
                  </Link>{" "}
                  or{" "}
                  <Link href="/register" className="font-semibold text-blue-600 hover:underline">
                    Register
                  </Link>
                </p>
              </div>
            </div>
          )}
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
