"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to client console or monitoring service
    console.error("[ClientErrorBoundary]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm text-center">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-950/50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
          We encountered an unexpected error while loading this page. Our team has been notified.
        </p>
        {error.digest && (
          <p className="text-xs font-mono text-zinc-400 dark:text-zinc-500 mb-6 bg-zinc-50 dark:bg-zinc-800/50 py-1.5 px-2.5 rounded">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg text-sm font-medium transition-colors text-center"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
