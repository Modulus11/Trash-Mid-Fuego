// src/App.js
import React, { useState } from "react";
import CategoryCard from "./components/CategoryCard";
import RankingBoard from "./components/RankingBoard";
import JoinGame from "./components/JoinGame";
import  categories  from "./data/tmfCategories.json"; // This should be 'tmfCategories.json' as per your setup
import { db, rtdb } from "./firebase";
import HostView from "./components/HostView";
import PlayerView from "./components/PlayerView";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect } from "react";
import RevealView from "./components/RevealView";
import ScoreboardView from "./components/ScoreboardView";
import { ref, set, onDisconnect, remove } from "firebase/database";

// Define your game modes here
export const GAME_MODES = {
  BASIC: 'basic',
  DO_YOU_KNOW_ME: 'doYouKnowMe',
  POISON_ROUND: 'poisonRound',
  HOT_TAKE: 'hotTake',
  // 'createYourOwnCategories' is implicitly handled by HostView logic
};

// ... (existing App.js code, e.g., App component definition, state, createTestGameRoom)

function App() {
  const [mode, setMode] = useState("menu"); // 'menu' | 'solo' | 'multi'
  const [player, setPlayer] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [hostUid, setHostUid] = useState(null);

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
  const currentCategory = categories[round]; // Assuming categories from categories.js

  const handleNext = () => {
    setShowBoard(false);
    setTimeout(() => {
      setRound((prev) => (prev + 1) % categories.length);
      setShowBoard(true);
    }, 100);
  };

  // Firebase test room creation (no changes, just ensured initialization of new fields)
  const createTestGameRoom = async () => {
    const generateCode = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    };
    const generateUid = () => {
      return Array.from({ length: 20 }, () => Math.floor(Math.random() * 36).toString(36)).join("");
    };
    const gameCode = generateCode();
    const hostName = prompt("Enter your name (you'll be the host):");
    if (!hostName) return;
    const newHostUid = generateUid();
    try {
      await setDoc(doc(db, "games", gameCode), {
        createdAt: new Date().toISOString(),
        selectedCategory: null,
        status: "waiting",
        players: [
          {
            name: hostName,
            isHost: true,
            joinedAt: new Date().toISOString(),
            score: 0
          }
        ],
        gameMode: GAME_MODES.BASIC,
        targetPlayer: null,
        kingPlayerName: null,
        poisonItem: null,
        revealIndex: 0,
        votes: {},
        responses: [],
        rounds: []
      });
      // Host presence in RTDB
      const presenceRef = ref(rtdb, `/presence/${gameCode}/${newHostUid}`);
      await set(presenceRef, { alive: true, ts: Date.now() });
      onDisconnect(presenceRef).remove();
      setHostUid(newHostUid);
      setPlayer({
        name: hostName,
        gameCode: gameCode,
        isHost: true,
        hostUid: newHostUid
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

      {/* MAIN MENU (no changes) */}
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

      {/* SOLO MODE (no changes) */}
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

      {mode === "multi" && player && gameData ? ( // gameData must be present to route by status
        gameData.status === "active" ? (
          <PlayerView player={player} gameData={gameData} onLeave={() => { setPlayer(null); setMode('menu'); setGameData(null); }} />
        ) : gameData.status === "reveal" ? (
          <RevealView player={player} gameCode={player.gameCode} gameData={gameData} />
        ) : gameData.status === "scoreboard" ? (
          <ScoreboardView
            players={gameData.players || []}
            rounds={gameData.rounds || []}
            onNext={async () => {
              const gameRef = doc(db, "games", player.gameCode);
              await setDoc(gameRef, {
                createdAt: gameData.createdAt,
                selectedCategory: null,
                status: "waiting", // Reset to waiting for next round setup
                players: gameData.players.map(p => ({...p, score: p.score || 0})), // Maintain scores
                gameMode: GAME_MODES.BASIC, // Reset to default mode
                targetPlayer: null,
                kingPlayerName: null,
                poisonItem: null,
                revealIndex: 0,
                votes: {},
                responses: [],
                rounds: gameData.rounds || [] // Keep history
              }, { merge: true });
            }}
          />
        ) : gameData.status === "waiting" && player.isHost ? ( // Host is in lobby setup
          <HostView
            gameCode={player.gameCode}
            gameData={gameData}
            hostUid={player.hostUid || hostUid}
            onBack={() => {
              setPlayer(null);
              setMode("menu");
              setGameData(null);
            }}
          />
        ) : gameData.status === "waiting" && !player.isHost ? ( // Non-host player is in lobby (waiting)
          <PlayerView player={player} gameData={gameData} onLeave={() => { setPlayer(null); setMode('menu'); setGameData(null); }} />
        ) : gameData.status === "kingChoosingPoison" ? ( // NEW: intermediate status for King's choice
          <PlayerView player={player} gameData={gameData} onLeave={() => { setPlayer(null); setMode('menu'); setGameData(null); }} />
        ) : (
          <div className="text-center mt-20">Loading game or unknown status...</div>
        )
      ) : ( // player is truthy, but gameData is still null (initial load)
        <div className="text-center mt-20">Loading game data...</div>
      )}
    </div>
  );
}

export default App;