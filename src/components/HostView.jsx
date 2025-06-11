import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import categories from "../data/tmfCategories.json";
import ScoreboardView from "./ScoreboardView";
function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function HostView({ gameCode, onBack }) {
  const [players, setPlayers] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [status, setStatus] = useState("waiting");
  const [gameData, setGameData] = useState(null);
  const [gameMode, setGameMode] = useState("basic");

  const [useCustom, setUseCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customItems, setCustomItems] = useState(["", "", "", "", ""]);
  const [targetPlayer, setTargetPlayer] = useState("");

  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);
    const unsubscribe = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGameData(data);
        setPlayers(data.players || []);
        setSelectedCategory(data.selectedCategory || null);
        setStatus(data.status || "waiting");
        setGameMode(data.gameMode || "basic");
        setTargetPlayer(data.targetPlayer || "");
      }
    });
    return () => unsubscribe();
  }, [gameCode]);

  const handleCategorySelect = async (category) => {
    const gameRef = doc(db, "games", gameCode);
    const randomizedCategory = {
    ...category,
    items: shuffleArray(category.items).slice(0, 5)
  };

  setSelectedCategory(randomizedCategory);
    await updateDoc(gameRef, {
      selectedCategory: category
    });
  };

  const handleSaveCustomCategory = async () => {
    const customCategory = {
      title: customTitle,
      items: customItems,
      isCustom: true
    };
    setSelectedCategory(customCategory);
    const gameRef = doc(db, "games", gameCode);
    await updateDoc(gameRef, {
      selectedCategory: customCategory
    });
  };

  const handleRandomCategory = () => {
  const random = categories[Math.floor(Math.random() * categories.length)];
  handleCategorySelect(random);
};


  const handleStartRound = async () => {
    if (!selectedCategory) return;
    const gameRef = doc(db, "games", gameCode);

    const gameUpdate = {
      status: "active",
      categoryItems: selectedCategory.items,
      revealIndex: 0,
      votes: {},
      responses: []
    };

    if (gameMode === "doYouKnowMe") {
      if (!targetPlayer) {
        alert("Please select a target player!");
        return;
      }
      gameUpdate.targetPlayer = targetPlayer;
    }

    await updateDoc(gameRef, gameUpdate);
  };

  if (gameData?.status === "scoreboard") {
    return (
      <ScoreboardView
        players={gameData.players || []}
        onNext={async () => {
          const gameRef = doc(db, "games", gameCode);
          await updateDoc(gameRef, { status: "waiting" });
        }}
      />
    );
  }

  return (
    <div className="max-w-xl mx-auto mt-10 p-4 bg-white shadow rounded">
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

      {/* CATEGORY SELECTION */}
      <div className="mb-4">
        <h3 className="font-semibold mb-2">🧠 Select a Category</h3>
        <select
          className="w-full border rounded p-2 mb-2"
          value={selectedCategory?.title || ""}
          onChange={(e) => {
            const cat = categories.find(c => c.title === e.target.value);
            handleCategorySelect(cat);
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
        <label className="inline-flex items-center">
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
          <h3 className="font-semibold mb-2">🧠 Enter Custom Category</h3>
          <input
            type="text"
            placeholder="Category Title"
            className="w-full border rounded p-2 mb-2"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
          />
          {customItems.map((item, idx) => (
            <input
              key={idx}
              type="text"
              placeholder={`Item ${idx + 1}`}
              className="w-full border rounded p-2 mb-2"
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

      {/* GAME MODE */}
      <div className="mb-4">
        <h3 className="font-semibold mb-2">🎮 Game Mode</h3>
        <select
          className="w-full border rounded p-2"
          value={gameMode}
          onChange={async (e) => {
            const newMode = e.target.value;
            setGameMode(newMode);
            const gameRef = doc(db, "games", gameCode);
            await updateDoc(gameRef, {
              gameMode: newMode
            });
          }}
        >
          <option value="basic">We're Basic (default)</option>
          <option value="doYouKnowMe">Do You Know Me?</option>
        </select>
      </div>

      {/* SELECT TARGET PLAYER (for Do You Know Me) */}
      {gameMode === "doYouKnowMe" && (
        <div className="mb-4">
          <h3 className="font-semibold mb-2">🎯 Choose the Target Player</h3>
          <select
            className="w-full border rounded p-2"
            value={targetPlayer}
            onChange={(e) => setTargetPlayer(e.target.value)}
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

      {/* START ROUND BUTTON */}
      {selectedCategory && (
        <div className="text-center mb-4">
          <button
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
            onClick={handleStartRound}
          >
            🚀 Start Round
          </button>
        </div>
      )}

      <div className="text-center">
        <button
          className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
          onClick={onBack}
        >
          🔙 Back to Menu
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
        <p><strong>Game Mode:</strong> {gameMode}</p>
        <p><strong>Target Player:</strong> {targetPlayer || "None"}</p>
      </div>
    </div>
  );
}

export default HostView;
