export default function ProjectDetailLoading() {
  return (
    <div className="min-h-screen bg-[#fffdf0] neo-dots">
      {/* Skeleton Header */}
      <header className="bg-[#ffe17c] border-b-2 border-black sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#171e19] border-2 border-black animate-pulse" />
            <div className="h-6 w-32 bg-black/20 rounded animate-pulse" />
          </div>
          <div className="h-8 w-24 bg-white border-2 border-black rounded animate-pulse" />
        </div>
      </header>

      {/* Main Content Skeleton */}
      <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Project Header Card Skeleton */}
        <div className="bg-white border-2 border-black rounded-2xl p-6 sm:p-8 neo-shadow-md animate-pulse space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="h-4 w-28 bg-[#ffe17c] rounded" />
              <div className="h-8 w-64 bg-gray-300 rounded" />
            </div>
            <div className="h-6 w-24 bg-gray-200 rounded-full" />
          </div>
          <div className="h-16 w-full bg-gray-100 rounded" />
        </div>

        {/* Milestone / Action Card Skeleton */}
        <div className="bg-white border-2 border-black rounded-2xl p-6 neo-shadow-md animate-pulse space-y-4">
          <div className="h-6 w-48 bg-gray-300 rounded" />
          <div className="h-12 w-full bg-gray-100 rounded" />
          <div className="h-10 w-40 bg-gray-300 rounded-xl" />
        </div>
      </main>
    </div>
  );
}
