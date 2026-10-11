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
    requestedCompletionDate: "",
    integrityAck: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDateStr = tomorrow.toISOString().split("T")[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.requestedCompletionDate) {
      setError("Requested completion date is required.");
      return;
    }

    if (formData.requestedCompletionDate < minDateStr) {
      setError("Requested completion date must be in the future.");
      return;
    }

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
          requestedCompletionDate: formData.requestedCompletionDate,
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
    <div className="min-h-screen bg-[#fffdf0] neo-dots py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto bg-white border-2 border-black neo-shadow-lg p-8">
        <div className="mb-6">
          <Link
            href="/projects"
            className="neo-btn px-3 py-1 bg-white text-[#171e19] hover:bg-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm mb-3 inline-block transition"
          >
            ← Back to Projects
          </Link>
          <h1 className="text-3xl font-cabinet font-black text-[#171e19] tracking-tight uppercase">Create New Project</h1>
          <p className="text-sm font-bold text-gray-700 mt-1">
            Submit your project requirements to find verified builders.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-rose-200 p-4 border-2 border-black text-sm text-rose-950 font-black neo-shadow-sm">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-xs font-black uppercase tracking-wider text-[#171e19]">
              Project Title *
            </label>
            <input
              id="title"
              type="text"
              required
              maxLength={200}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="mt-1 block w-full border-2 border-black px-3.5 py-2.5 text-[#171e19] font-bold text-sm outline-none focus:bg-[#ffe17c]/20"
              placeholder="e.g. Modern E-Commerce Platform"
            />
          </div>

          <div>
            <label htmlFor="subject" className="block text-xs font-black uppercase tracking-wider text-[#171e19]">
              Subject / Category *
            </label>
            <input
              id="subject"
              type="text"
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="mt-1 block w-full border-2 border-black px-3.5 py-2.5 text-[#171e19] font-bold text-sm outline-none focus:bg-[#ffe17c]/20"
              placeholder="e.g. Web Development / Full Stack"
            />
          </div>

          <div>
            <label htmlFor="techStack" className="block text-xs font-black uppercase tracking-wider text-[#171e19]">
              Required Tech Stack *
            </label>
            <input
              id="techStack"
              type="text"
              required
              value={formData.techStack}
              onChange={(e) => setFormData({ ...formData, techStack: e.target.value })}
              className="mt-1 block w-full border-2 border-black px-3.5 py-2.5 text-[#171e19] font-bold text-sm outline-none focus:bg-[#ffe17c]/20"
              placeholder="e.g. Next.js, TypeScript, PostgreSQL, Tailwind"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="budgetMin" className="block text-xs font-black uppercase tracking-wider text-[#171e19]">
                Minimum Budget (₹) *
              </label>
              <input
                id="budgetMin"
                type="number"
                required
                min={0}
                value={formData.budgetMin}
                onChange={(e) => setFormData({ ...formData, budgetMin: e.target.value })}
                className="mt-1 block w-full border-2 border-black px-3.5 py-2.5 text-[#171e19] font-bold text-sm outline-none focus:bg-[#ffe17c]/20"
                placeholder="20000"
              />
            </div>

            <div>
              <label htmlFor="budgetMax" className="block text-xs font-black uppercase tracking-wider text-[#171e19]">
                Maximum Budget (₹) *
              </label>
              <input
                id="budgetMax"
                type="number"
                required
                min={0}
                value={formData.budgetMax}
                onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value })}
                className="mt-1 block w-full border-2 border-black px-3.5 py-2.5 text-[#171e19] font-bold text-sm outline-none focus:bg-[#ffe17c]/20"
                placeholder="50000"
              />
            </div>
          </div>

          <div>
            <label htmlFor="requestedCompletionDate" className="block text-xs font-black uppercase tracking-wider text-[#171e19]">
              Requested Completion Date *
            </label>
            <p className="text-xs font-bold text-gray-600 mb-1">
              Tell builders when you would ideally like the project completed.
            </p>
            <input
              id="requestedCompletionDate"
              name="requestedCompletionDate"
              type="date"
              required
              min={minDateStr}
              value={formData.requestedCompletionDate}
              onChange={(e) => setFormData({ ...formData, requestedCompletionDate: e.target.value })}
              className="mt-1 block w-full border-2 border-black px-3.5 py-2.5 text-[#171e19] font-bold text-sm outline-none focus:bg-[#ffe17c]/20"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-xs font-black uppercase tracking-wider text-[#171e19]">
              Project Description *
            </label>
            <textarea
              id="description"
              required
              rows={5}
              maxLength={5000}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-1 block w-full border-2 border-black px-3.5 py-2.5 text-[#171e19] font-bold text-sm outline-none focus:bg-[#ffe17c]/20"
              placeholder="Provide clear specifications, target features, and delivery expectations..."
            />
          </div>

          {/* Requirement 10: integrity_ack checkbox required in UI */}
          <div className="bg-[#ffe17c]/30 border-2 border-black p-4 neo-shadow-sm">
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="integrityAck"
                  name="integrityAck"
                  type="checkbox"
                  required
                  checked={formData.integrityAck}
                  onChange={(e) => setFormData({ ...formData, integrityAck: e.target.checked })}
                  className="h-4 w-4 border-2 border-black text-[#171e19] focus:ring-0 cursor-pointer"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="integrityAck" className="font-cabinet font-black text-[#171e19] cursor-pointer uppercase text-xs tracking-wider">
                  Project Integrity Statement (Required) *
                </label>
                <p className="text-gray-800 font-medium text-xs mt-0.5">
                  I confirm that this project specification represents genuine work requirements, does not violate any academic or commercial integrity rules, and that I agree to abide by the BuildMate platform milestones and escrow terms.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !formData.integrityAck}
              className="neo-btn w-full inline-flex justify-center items-center px-4 py-3 bg-[#171e19] text-[#ffe17c] text-sm font-black uppercase tracking-wider border-2 border-black neo-shadow disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isSubmitting ? "Submitting Project..." : "Submit Project →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
