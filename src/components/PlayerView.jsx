// src/components/PlayerView.jsx
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { rtdb } from "../firebase";
import { ref, onValue } from "firebase/database";
import { doc, updateDoc } from "firebase/firestore";
import RankingBoard from "./RankingBoard";
import ScoreboardView from "./ScoreboardView";
import { GAME_MODES } from "../App"; // Import GAME_MODES

// Utility function (already defined, ensure it's at the top of file)
const capitalizeWords = (str) => {
  if (!str) return '';
  return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

const TIERS = ["FUEGO", "MID", "TRASH"];
const tierIcons = {
  FUEGO: "🔥",
  MID: "😐",
  TRASH: "🗑️"
};

function PlayerView({ player, gameData, onLeave }) {
  const [placements, setPlacements] = useState({});
  const [locked, setLocked] = useState(false);
  const [localPoisonItem, setLocalPoisonItem] = useState(''); // For King's selection
  const [hostPresent, setHostPresent] = useState(true);
  const [leaving, setLeaving] = useState(false);

  // Now gameMode, targetPlayer, kingPlayerName directly use the gameData prop
  const gameMode = gameData?.gameMode || GAME_MODES.BASIC;
  const targetPlayer = gameData?.targetPlayer || null;
  const kingPlayerName = gameData?.kingPlayerName || null;

  const gameRef = doc(db, "games", player.gameCode);

  useEffect(() => {
    if (!gameData) return; // Ensure gameData exists

    const playerResponse = gameData.responses?.find(r => r.name === player.name);

    // Case 1: Player has a submitted response in Firebase for this round
    if (playerResponse) {
      setPlacements(playerResponse.placements);
      setLocked(true);
    } else {
      // Case 2: Player has NOT submitted a response for this round yet.
      // Determine if a new round has truly started and placements should be cleared.
      // A new round means responses array is empty AND game is active,
      // OR the status is waiting/kingChoosingPoison, signaling a pre-game setup phase.
      if (
          (gameData.responses?.length === 0 && gameData.status === "active") ||
          gameData.status === "waiting" ||
          gameData.status === "kingChoosingPoison"
      ) {
        // If it's a genuinely new round OR pre-active setup phase, clear local placements.
        setPlacements({});
        setLocked(false);
      } else {
        // If game is active, but responses array is NOT empty (meaning others have submitted)
        // AND this player hasn't submitted yet, then DO NOT clear their local placements.
        // Just ensure they are unlocked.
        setLocked(false);
        // placements state should remain as is from local user interaction
      }
    }
  }, [gameData, player.name]);

  // Listen for host presence in RTDB
  useEffect(() => {
    if (!player?.gameCode) return;
    const presenceRef = ref(rtdb, `/presence/${player.gameCode}`);
    const unsubscribe = onValue(presenceRef, (snap) => {
      setHostPresent(!!(snap && snap.exists() && snap.val() && Object.keys(snap.val()).length > 0));
    });
    return () => unsubscribe();
  }, [player?.gameCode]);

  const handleRankingChange = (newPlacements) => {
    setPlacements(prev => ({
      ...prev,
      ...newPlacements,
    }));
  };

  const handleLockIn = async () => {
    const categoryItems = gameData.selectedCategory?.items || [];
    let allItemsRanked = true;
    const missingItems = [];

    console.group("--- handleLockIn Debug ---");
    console.log("Expected Category Items:", categoryItems);
    console.log("Current Placements State:", placements);

    if (categoryItems.length === 0) {
      allItemsRanked = false;
      console.warn("Category items array is empty, cannot lock in!");
    } else {
      for (const item of categoryItems) {
        const rankValue = placements[item];
        console.log(`Checking item: "${item}", stored rank: "${rankValue}"`);

        if (!rankValue || rankValue === null || rankValue === '') {
            allItemsRanked = false;
            missingItems.push(item);
            console.warn(`Item "${item}" is considered not ranked (value: "${rankValue}").`);
        }
      }
    }

    if (!allItemsRanked) {
      alert("Please rank all items before locking in!");
      console.error("Lock-in failed. Missing or invalid rankings for items:", missingItems);
      console.groupEnd();
      return;
    }

    console.log("All items are successfully ranked. Proceeding with submission.");
    console.groupEnd();
    try {
      const filteredResponses = (gameData.responses || []).filter(r => r.name !== player.name);

      await updateDoc(gameRef, {
        responses: [...filteredResponses, {
          name: player.name,
          placements,
          submittedAt: new Date().toISOString(),
          score: 0 // Will be updated later after reveal
        }]
      });
      setLocked(true);
      console.log("Rankings successfully locked in and submitted to Firebase!");
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

  // --- NEW: King's Poison Item Selection Handler ---
  const handleSetPoisonItemByKing = async () => {
    if (!localPoisonItem || !gameData.selectedCategory?.items.includes(localPoisonItem)) {
      alert('Please select a valid poison item from the current category.');
      return;
    }
    try {
      await updateDoc(gameRef, {
        poisonItem: localPoisonItem, // Set poison item in Firebase
        status: "active" // Change status to active, so players can start ranking
      });
      // No need to reset local state for poison item selection, PlayerView will re-render
    } catch (e) {
      console.error("Error setting poison item by King:", e);
    }
  };

  // Leave Game handler
  const handleLeaveGame = async () => {
    setLeaving(true);
    try {
      // Remove player from Firestore game doc
      const gameRef = doc(db, "games", player.gameCode);
      const updatedPlayers = (gameData.players || []).filter(p => p.name !== player.name);
      await updateDoc(gameRef, { players: updatedPlayers });
    } catch (e) {
      // Ignore errors
    }
    setLeaving(false);
    if (onLeave) onLeave();
  };

  // --- Render Logic ---
  if (!gameData) return <p className="text-center mt-8">Loading game data...</p>;
  if (gameData.status === "scoreboard") {
    // This part is handled by App.js directly routing to ScoreboardView
    return <p className="text-center mt-8">Transitioning to scoreboard...</p>;
  }

  // --- King's Poison Choice Phase ---
  if (gameData.status === "kingChoosingPoison") {
    if (player.name === kingPlayerName) {
      // Current player is the King: show poison selection UI
      const categoryItems = gameData.selectedCategory?.items || [];
      if (!categoryItems.length) {
        return <p className="text-center mt-8">Waiting for host to set category items for King's choice...</p>;
      }
      return (
        <div className="max-w-md mx-auto mt-8 p-4 bg-red-100 shadow rounded text-gray-800 text-center">
          <h2 className="text-2xl font-bold mb-4 text-red-700">👑 You are the King! ☠️</h2>
          <h3 className="text-xl font-semibold mb-4">Secretly Choose the POISON Item:</h3>
          <p className="text-lg mb-4">Category: {gameData.selectedCategory?.title}</p>
          <select
            className="w-full border rounded p-2 mb-4 text-gray-800"
            value={localPoisonItem}
            onChange={(e) => setLocalPoisonItem(e.target.value)}
          >
            <option value="">-- Select Poison Item --</option>
            {categoryItems.map((item, idx) => (
              <option key={idx} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button
            className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 w-full"
            onClick={handleSetPoisonItemByKing}
            disabled={!localPoisonItem}
          >
            ✅ Set Poison & Start Round
          </button>
        </div>
      );
    } else {
      // Other players: show waiting message
      return (
        <div className="text-center mt-20">
          <p className="text-xl text-gray-700">⏳ Waiting for the King ({kingPlayerName}) to choose the poison item...</p>
          <p className="text-lg text-gray-600 mt-2">Game Code: {player.gameCode}</p>
        </div>
      );
    }
  }

  // --- Normal Game Phases (active, reveal, waiting in lobby for non-host) ---
  if (!hostPresent) {
    return (
      <div className="text-center mt-20">
        <p className="text-2xl text-red-600 font-bold mb-4">The host has ended the game or disconnected.</p>
        <button
          className="bg-gray-700 text-white px-6 py-3 rounded hover:bg-gray-900"
          onClick={onLeave}
        >
          🔙 Return to Main Menu
        </button>
      </div>
    );
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
        <button
          className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500 mt-6"
          onClick={handleLeaveGame}
          disabled={leaving}
        >
          {leaving ? 'Leaving...' : '🚪 Leave Game'}
        </button>
      </div>
    );
  }

  // Only render RankingBoard if status is 'active'
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
          Mode: <span className="underline">{capitalizeWords(gameMode.replace(/([A-Z])/g, ' $1').trim())}</span>
      </p>

      {gameMode === GAME_MODES.POISON_ROUND && kingPlayerName && (
        <p className="text-center text-md text-red-600 mb-2">King: {kingPlayerName}</p>
      )}

      {gameData.players && (
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
        initialPlacements={placements}
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