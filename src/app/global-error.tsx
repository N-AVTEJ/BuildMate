"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalErrorBoundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-xl border border-zinc-200 p-8 shadow-sm text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
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
          <h2 className="text-xl font-bold text-zinc-900 mb-2">
            Critical Application Error
          </h2>
          <p className="text-sm text-zinc-600 mb-6">
            The application experienced an unexpected fatal error. Our technical team has been alerted.
          </p>
          {error.digest && (
            <p className="text-xs font-mono text-zinc-400 mb-6 bg-zinc-50 py-1.5 px-2.5 rounded">
              Error Digest: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
