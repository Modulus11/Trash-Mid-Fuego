// src/App.js
import React, { useState } from "react";
import CategoryCard from "./components/CategoryCard";
import RankingBoard from "./components/RankingBoard";
import JoinGame from "./components/JoinGame";
import { categories } from "./data/categories";
import { db } from "./firebase";
import HostView from "./components/HostView";
import PlayerView from "./components/PlayerView";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect } from "react";
import RevealView from "./components/RevealView";
import ScoreboardView from "./components/ScoreboardView"; // Ensure ScoreboardView is imported

// Define your game modes here
export const GAME_MODES = {
  BASIC: 'basic',
  DO_YOU_KNOW_ME: 'doYouKnowMe',
  POISON_ROUND: 'poisonRound', // NEW
  HOT_TAKE: 'hotTake',         // NEW
  // 'createYourOwnCategories' is implicitly handled by HostView logic
};

function App() {
  const [mode, setMode] = useState("menu"); // 'menu' | 'solo' | 'multi'
  const [player, setPlayer] = useState(null);
  const [gameData, setGameData] = useState(null); // This will hold all game state from Firebase

  useEffect(() => {
    if (!player) return;

    const gameRef = doc(db, "games", player.gameCode);
    const unsub = onSnapshot(gameRef, (snap) => {
      if (snap.exists()) {
        setGameData(snap.data());
      }
    });

    return () => unsub();
  }, [player]);

  // Solo mode state (no changes)
  const [round, setRound] = useState(0);
  const [showBoard, setShowBoard] = useState(true);
  const currentCategory = categories[round];

  const handleNext = () => {
    setShowBoard(false);
    setTimeout(() => {
      setRound((prev) => (prev + 1) % categories.length);
      setShowBoard(true);
    }, 100);
  };

  // Firebase test room creation (no changes)
  const createTestGameRoom = async () => {
    const generateCode = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    };

    const gameCode = generateCode();

    const hostName = prompt("Enter your name (you’ll be the host):");

    if (!hostName) return;

    try {
      await setDoc(doc(db, "games", gameCode), {
        createdAt: new Date().toISOString(),
        selectedCategory: null, // Initialize without a selected category
        status: "waiting", // Start in waiting phase
        players: [
          {
            name: hostName,
            isHost: true,
            joinedAt: new Date().toISOString(),
            score: 0 // Initialize score for host
          }
        ],
        gameMode: GAME_MODES.BASIC, // Default game mode
        targetPlayer: null, // For Do You Know Me
        kingPlayerName: null, // For Poison Round
        poisonItem: null, // For Poison Round
        revealIndex: 0,
        votes: {},
        responses: [],
        rounds: []
      });

      // Set host as the player
      setPlayer({
        name: hostName,
        gameCode: gameCode,
        isHost: true
      });

      setMode("multi");
    } catch (error) {
      console.error("Error creating game room:", error);
      alert("Failed to create game room");
    }
  };


  return (
    <div className="App p-4 max-w-5xl mx-auto">
      <h1 className="text-4xl font-bold text-center mt-6">🔥 Trash, Mid, Fuego</h1>
      <p className="text-center text-lg mb-4">Prototype Playground</p>

      {/* MAIN MENU */}
      {mode === "menu" && (
        <div className="text-center mt-10 space-y-4">
          <button
            className="bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700"
            onClick={() => setMode("multi")}
          >
            🌐 Join Multiplayer Game
          </button> <br/>
          <button
            className="bg-yellow-500 text-white px-6 py-3 rounded hover:bg-yellow-600"
            onClick={createTestGameRoom}
          >
            👑 Create Game (Host)
          </button>
        </div>
      )}

      {/* SOLO MODE */}
      {mode === "solo" && (
        <>
          <CategoryCard title={currentCategory.title} items={currentCategory.items} />
          {showBoard && <RankingBoard items={currentCategory.items} />}
          <div className="text-center mt-8 space-y-4">
            <button
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
              onClick={handleNext}
            >
              ➡️ Next Category
            </button>

            <div>
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                onClick={createTestGameRoom}
              >
                🧪 Create Test Game Room
              </button>
            </div>

            <div>
              <button
                className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500 mt-4"
                onClick={() => setMode("menu")}
              >
                🔙 Back to Menu
              </button>
            </div>
          </div>
        </>
      )}

      {/* MULTIPLAYER MODE */}
      {mode === "multi" && !player && (
        <>
          <JoinGame onJoin={setPlayer} />
          <div className="text-center mt-6">
            <button
              className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
              onClick={() => setMode("menu")}
            >
              🔙 Back to Menu
            </button>
          </div>
        </>
      )}

      {mode === "multi" && player && (
        gameData?.status === "active" ? (
          <PlayerView player={player} gameData={gameData} /> 
        ) : gameData?.status === "reveal" ? 
          <RevealView player={player} gameCode={player.gameCode} gameData={gameData} />
        : gameData?.status === "scoreboard" ? ( // Added scoreboard condition
          <ScoreboardView
            players={gameData.players || []}
            rounds={gameData.rounds || []}
            onNext={async () => {
              const gameRef = doc(db, "games", player.gameCode);
              await setDoc(gameRef, {
                createdAt: gameData.createdAt, // Keep original creation time
                selectedCategory: null,
                status: "waiting",
                players: gameData.players.map(p => ({...p, score: p.score || 0})), // Maintain scores unless you want to reset
                gameMode: GAME_MODES.BASIC, // Reset to default mode
                targetPlayer: null,
                kingPlayerName: null,
                poisonItem: null,
                revealIndex: 0,
                votes: {},
                responses: [],
                rounds: gameData.rounds || [] // Keep history of rounds
              }, { merge: true }); // Use merge to avoid overwriting entire document
            }}
          />
        ) : player.isHost ? (
          <HostView
            gameCode={player.gameCode}
            gameData={gameData} // Pass gameData
            onBack={() => {
              setPlayer(null);
              setMode("menu");
              setGameData(null);
            }}
          />
        ) : (
          <PlayerView player={player} gameData={gameData} /> 
        )
      )}
    </div>
  );
}

export default App;