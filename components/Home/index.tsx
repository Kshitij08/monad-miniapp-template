"use client";

import { FarcasterActions } from "@/components/Home/FarcasterActions";
import { User } from "@/components/Home/User";
import { WalletActions } from "@/components/Home/WalletActions";
import { useState } from "react";

export default function Home() {
  const handlePlayClick = () => {
    window.open('/unity-game/index.html', '_blank', 'noopener,noreferrer');
  };
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 space-y-8">
      {/* Play Button */}
      <button
        className="mb-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        onClick={handlePlayClick}
      >
        Play
      </button>
      <h1 className="text-3xl font-bold text-center">
        Monad Farcaster MiniApp Template
      </h1>
      <div className="w-full max-w-4xl space-y-6">
        <User />
        <FarcasterActions />
        <WalletActions />
      </div>
    </div>
  );
}
