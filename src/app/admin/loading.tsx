export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-[#fffdf0] neo-dots">
      {/* Skeleton Header */}
      <header className="bg-[#ffe17c] border-b-2 border-black sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#171e19] border-2 border-black animate-pulse" />
            <div className="h-6 w-32 bg-black/20 rounded animate-pulse" />
            <div className="hidden sm:block h-6 w-28 bg-[#171e19]/30 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-28 bg-white border-2 border-black rounded animate-pulse" />
            <div className="h-8 w-20 bg-white border-2 border-black rounded animate-pulse" />
          </div>
        </div>
      </header>

      {/* Main Content Skeleton */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Welcome Banner Skeleton */}
        <div className="bg-white border-2 border-black rounded-2xl p-6 mb-8 neo-shadow-md animate-pulse">
          <div className="h-7 w-64 bg-gray-300 rounded mb-2" />
          <div className="h-4 w-96 max-w-full bg-gray-200 rounded" />
        </div>

        {/* Tab Strip Skeleton */}
        <div className="flex gap-2 mb-6 border-b-2 border-black pb-2">
          <div className="h-10 w-36 bg-[#ffe17c] border-2 border-black rounded-lg animate-pulse" />
          <div className="h-10 w-36 bg-white border-2 border-black rounded-lg animate-pulse" />
          <div className="h-10 w-36 bg-white border-2 border-black rounded-lg animate-pulse" />
        </div>

        {/* Data Table Skeleton */}
        <div className="bg-white border-2 border-black rounded-2xl p-6 neo-shadow-sm animate-pulse space-y-4">
          <div className="h-6 w-48 bg-gray-300 rounded" />
          <div className="h-12 w-full bg-gray-100 rounded" />
          <div className="h-12 w-full bg-gray-100 rounded" />
          <div className="h-12 w-full bg-gray-100 rounded" />
        </div>
      </main>
    </div>
  );
}
