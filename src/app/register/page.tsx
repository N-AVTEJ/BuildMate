"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

  // Clean Account Created Success Screen (V1 Policy)
  if (isRegistered) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-10 px-6 shadow sm:rounded-xl sm:px-10 border border-gray-200 text-center">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 text-2xl">
              ✓
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-2">
              Account Created Successfully!
            </h2>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              Your client account for{" "}
              <span className="font-semibold text-gray-900">{registeredEmail}</span> has been created.
              You can now sign in to post academic and software projects, review builder quotations, and manage milestones.
            </p>

            <Link
              href={`/login?registered=true&email=${encodeURIComponent(registeredEmail)}`}
              className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition"
            >
              Sign In to BuildMate →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-3xl font-extrabold text-gray-900 tracking-tight">
          Create your BuildMate Client Account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Register as a client to submit projects, receive verified builder quotations, and manage milestone delivery.
        </p>
        <p className="mt-2 text-center text-xs text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-500">
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-gray-200">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Full Name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="Jane Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Email Address *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="jane@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Phone Number *
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Password *
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="At least 8 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Confirm Password *
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Terms and Privacy Agreement */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="agreedToTerms"
                  name="agreedToTerms"
                  type="checkbox"
                  required
                  checked={formData.agreedToTerms}
                  onChange={(e) => setFormData({ ...formData, agreedToTerms: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
              <div className="ml-3 text-xs text-gray-600">
                <label htmlFor="agreedToTerms" className="cursor-pointer">
                  I agree to the{" "}
                  <Link href="/terms" className="text-blue-600 hover:text-blue-500 underline font-medium" target="_blank">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-blue-600 hover:text-blue-500 underline font-medium" target="_blank">
                    Privacy Policy
                  </Link>{" "}
                  *
                </label>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting || !formData.agreedToTerms}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isSubmitting ? "Creating Client Account..." : "Create Client Account"}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              Are you a software builder? Builder accounts are onboarded via administrator invitation and vetting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
