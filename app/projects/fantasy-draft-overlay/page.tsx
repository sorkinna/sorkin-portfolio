"use client";

export const dynamic = "force-dynamic";

import DraftOverlay from "./components/DraftOverlay";

export default function FantasyDraftOverlayPage() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-transparent">
      <DraftOverlay />
    </main>
  );
}
