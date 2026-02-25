import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="w-full border-b border-neutral-800 bg-black text-white">
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          Nick Sorkin
        </Link>

        <div className="flex gap-8 text-sm">
          <Link href="/" className="hover:text-neutral-400 transition">
            Home
          </Link>
          <Link href="/projects" className="hover:text-neutral-400 transition">
            Projects
          </Link>
          <Link href="/about" className="hover:text-neutral-400 transition">
            About
          </Link>
          <Link href="/contact" className="hover:text-neutral-400 transition">
            Contact
          </Link>
        </div>
      </div>
    </nav>
  );
}
