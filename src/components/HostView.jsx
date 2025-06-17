// src/components/HostView.jsx
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { doc, onSnapshot, updateDoc, setDoc } from "firebase/firestore"; // Import setDoc for clearer game room reset
import  categories  from "../data/tmfCategories.json"; // Corrected import from categories.js
import ScoreboardView from "./ScoreboardView"; // Ensure this is imported if used directly here, but App.js handles it now
import { GAME_MODES } from "../App"; // Import GAME_MODES

function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

// Updated props: gameCode and gameData from App.js
function HostView({ gameCode, gameData, onBack }) {
  const [localGameMode, setLocalGameMode] = useState(gameData?.gameMode || GAME_MODES.BASIC);
  const [localSelectedCategory, setLocalSelectedCategory] = useState(gameData?.selectedCategory?.title || "");
  const [targetPlayerName, setTargetPlayerName] = useState(gameData?.targetPlayer || ""); // For Do You Know Me
  const [kingPlayerName, setKingPlayerName] = useState(gameData?.kingPlayerName || ""); // For Poison Round King
  const [poisonItem, setPoisonItem] = useState(gameData?.poisonItem || ""); // For Poison Round item

  // State to manage the special phase for Poison Round host setup
  const [isPoisonItemSelectionPhase, setIsPoisonItemSelectionPhase] = useState(false);

  // Sync local states with gameData from Firebase
  useEffect(() => {
    if (gameData) {
      setLocalGameMode(gameData.gameMode || GAME_MODES.BASIC);
      setLocalSelectedCategory(gameData.selectedCategory?.title || "");
      setTargetPlayerName(gameData.targetPlayer || "");
      setKingPlayerName(gameData.kingPlayerName || "");
      setPoisonItem(gameData.poisonItem || "");

      // If we are in Poison Round and King is chosen but item is not, and we are not ranking yet
      if (gameData.gameMode === GAME_MODES.POISON_ROUND && gameData.kingPlayerName && !gameData.poisonItem && gameData.status === 'active') {
          setIsPoisonItemSelectionPhase(true);
      } else {
          setIsPoisonItemSelectionPhase(false); // Reset if not in this phase
      }
    }
  }, [gameData]);

  // Helper to get players from gameData
  const players = gameData?.players || [];
  const status = gameData?.status || "waiting";
  const selectedCategory = gameData?.selectedCategory;


  const handleCategorySelect = async (category) => {
    // We update Firebase directly only when starting the round, not on select
    // Local state setSelectedCategory handles the UI
    const gameRef = doc(db, "games", gameCode);
    const randomizedCategory = {
      ...category,
      items: shuffleArray(category.items).slice(0, 5) // Ensure we always take 5 items after shuffle
    };
    // Update Firebase directly on select for immediate player view update
    await updateDoc(gameRef, { selectedCategory: randomizedCategory });
  };

  const handleRandomCategory = () => {
    const random = categories[Math.floor(Math.random() * categories.length)];
    handleCategorySelect(random);
  };

  // Custom Category States (no changes, assuming they were working)
  const [useCustom, setUseCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customItems, setCustomItems] = useState(["", "", "", "", ""]);

  const handleSaveCustomCategory = async () => {
    const customCategory = {
      title: customTitle,
      items: customItems.filter(item => item.trim() !== ''), // Filter out empty items
      isCustom: true
    };
    if (customCategory.items.length === 0) {
        alert("Please enter at least one item for your custom category.");
        return;
    }
    await handleCategorySelect(customCategory); // Use the same handler to update Firebase
  };


  const handleStartRound = async () => {
    if (!selectedCategory) {
        alert("Please select a category first.");
        return;
    }
    const gameRef = doc(db, "games", gameCode);

    const gameUpdate = {
      status: "active", // Change status to active for ranking
      categoryItems: selectedCategory.items, // This might be redundant if selectedCategory is stored
      revealIndex: 0,
      // votes: {}, // 'votes' is not in current Firebase structure, 'responses' is used
      responses: [], // Reset responses for new round
      gameMode: localGameMode, // Set the selected game mode
      targetPlayer: null, // Reset target player
      kingPlayerName: null, // Reset king player
      poisonItem: null, // Reset poison item
    };

    if (localGameMode === GAME_MODES.DO_YOU_KNOW_ME) {
      if (!targetPlayerName) {
        alert("Please select a target player for 'Do You Know Me?' mode!");
        return;
      }
      gameUpdate.targetPlayer = targetPlayerName;
    } else if (localGameMode === GAME_MODES.POISON_ROUND) {
      if (!kingPlayerName) {
        alert("Please select a King for 'Poison Round'!");
        return;
      }
      gameUpdate.kingPlayerName = kingPlayerName;
      // Poison item will be selected in a next phase by the King/Host
    }

    try {
      await updateDoc(gameRef, gameUpdate);
      // Transition to poison item selection phase if it's Poison Round
      if (localGameMode === GAME_MODES.POISON_ROUND) {
          setIsPoisonItemSelectionPhase(true);
      }
    } catch (e) {
      console.error("Error starting round:", e);
    }
  };

  const handleSetPoisonItem = async () => {
      if (!poisonItem || !selectedCategory?.items.includes(poisonItem)) {
          alert('Please select a valid poison item from the current category.');
          return;
      }
      const gameRef = doc(db, "games", gameCode);
      try {
          await updateDoc(gameRef, {
              poisonItem: poisonItem, // Update Firebase with the chosen poison item
              status: "active" // Ensure status is active after poison is set
          });
          setIsPoisonItemSelectionPhase(false); // Exit the selection phase
      } catch (e) {
          console.error("Error setting poison item:", e);
      }
  };


  // No direct rendering of ScoreboardView here, App.js handles that based on status
  // if (gameData?.status === "scoreboard") { ... }

  return (
    <div className="max-w-xl mx-auto mt-10 p-4 bg-white shadow rounded text-gray-800"> {/* Added text-gray-800 for visibility */}
      <h2 className="text-2xl font-bold mb-4 text-center">👑 Host Panel</h2>
      <p className="text-center text-sm mb-4 text-gray-600">
        Game Code: <strong>{gameCode}</strong>
      </p>

      <h3 className="font-semibold mb-2">Players Joined:</h3>
      <ul className="space-y-2 mb-4">
        {players.length > 0 ? (
          players.map((player, idx) => (
            <li
              key={idx}
              className="border p-2 rounded bg-gray-100 text-center"
            >
              {player.name}
            </li>
          ))
        ) : (
          <p className="text-gray-500 italic">Waiting for players...</p>
        )}
      </ul>

      {/* Conditional rendering based on game status */}
      {status === 'waiting' ? (
        <>
          {/* CATEGORY SELECTION */}
          <div className="mb-4">
            <h3 className="font-semibold mb-2">🧠 Select a Category</h3>
            <select
              className="w-full border rounded p-2 mb-2 text-gray-800"
              value={localSelectedCategory}
              onChange={(e) => {
                const cat = categories.find(c => c.title === e.target.value);
                setLocalSelectedCategory(e.target.value); // Update local state for dropdown display
                handleCategorySelect(cat); // Update Firebase
              }}
            >
              <option value="">-- Choose a Category --</option>
              {categories.map((cat, idx) => (
                <option key={idx} value={cat.title}>
                  {cat.title}
                </option>
              ))}
            </select>
            <button
              className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 w-full"
              onClick={handleRandomCategory}
            >
              🎲 Randomize
            </button>
          </div>

          {/* TOGGLE: Use custom category */}
          <div className="mb-4">
            <label className="inline-flex items-center text-gray-800">
              <input
                type="checkbox"
                checked={useCustom}
                onChange={() => setUseCustom(!useCustom)}
                className="mr-2"
              />
              ✍️ Create My Own Category
            </label>
          </div>

          {/* CUSTOM CATEGORY FORM */}
          {useCustom && (
            <div className="mb-4 border p-4 rounded bg-yellow-50">
              <h3 className="font-semibold mb-2 text-gray-800">🧠 Enter Custom Category</h3>
              <input
                type="text"
                placeholder="Category Title"
                className="w-full border rounded p-2 mb-2 text-gray-800"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
              />
              {customItems.map((item, idx) => (
                <input
                  key={idx}
                  type="text"
                  placeholder={`Item ${idx + 1}`}
                  className="w-full border rounded p-2 mb-2 text-gray-800"
                  value={item}
                  onChange={(e) => {
                    const newItems = [...customItems];
                    newItems[idx] = e.target.value;
                    setCustomItems(newItems);
                  }}
                />
              ))}
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full"
                onClick={handleSaveCustomCategory}
                disabled={
                  !customTitle.trim() || customItems.some((item) => !item.trim())
                }
              >
                ✅ Save Custom Category
              </button>
            </div>
          )}

          {/* GAME MODE SELECTION */}
          <div className="mb-4">
            <h3 className="font-semibold mb-2">🎮 Game Mode</h3>
            <select
              className="w-full border rounded p-2 text-gray-800"
              value={localGameMode}
              onChange={(e) => {
                const newMode = e.target.value;
                setLocalGameMode(newMode); // Update local state for dropdown
                // Reset mode-specific selections if mode changes
                setTargetPlayerName("");
                setKingPlayerName("");
                setPoisonItem("");
                setIsPoisonItemSelectionPhase(false);
              }}
            >
              <option value={GAME_MODES.BASIC}>We're Basic (default)</option>
              <option value={GAME_MODES.DO_YOU_KNOW_ME}>Do You Know Me?</option>
              <option value={GAME_MODES.POISON_ROUND}>Poison Round</option> {/* NEW */}
              <option value={GAME_MODES.HOT_TAKE}>Hot Take Mode (Contrarian)</option> {/* NEW */}
            </select>
          </div>

          {/* SELECT TARGET PLAYER (for Do You Know Me) */}
          {localGameMode === GAME_MODES.DO_YOU_KNOW_ME && (
            <div className="mb-4 p-4 border rounded bg-blue-50">
              <h3 className="font-semibold mb-2 text-gray-800">🎯 Choose the Target Player</h3>
              <select
                className="w-full border rounded p-2 text-gray-800"
                value={targetPlayerName}
                onChange={(e) => setTargetPlayerName(e.target.value)}
              >
                <option value="">-- Select a Player --</option>
                {players.map((p, idx) => (
                  <option key={idx} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* SELECT KING (for Poison Round - initial selection) */}
          {localGameMode === GAME_MODES.POISON_ROUND && !isPoisonItemSelectionPhase && (
            <div className="mb-4 p-4 border rounded bg-red-50">
              <h3 className="font-semibold mb-2 text-gray-800">👑 Choose the King for Poison Round</h3>
              <select
                className="w-full border rounded p-2 text-gray-800"
                value={kingPlayerName}
                onChange={(e) => setKingPlayerName(e.target.value)}
              >
                <option value="">-- Select a Player --</option>
                {players.map((p, idx) => (
                  <option key={idx} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* POISON ITEM SELECTION (for Poison Round - second phase) */}
          {localGameMode === GAME_MODES.POISON_ROUND && isPoisonItemSelectionPhase && selectedCategory && (
            <div className="mb-4 p-4 border rounded bg-red-100">
              <h3 className="font-semibold mb-2 text-red-700">☠️ King: Secretly Choose the POISON Item!</h3>
              <select
                className="w-full border rounded p-2 text-gray-800"
                value={poisonItem}
                onChange={(e) => setPoisonItem(e.target.value)}
              >
                <option value="">-- Select Poison Item --</option>
                {selectedCategory.items.map((item, idx) => (
                  <option key={idx} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <button
                className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 mt-4 w-full"
                onClick={handleSetPoisonItem}
                disabled={!poisonItem}
              >
                ✅ Set Poison & Start Ranking
              </button>
            </div>
          )}

          {/* START ROUND BUTTON */}
          {selectedCategory && (
            <div className="text-center mb-4">
              <button
                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
                onClick={handleStartRound}
                disabled={
                    (localGameMode === GAME_MODES.DO_YOU_KNOW_ME && !targetPlayerName) ||
                    (localGameMode === GAME_MODES.POISON_ROUND && !kingPlayerName)
                }
              >
                🚀 Start Round
              </button>
            </div>
          )}
        </>
      ) : (
        // Display during active/reveal/scoreboard phases (Host can still manage)
        <div className="text-center mt-8">
            <p className="text-xl font-semibold mb-4">Game Status: {status.toUpperCase()}</p>
            {status === 'active' && <p>Players are currently ranking for: {selectedCategory?.title}</p>}
            {status === 'reveal' && <p>Results are being revealed for: {selectedCategory?.title}</p>}
            {/* The rest of the Host's in-game controls (e.g., reveal button) are now in PlayerView/RevealView and managed by App.js based on status */}
        </div>
      )}


      <div className="text-center mt-6">
        <button
          className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
          onClick={onBack}
        >
          🔙 Back to Main Menu
        </button>
      </div>

      {/* 🐞 DEBUG PANEL */}
      <div className="mt-10 p-4 bg-gray-100 border rounded text-sm font-mono text-gray-800">
        <h4 className="font-bold mb-2">🛠 Debug Info</h4>
        <p><strong>Status:</strong> {status}</p>
        <p><strong>Total Players:</strong> {players.length}</p>
        <p><strong>Selected Category:</strong> {selectedCategory?.title || "None"}</p>
        <p><strong>Responses:</strong> {gameData?.responses?.length ?? "?"}</p>
        <p><strong>Expected Responses:</strong> {players.length}</p>
        <p><strong>Game Mode (Firebase):</strong> {gameData?.gameMode || "None"}</p>
        <p><strong>Local Selected Mode:</strong> {localGameMode}</p>
        <p><strong>Target Player:</strong> {gameData?.targetPlayer || "None"}</p>
        <p><strong>King Player:</strong> {gameData?.kingPlayerName || "None"}</p>
        <p><strong>Poison Item:</strong> {gameData?.poisonItem || "None"}</p>
        <p><strong>Poison Selection Phase:</strong> {isPoisonItemSelectionPhase ? "True" : "False"}</p>
      </div>
    </div>
  );
}

export default HostView;