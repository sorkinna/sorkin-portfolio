export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-5xl font-bold mb-6">
        Welcome to NickSorkin.com
      </h1>

      <p className="text-neutral-400 max-w-xl mb-10">
        There will be more to come in the future but for now travel to Projects -&gt; Survivor Fantasy Tracker
        to view the live standings of our Survivor league!
      </p>

      <div className="flex gap-6">
        <a
          href="/projects"
          className="px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition"
        >
          View Projects
        </a>

        <a
          href="/about"
          className="px-6 py-3 border border-neutral-600 rounded-lg hover:bg-neutral-900 transition"
        >
          About Me
        </a>
      </div>
    </div>
  );
}
