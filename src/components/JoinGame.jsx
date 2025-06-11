import React, { useState } from "react";
import { doc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { db } from "../firebase";

function JoinGame({ onJoin }) {
  const [name, setName] = useState("");
  const [gameCode, setGameCode] = useState("");
  const [error, setError] = useState("");

  const handleJoin = async () => {
    setError("");

    if (!name || !gameCode) {
      setError("Enter both your name and a game code.");
      return;
    }

    const gameRef = doc(db, "games", gameCode.toUpperCase());
    const gameSnap = await getDoc(gameRef);

    if (!gameSnap.exists()) {
      setError("Game not found. Check the code and try again.");
      return;
    }

    try {
      await updateDoc(gameRef, {
        players: arrayUnion({ name, joinedAt: new Date().toISOString() })
      });

      onJoin({ name, gameCode: gameCode.toUpperCase() }); // pass data up
    } catch (err) {
      console.error(err);
      setError("Failed to join game. Try again.");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-4 bg-white shadow rounded">
      <h2 className="text-xl font-bold mb-4 text-center">🎮 Join a Game</h2>

      <input
        className="w-full mb-2 p-2 border rounded"
        type="text"
        placeholder="Your Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        className="w-full mb-4 p-2 border rounded"
        type="text"
        placeholder="Game Code"
        value={gameCode}
        onChange={(e) => setGameCode(e.target.value)}
      />

      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

      <button
        className="bg-green-600 text-white px-4 py-2 w-full rounded hover:bg-green-700"
        onClick={handleJoin}
      >
        ✅ Join Game
      </button>
    </div>
  );
}

export default JoinGame;
