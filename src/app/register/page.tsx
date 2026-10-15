"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    agreedToTerms: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.agreedToTerms) {
      setError("You must agree to the Terms of Service and Privacy Policy to register.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Registration failed.");
      }

      setRegisteredEmail(formData.email);
      setIsRegistered(true);
    } catch (err: any) {
      setError(err.message || "An error occurred during registration.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clean Account Created Success Screen (Neo-Brutalist)
  if (isRegistered) {
    return (
      <div className="min-h-screen bg-[#ffe17c] neo-dots flex flex-col justify-center py-16 px-4 sm:px-6 lg:px-8 font-body text-[#171e19]">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white p-8 sm:p-12 border-2 border-black rounded-3xl neo-shadow-lg text-center">
            <div className="w-20 h-20 bg-[#ffe17c] border-2 border-black rounded-full flex items-center justify-center mx-auto mb-6 text-4xl neo-shadow">
              ✓
            </div>
            <h2 className="font-heading font-black text-3xl text-black tracking-tight mb-3">
              Account Created!
            </h2>
            <p className="text-sm text-black/80 font-medium mb-8 leading-relaxed">
              Your client account for <span className="font-black text-black">{registeredEmail}</span> is ready. You can now sign in to post software projects, review builder quotations, and manage milestone escrow.
            </p>

            <Link
              href={`/login?registered=true&email=${encodeURIComponent(registeredEmail)}`}
              className="neo-btn-lg w-full py-4 bg-black text-white font-heading font-black text-sm uppercase tracking-wider rounded-xl block text-center"
            >
              Sign In to BuildMate →
            </Link>
          </div>
        </div>
      </div>
    );
  }

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

      {/* Main Registration Form */}
      <main className="flex-1 flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white border-2 border-black mb-4 neo-shadow-sm">
              Client Portal Registration
            </span>
            <h1 className="font-heading font-black text-3xl sm:text-4xl text-black tracking-tighter">
              Create Client Account
            </h1>
            <p className="mt-2 text-sm text-black/80 font-medium">
              Post projects, receive itemized quotes, and safeguard deposits in escrow.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 sm:p-10 border-2 border-black neo-shadow-lg">
            {error && (
              <div className="mb-6 bg-red-100 border-2 border-black text-red-900 p-3.5 rounded-xl text-sm font-bold flex items-start gap-2.5 neo-shadow-sm">
                <span className="font-black text-red-800">✕</span>
                <div>{error}</div>
              </div>
            )}

            {/* Google Sign Up for Clients */}
            <div className="mb-6 space-y-4">
              <GoogleSignInButton label="Sign Up with Google" returnTo="/dashboard" />
              <div className="relative flex items-center justify-center">
                <div className="border-t-2 border-black/10 w-full absolute"></div>
                <span className="bg-white px-3 text-[11px] font-heading font-black text-black/50 uppercase tracking-wider relative">
                  Or register with email
                </span>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="name" className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                  Full Name <span className="text-red-600">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="Jane Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-black text-sm font-medium text-black placeholder-gray-400 focus:outline-none focus:bg-[#ffe17c]/20 neo-shadow-sm transition"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                  Email Address <span className="text-red-600">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="jane@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-black text-sm font-medium text-black placeholder-gray-400 focus:outline-none focus:bg-[#ffe17c]/20 neo-shadow-sm transition"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                  Phone Number <span className="text-black/50 lowercase font-normal">(optional)</span>
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+91 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-black text-sm font-medium text-black placeholder-gray-400 focus:outline-none focus:bg-[#ffe17c]/20 neo-shadow-sm transition"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                  Password <span className="text-red-600">*</span>
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="Min 8 chars, 1 uppercase, 1 symbol"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-black text-sm font-medium text-black placeholder-gray-400 focus:outline-none focus:bg-[#ffe17c]/20 neo-shadow-sm transition"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                  Confirm Password <span className="text-red-600">*</span>
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  placeholder="Repeat your password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-black text-sm font-medium text-black placeholder-gray-400 focus:outline-none focus:bg-[#ffe17c]/20 neo-shadow-sm transition"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-2.5 text-xs text-black/80 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.agreedToTerms}
                    onChange={(e) => setFormData({ ...formData, agreedToTerms: e.target.checked })}
                    className="mt-0.5 w-4 h-4 rounded border-2 border-black text-black focus:ring-0 cursor-pointer"
                  />
                  <span>
                    I agree to the{" "}
                    <Link href="/terms" className="underline font-bold text-black" target="_blank">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="underline font-bold text-black" target="_blank">
                      Privacy Policy
                    </Link>
                  </span>
                </label>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="neo-btn-lg w-full py-4 bg-black text-white font-heading font-black text-base uppercase tracking-wider rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Creating Account..." : "Create Client Account →"}
                </button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t-2 border-black/10 text-center space-y-2">
              <p className="text-xs font-bold text-black/70">
                Already have an account?{" "}
                <Link href="/login" className="font-black text-black underline">
                  Sign In
                </Link>
              </p>
              <p className="text-xs font-bold text-black/70">
                Are you an engineer?{" "}
                <Link href="/builder/apply" className="font-black text-black underline">
                  Apply for Builder Access
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
