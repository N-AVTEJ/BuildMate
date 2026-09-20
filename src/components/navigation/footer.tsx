import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white py-6 text-sm text-gray-500 mt-auto">
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-gray-900 tracking-tight">BuildMate</span>
          <span>&copy; {new Date().getFullYear()} BuildMate Platform. All rights reserved.</span>
        </div>
        <div className="flex items-center space-x-6">
          <Link href="/terms" className="hover:text-gray-900 transition">
            Terms of Service
          </Link>
          <Link href="/privacy" className="hover:text-gray-900 transition">
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
