"use client";

import { FarcasterActions } from "@/components/Home/FarcasterActions";
import { User } from "@/components/Home/User";
import { WalletActions } from "@/components/Home/WalletActions";
import HockeyGame from "@/components/HockeyGame";
import { useState } from "react";

export default function Home() {
  const [showSettings, setShowSettings] = useState(false);
  const [showGame, setShowGame] = useState(false);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 space-y-8">
      {/* Play Button */}
      {!showGame && (
        <button
          className="mb-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          onClick={() => setShowGame(true)}
        >
          PLAY
        </button>
      )}
      {/* Hockey Game */}
      {showGame && <HockeyGame />}
      {/* Settings Button and Content */}
      {!showGame && (
        <>
          <button
            className="mb-4 px-6 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 transition"
            onClick={() => setShowSettings((prev) => !prev)}
          >
            {showSettings ? "Hide Settings" : "Settings"}
          </button>
          {showSettings && (
            <>
              <h1 className="text-3xl font-bold text-center">
                Monad Farcaster MiniApp Template
              </h1>
              <div className="w-full max-w-4xl space-y-6">
                <User />
                <FarcasterActions />
                <WalletActions />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
