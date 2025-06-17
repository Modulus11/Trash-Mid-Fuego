// src/components/PlayerView.jsx
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { doc, onSnapshot, updateDoc, arrayUnion } from "firebase/firestore";
import RankingBoard from "./RankingBoard";
import ScoreboardView from "./ScoreboardView";
import { GAME_MODES } from "../App"; // Import GAME_MODES

const TIERS = ["FUEGO", "MID", "TRASH"];
const tierIcons = {
  FUEGO: "🔥",
  MID: "😐",
  TRASH: "🗑️"
};

// Updated props: player and gameData from App.js
function PlayerView({ player, gameData }) {
  const [placements, setPlacements] = useState({});
  const [locked, setLocked] = useState(false);

  // Directly use gameData props
  const gameMode = gameData?.gameMode || GAME_MODES.BASIC;
  const targetPlayer = gameData?.targetPlayer || null;
  const kingPlayerName = gameData?.kingPlayerName || null; // NEW for Poison Round

  const gameRef = doc(db, "games", player.gameCode);

  useEffect(() => {
    // When gameData updates from Firebase, check if player has already submitted
    if (gameData?.responses) {
      const playerResponse = gameData.responses.find(r => r.name === player.name);
      if (playerResponse) {
        setPlacements(playerResponse.placements);
        setLocked(true); // Lock if already submitted
      } else {
        setLocked(false); // Unlock if not yet submitted for this round
        setPlacements({}); // Clear placements for new round
      }
    }
  }, [gameData, player.name]);


  const handleRankingChange = (newPlacements) => {
    setPlacements(newPlacements);
  };

  const handleLockIn = async () => {
    // Check if all items are ranked before locking in
    const categoryItems = gameData.selectedCategory?.items || [];
    const allItemsRanked = categoryItems.every(item => placements[item]);

    if (!allItemsRanked) {
      alert("Please rank all items before locking in!");
      return;
    }

    try {
      // Remove any existing response for this player first to prevent duplicates
      const filteredResponses = (gameData.responses || []).filter(r => r.name !== player.name);

      await updateDoc(gameRef, {
        responses: [...filteredResponses, {
          name: player.name,
          placements,
          submittedAt: new Date().toISOString(),
          score: 0 // 👈 start with 0, updated later after reveal
        }]
      });
      setLocked(true);
    } catch (err) {
      console.error("Error locking in:", err);
    }
  };


  const handleReveal = async () => {
    // This button should only appear for the host and if all players submitted
    try {
      await updateDoc(gameRef, {
        status: "reveal"
      });
    } catch (err) {
      console.error("Error starting reveal:", err);
    }
  };

  // If game status is scoreboard, App.js routes to ScoreboardView directly
  if (gameData.status === "scoreboard") {
      // This part should technically not be reached if App.js routes correctly
      return <p className="text-center mt-8">Transitioning to scoreboard...</p>;
  }

  if (gameData.status !== "active") {
    return (
      <div className="text-center mt-20">
        <p className="text-xl text-gray-700">⏳ Waiting for host to start the round…</p>
        <p className="text-lg text-gray-600">Game Code: {player.gameCode}</p>
        <h3 className="text-xl mt-4">Players in Lobby:</h3>
              <ul className="list-disc list-inside">
                {gameData.players.map(p => <li key={p.name}>{p.name}</li>)}
              </ul>
      </div>
    );
  }

  const category = gameData.selectedCategory;
  const items = category?.items || [];

  const totalPlayers = gameData.players?.length || 0;
  const totalResponses = gameData.responses?.length || 0;
  const allSubmitted = totalResponses === totalPlayers;

  return (
    <div className="max-w-5xl mx-auto mt-8 p-4 bg-white shadow rounded text-gray-800">
      <h2 className="text-2xl font-bold text-center mb-4">
        📝 {gameMode === GAME_MODES.DO_YOU_KNOW_ME
          ? `Guess how ${targetPlayer} will rank "${category?.title}"`
          : `Rank This: "${category?.title}"`}
      </h2>
      <p className="text-center text-xl font-semibold mb-2">
          Mode: <span className="underline">{gameMode.replace(/([A-Z])/g, ' $1').trim()}</span> {/* Display current mode nicely */}
      </p>

      {gameMode === GAME_MODES.POISON_ROUND && kingPlayerName && (
        <p className="text-center text-md text-red-600 mb-2">King: {kingPlayerName}</p>
      )}

      {gameData.players && ( // Ensure players array exists before trying to find player score
        <p className="text-center text-lg text-gray-600 mb-2">
          Your Score:{" "}
          <strong>
            {gameData.players.find((p) => p.name === player.name)?.score || 0}
          </strong>
        </p>
      )}

      <RankingBoard
        items={items}
        onRankingChange={handleRankingChange}
        lockedIn={locked}
        initialPlacements={placements} // Pass initial placements for pre-filled board
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

        {/* 🧨 Reveal Button (Host Only, and all submitted) */}
        {player.isHost && (
          <button
            className={`px-6 py-2 rounded text-white ${
              allSubmitted
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-400 cursor-not-allowed"
            } ml-4`} 
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