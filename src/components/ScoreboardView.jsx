// components/ScoreboardView.jsx
import React from "react";

function ScoreboardView({ players, onNext, rounds = [] }) {
  const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  const lastRound = rounds[rounds.length - 1];

  const getMedal = (index) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return "";
  };

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded shadow text-gray-800">
      <h2 className="text-3xl font-bold text-center mb-4">🏆 Scoreboard</h2>
      
      <ul className="space-y-2 mb-6">
        {sorted.map((player, index) => ( // Fix: Added 'index' here for key
          <li
            key={index} // Using index as key is okay if items don't reorder/change
            className="flex justify-between items-center border p-3 rounded bg-gray-50"
          >
            <span>
              {getMedal(index)} {player.name}
            </span>
            <span className="font-bold text-lg">{player.score || 0}</span>
          </li>
        ))}
      </ul>

      {lastRound && (
        <div className="bg-yellow-100 p-4 rounded border mb-6 text-gray-800">
          <h3 className="text-lg font-semibold mb-2">📊 Last Round Summary</h3>
          <p className="mb-2 text-sm text-gray-700">
            <strong>Category:</strong> {lastRound.categoryTitle}
          </p>
          <ul className="text-sm space-y-1">
            {Object.entries(lastRound.scoresThisRound).map(([name, score]) => (
              <li key={name} className="flex justify-between">
                <span>{name}</span>
                <span>+{score} pts</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {onNext && (
        <div className="text-center">
          <button
            onClick={onNext}
            className="px-6 py-2 rounded bg-green-600 text-white hover:bg-green-700"
          >
            🔄 Start Next Round
          </button>
        </div>
      )}
    </div>
  );
}

export default ScoreboardView;