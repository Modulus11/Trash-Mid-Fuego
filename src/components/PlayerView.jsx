import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { doc, onSnapshot, updateDoc, arrayUnion } from "firebase/firestore";
import RankingBoard from "./RankingBoard";
import ScoreboardView from "./ScoreboardView";

const TIERS = ["FUEGO", "MID", "TRASH"];
const tierIcons = {
  FUEGO: "🔥",
  MID: "😐",
  TRASH: "🗑️"
};

function PlayerView({ player }) {
  const [gameData, setGameData] = useState(null);
  const [placements, setPlacements] = useState({});
  const [locked, setLocked] = useState(false);
  const gameMode = gameData?.gameMode || "basic";
const targetPlayer = gameData?.targetPlayer || null;


  const gameRef = doc(db, "games", player.gameCode);

  useEffect(() => {
    const unsub = onSnapshot(gameRef, (snap) => {
      if (snap.exists()) {
        setGameData(snap.data());
      }
    });
    return () => unsub();
  }, [player.gameCode]);

  const handleRankingChange = (newPlacements) => {
    setPlacements(newPlacements);
  };

  const handleLockIn = async () => {
    try {
      await updateDoc(gameRef, {
        responses: arrayUnion({
          name: player.name,
          placements,
          submittedAt: new Date().toISOString(),
          score: 0 // 👈 start with 0, updated later after reveal
        })
      });
      setLocked(true);
    } catch (err) {
      console.error("Error locking in:", err);
    }
  };


  const handleReveal = async () => {
    try {
      await updateDoc(gameRef, {
        status: "reveal"
      });
    } catch (err) {
      console.error("Error starting reveal:", err);
    }
  };

  if (!gameData) return <p className="text-center mt-8">Loading game data...</p>;
if (gameData.status === "scoreboard") {
  return (
    <ScoreboardView
      players={gameData.players || []}
      onNext={player?.isHost ? async () => {
        const gameRef = doc(db, "games", player.gameCode);
        await updateDoc(gameRef, { status: "waiting" });
      } : null}
    />
  );
}
  if (gameData.status !== "active") {
    return (
      <div className="text-center mt-20">
        <p className="text-xl text-gray-700">⏳ Waiting for host to start the round…</p>
      </div>
    );
  }

  const category = gameData.selectedCategory;
  const items = category?.items || [];

  const totalPlayers = gameData.players?.length || 0;
  const totalResponses = gameData.responses?.length || 0;
  const allSubmitted = totalResponses === totalPlayers;

  return (
    
    <div className="max-w-5xl mx-auto mt-8">
      <h2 className="text-2xl font-bold text-center mb-4">
  📝 {gameMode === "doYouKnowMe"
    ? `Guess how ${targetPlayer} will rank ${category?.title}`
    : `Rank This: ${category?.title}`}
</h2>


      {gameData.responses && (
        <p className="text-center text-lg text-gray-600 mb-2">
          Your Score:{" "}
          <strong>
            {
  gameData.players.find((p) => p.name === player.name)?.score || 0
}

          </strong>
        </p>
      )}

      <RankingBoard
        items={items}
        onRankingChange={handleRankingChange}
        lockedIn={locked}
      />

      <div className="text-center mt-6 space-y-4">
        <button
          className={`px-6 py-2 rounded text-white ${
            locked
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700"
          }`}
          onClick={handleLockIn}
          disabled={locked}
        >
          {locked ? "✅ Locked In" : "🔒 Lock In My Rankings"}
        </button>

        {/* 🧨 Reveal Button (Host Only) */}
        {player.isHost && (
          <button
            className={`px-6 py-2 rounded text-white ${
              allSubmitted
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
            onClick={handleReveal}
            disabled={!allSubmitted}
          >
            📢 Reveal Results
          </button>
        )}
      </div>
    </div>
  );
}

export default PlayerView;
