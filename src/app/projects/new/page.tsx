"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewProjectPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: "",
    subject: "",
    description: "",
    techStack: "",
    budgetMin: "",
    budgetMax: "",
    integrityAck: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.integrityAck) {
      setError("You must acknowledge the project integrity statement to submit.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formData.title,
          subject: formData.subject,
          description: formData.description,
          techStack: formData.techStack,
          budgetMin: parseInt(formData.budgetMin, 10),
          budgetMax: parseInt(formData.budgetMax, 10),
          integrityAck: formData.integrityAck,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit project.");
      }

      router.push(`/projects/${data.project.id}`);
    } catch (err: any) {
      setError(err.message || "An error occurred while creating project.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="mb-6">
          <Link
            href="/projects"
            className="text-sm font-medium text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            ← Back to Projects
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create New Project</h1>
          <p className="text-sm text-gray-500 mt-1">
            Submit your project requirements to find verified builders.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 border border-red-200 text-sm text-red-700 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Project Title *
            </label>
            <input
              id="title"
              type="text"
              required
              maxLength={200}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              placeholder="e.g. Modern E-Commerce Platform"
            />
          </div>

          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
              Subject / Category *
            </label>
            <input
              id="subject"
              type="text"
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              placeholder="e.g. Web Development / Full Stack"
            />
          </div>

          <div>
            <label htmlFor="techStack" className="block text-sm font-medium text-gray-700">
              Required Tech Stack *
            </label>
            <input
              id="techStack"
              type="text"
              required
              value={formData.techStack}
              onChange={(e) => setFormData({ ...formData, techStack: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              placeholder="e.g. Next.js, TypeScript, PostgreSQL, Tailwind"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="budgetMin" className="block text-sm font-medium text-gray-700">
                Minimum Budget (₹) *
              </label>
              <input
                id="budgetMin"
                type="number"
                required
                min={0}
                value={formData.budgetMin}
                onChange={(e) => setFormData({ ...formData, budgetMin: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                placeholder="20000"
              />
            </div>

            <div>
              <label htmlFor="budgetMax" className="block text-sm font-medium text-gray-700">
                Maximum Budget (₹) *
              </label>
              <input
                id="budgetMax"
                type="number"
                required
                min={0}
                value={formData.budgetMax}
                onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                placeholder="50000"
              />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Project Description *
            </label>
            <textarea
              id="description"
              required
              rows={5}
              maxLength={5000}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              placeholder="Provide clear specifications, target features, and delivery expectations..."
            />
          </div>

          {/* Requirement 10: integrity_ack checkbox required in UI */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="integrityAck"
                  name="integrityAck"
                  type="checkbox"
                  required
                  checked={formData.integrityAck}
                  onChange={(e) => setFormData({ ...formData, integrityAck: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="integrityAck" className="font-medium text-blue-900 cursor-pointer">
                  Project Integrity Statement (Required) *
                </label>
                <p className="text-blue-700 text-xs mt-0.5">
                  I confirm that this project specification represents genuine work requirements, does not violate any academic or commercial integrity rules, and that I agree to abide by the BuildMate platform milestones and escrow terms.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !formData.integrityAck}
              className="w-full inline-flex justify-center items-center px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isSubmitting ? "Submitting Project..." : "Submit Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
