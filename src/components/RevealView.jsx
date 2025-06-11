import React, { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

function RevealView({ gameCode, player }) {
  const [gameData, setGameData] = useState(null);
  const revealIndex = gameData?.revealIndex || 0;

  const gameRef = doc(db, "games", gameCode);

  useEffect(() => {
    const unsub = onSnapshot(gameRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        console.log("📊 gameData received:", data);
        setGameData(data);
      } else {
        console.warn("❌ No snapshot data found");
      }
    });
    return () => unsub();
  }, [gameCode]);

  const category = gameData?.selectedCategory;
  const items = category?.items || [];

  if (
    !category ||
    !Array.isArray(items) ||
    items.length === 0 ||
    !Array.isArray(gameData?.responses)
  ) {
    console.warn("🕵️ RevealView: invalid or incomplete game data", gameData);
    return <p className="text-center mt-10">Loading reveal data…</p>;
  }

  const currentItem = items[revealIndex];
  const isLastItem = revealIndex >= items.length - 1;

  let playerRankings = [];

  if (Array.isArray(gameData.responses)) {
    try {
      playerRankings = gameData.responses
        .map((response) => ({
          name: response?.name || "Unknown",
          tier: response?.placements?.[currentItem] || "—",
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      console.error("💥 Error while building playerRankings:", err);
      playerRankings = [];
    }
  } else {
    console.warn("🚫 gameData.responses is not an array:", gameData.responses);
  }

  const handleNext = async () => {
    if (isLastItem) {
      const responses = gameData.responses || [];
      const items = gameData.selectedCategory.items || [];

      const newScores = {};
      const roundBreakdown = [];

      if (gameData.gameMode === "doYouKnowMe") {
        const targetName = gameData.targetPlayer;
        const targetResponse = responses.find(r => r.name === targetName);

        if (!targetResponse) {
          console.warn("Target player has no response yet.");
          return;
        }

        responses.forEach((resp) => {
          if (resp.name === targetName) return;

          let itemMatches = 0;
          let totalItems = Object.keys(targetResponse.placements || {}).length;

          for (const item of items) {
            const targetTier = targetResponse.placements?.[item];
            const guess = resp.placements?.[item];
            if (guess === targetTier) {
              itemMatches++;
            }
          }

          let score = itemMatches;
          if (itemMatches === totalItems) {
            score += 2; // full match bonus
          }

          newScores[resp.name] = score;
        });

        // Calculate target player score
        let targetScore = 0;
        for (const item of items) {
          const targetTier = targetResponse.placements?.[item];
          if (!targetTier) continue;

          const matching = responses.filter(r =>
            r.name !== targetName &&
            r.placements?.[item] === targetTier
          );

          if (matching.length > 0) {
            targetScore += 1;
            if (matching.length === responses.length - 1) {
              targetScore += 1;
              roundBreakdown.push(`Everyone matched ${item}! +1 bonus for ${targetName}`);
            }
          }
        }

        newScores[targetName] = (newScores[targetName] || 0) + targetScore;
      } else {
        items.forEach((item) => {
          const tierCounts = {};

          responses.forEach((resp) => {
            const tier = resp.placements?.[item];
            if (!tier) return;
            tierCounts[tier] = (tierCounts[tier] || 0) + 1;
          });

          const majorityTier = Object.entries(tierCounts).reduce((a, b) =>
            a[1] >= b[1] ? a : b
          )?.[0];

          responses.forEach((resp) => {
            const tier = resp.placements?.[item];
            if (!tier) return;

            const name = resp.name;
            if (!newScores[name]) newScores[name] = 0;

            const matchCount = responses.filter(
              (r) => r.name !== name && r.placements?.[item] === tier
            ).length;

            if (matchCount > 0) {
              newScores[name] += 1;
            }

            if (tier === majorityTier && matchCount > 0) {
              newScores[name] += 2;
            }
          });
        });
      }

      const updatedPlayers = (gameData.players || []).map((player) => {
        const addedScore = newScores[player.name] || 0;
        return {
          ...player,
          score: (player.score || 0) + addedScore
        };
      });

      const newRoundSummary = {
        categoryTitle: gameData.selectedCategory?.title || "Unknown Category",
        scoresThisRound: newScores,
        breakdown: roundBreakdown,
        responses
      };

      const previousRounds = gameData.rounds || [];

      await updateDoc(gameRef, {
        players: updatedPlayers,
        status: "scoreboard",
        responses: [],
        revealIndex: 0,
        rounds: [...previousRounds, newRoundSummary]
      });
    } else {
      await updateDoc(gameRef, {
        revealIndex: revealIndex + 1
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 bg-white p-6 shadow rounded">
      <h2 className="text-2xl font-bold text-center mb-4">📢 Reveal Time!</h2>
      <h3 className="text-center text-xl mb-2">
        Item: <strong>{currentItem}</strong>
      </h3>

      <table className="w-full text-left border mt-4 mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">Player</th>
            <th className="p-2 border">Their Ranking</th>
          </tr>
        </thead>
        <tbody>
          {playerRankings.map((entry, idx) => (
            <tr key={idx}>
              <td className="p-2 border">{entry.name}</td>
              <td className="p-2 border">
                {entry.tier === "FUEGO" && "🔥 FUEGO"}
                {entry.tier === "MID" && "😐 MID"}
                {entry.tier === "TRASH" && "🗑️ TRASH"}
                {entry.tier === "—" && "❓ No Vote"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {player?.isHost ? (
        <div className="text-center">
          <button
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            onClick={handleNext}
          >
            {isLastItem ? "🏁 Finish Round" : "👉 Continue"}
          </button>
        </div>
      ) : (
        <p className="text-center text-gray-500">Waiting for host…</p>
      )}
    </div>
  );
}

export default RevealView;
