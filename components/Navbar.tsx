import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="w-full border-b border-neutral-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
        
        {/* Brand */}
        <Link
          href="/"
          className="text-base sm:text-lg font-semibold tracking-tight whitespace-nowrap text-[#3E2F1C]/80"
        >
          Nick Sorkin
        </Link>

        {/* Links */}
        <div className="flex gap-4 sm:gap-8 text-xs sm:text-sm text-neutral-600">
          <Link href="/" className="hover:text-black transition">
            Home
          </Link>
          <Link href="/projects" className="hover:text-black transition">
            Projects
          </Link>
          <Link href="/about" className="hover:text-black transition">
            About
          </Link>
          <Link href="/contact" className="hover:text-black transition">
            Contact
          </Link>
        </div>
      </div>
    </nav>
  );
}
