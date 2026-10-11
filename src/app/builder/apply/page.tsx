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
    <div className="min-h-screen bg-[#ffe17c] neo-dots flex flex-col justify-between font-body text-[#171e19] selection:bg-black selection:text-white">
      {/* Top Navigation */}
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
            <span className="text-black/60 hidden sm:inline">Already approved?</span>
            <Link
              href="/login"
              className="text-black hover:underline transition"
            >
              Sign In →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl w-full">
          {submitted ? (
            <div className="bg-white rounded-3xl p-8 sm:p-12 border-2 border-black neo-shadow-lg text-center animate-fade-in">
              <div className="w-20 h-20 bg-[#ffe17c] border-2 border-black rounded-full flex items-center justify-center text-4xl mx-auto mb-6 neo-shadow">
                ✓
              </div>
              <h1 className="font-heading font-black text-3xl sm:text-4xl text-black tracking-tight">
                Thanks — we&apos;ll be in touch.
              </h1>
              <p className="mt-4 text-base text-black/80 font-medium leading-relaxed">
                We review every builder inquiry personally to guarantee software delivery excellence on BuildMate.
                Keep an eye on your inbox for our invite and onboarding instructions.
              </p>

              <div className="mt-8 pt-6 border-t-2 border-black/10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/"
                  className="neo-btn w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-black font-heading uppercase text-black bg-white hover:bg-black/5"
                >
                  Return Home
                </Link>
                <Link
                  href="/login"
                  className="neo-btn-lg w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-black font-heading uppercase text-white bg-black"
                >
                  Sign In
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-8 sm:p-12 border-2 border-black neo-shadow-lg">
              {/* Badge & Title */}
              <div className="text-center mb-8">
                <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#b7c6c2] text-black border-2 border-black mb-4 neo-shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-black animate-ping" />
                  Invite-Only Network
                </span>
                <h1 className="font-heading font-black text-3xl sm:text-4xl text-black tracking-tighter">
                  Apply for Builder Access
                </h1>
                <p className="mt-2 text-sm sm:text-base text-black/80 font-medium">
                  Builder access is invite-only right now. Submit your details below to join the verification queue.
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-100 border-2 border-black text-sm font-bold text-red-900 flex items-start gap-3 neo-shadow-sm">
                  <span className="font-black text-red-800">✕</span>
                  <div>{error}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-xs font-black uppercase tracking-wider text-black mb-2">
                    Your Full Name <span className="text-red-600">*</span>
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
                    className="w-full px-4 py-3 rounded-xl border-2 border-black text-base font-medium text-black placeholder-gray-400 focus:outline-none focus:bg-[#ffe17c]/20 neo-shadow-sm transition"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-xs font-black uppercase tracking-wider text-black mb-2">
                    Email Address <span className="text-red-600">*</span>
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
                    className="w-full px-4 py-3 rounded-xl border-2 border-black text-base font-medium text-black placeholder-gray-400 focus:outline-none focus:bg-[#ffe17c]/20 neo-shadow-sm transition"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="message" className="block text-xs font-black uppercase tracking-wider text-black">
                      Message / Portfolio <span className="text-black/50 lowercase font-normal">(optional)</span>
                    </label>
                    <span className="text-xs font-mono font-bold text-black/60">
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
                    placeholder="Tell us about your tech stack, GitHub profile, or domain expertise..."
                    className="w-full px-4 py-3 rounded-xl border-2 border-black text-base font-medium text-black placeholder-gray-400 focus:outline-none focus:bg-[#ffe17c]/20 neo-shadow-sm transition resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="neo-btn-lg w-full py-4 bg-black text-white font-heading font-black text-base uppercase tracking-wider rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Submitting Inquiry..." : "Submit Builder Application →"}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t-2 border-black/10 text-center">
                <p className="text-xs font-bold text-black/70">
                  Looking to post a project instead?{" "}
                  <Link href="/login" className="underline font-black text-black">
                    Sign in as Client
                  </Link>{" "}
                  or{" "}
                  <Link href="/register" className="underline font-black text-black">
                    Register
                  </Link>
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
