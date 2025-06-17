// src/components/RevealView.jsx
import React, { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { GAME_MODES } from "../App"; // Import GAME_MODES

// Updated props: gameCode and gameData from App.js
function RevealView({ gameCode, player, gameData }) {
  const revealIndex = gameData?.revealIndex || 0;

  const gameRef = doc(db, "games", gameCode);

  // No need for separate onSnapshot here, gameData is already coming from App.js
  // useEffect(() => { ... }, [gameCode]);

  const category = gameData?.selectedCategory;
  const items = category?.items || [];
  const responses = gameData?.responses || [];

  if (
    !category ||
    !Array.isArray(items) ||
    items.length === 0 ||
    !Array.isArray(responses)
  ) {
    console.warn("🕵️ RevealView: invalid or incomplete game data", gameData);
    return <p className="text-center mt-10 text-gray-700">Loading reveal data…</p>;
  }

  const currentItem = items[revealIndex];
  const isLastItem = revealIndex >= items.length - 1;

  // Aggregate player rankings for the current item
  const aggregatedPlayerRankings = responses.map((response) => ({
    name: response?.name || "Unknown",
    tier: response?.placements?.[currentItem] || "—",
  })).sort((a, b) => a.name.localeCompare(b.name));


  const handleNext = async () => {
    if (isLastItem) {
      // Logic for calculating final scores for the round
      const newScores = {}; // Holds points gained this round
      const roundBreakdown = []; // For detailed summary
      const existingPlayers = gameData.players || []; // Players from current gameData
      const gameMode = gameData.gameMode || GAME_MODES.BASIC; // Current game mode
      const targetPlayerName = gameData.targetPlayer;
      const kingPlayerName = gameData.kingPlayerName;
      const poisonItem = gameData.poisonItem;


      // Initialize newScores for all players (based on their current score from Firebase)
      existingPlayers.forEach(p => {
        newScores[p.name] = p.score || 0;
      });


      if (gameMode === GAME_MODES.DO_YOU_KNOW_ME) {
        const targetResponse = responses.find(r => r.name === targetPlayerName);

        if (!targetResponse) {
          console.warn("Target player has no response yet for Do You Know Me mode.");
          // Still need to update game state even if target is missing responses
        } else {
            // Players guessing the target's rankings
            responses.forEach((resp) => {
              if (resp.name === targetPlayerName) return; // Don't score the target player for guessing themselves

              let itemMatches = 0;
              for (const item of items) {
                const targetTier = targetResponse.placements?.[item];
                const guess = resp.placements?.[item];
                if (guess === targetTier && targetTier !== undefined) { // Ensure targetTier is defined
                  itemMatches++;
                }
              }
              // Score for guessing
              newScores[resp.name] += itemMatches; // 1 point per correct guess
              if (itemMatches === items.length && items.length > 0) {
                  newScores[resp.name] += 2; // Full match bonus
                  roundBreakdown.push(`${resp.name} got a full match on ${category.title}!`);
              }
            });

            // Target player's score (based on others matching them)
            let targetBonusScore = 0;
            for (const item of items) {
              const targetTier = targetResponse.placements?.[item];
              if (!targetTier) continue;

              const matchingGuessers = responses.filter(r =>
                r.name !== targetPlayerName &&
                r.placements?.[item] === targetTier
              ).length;

              if (matchingGuessers > 0) {
                targetBonusScore += 1; // 1 point for each item matched by at least one guesser
              }
            }
            newScores[targetPlayerName] += targetBonusScore;
        }

      } else if (gameMode === GAME_MODES.HOT_TAKE) { // NEW HOT TAKE SCORING
        items.forEach((item) => {
            const tierCounts = { 'FUEGO': 0, 'MID': 0, 'TRASH': 0 };
            const playersInTier = { 'FUEGO': [], 'MID': [], 'TRASH': [] };

            responses.forEach(resp => {
                const tier = resp.placements?.[item];
                if (tier) {
                    tierCounts[tier]++;
                    playersInTier[tier].push(resp.name);
                }
            });

            // Award points to players who had a unique (hot) take
            Object.entries(playersInTier).forEach(([tier, playerNames]) => {
                if (playerNames.length === 1) { // If only one player chose this tier for this item
                    newScores[playerNames[0]] += 10; // Award points for a unique hot take
                    roundBreakdown.push(`${playerNames[0]} had a hot take on "${item}" (${tier})! +10 pts`);
                }
            });
        });
      } else if (gameMode === GAME_MODES.POISON_ROUND) { // NEW POISON ROUND SCORING
        items.forEach((item) => {
            responses.forEach(resp => {
                const playerRank = resp.placements?.[item];
                if (item === poisonItem && playerRank === 'FUEGO') {
                    newScores[resp.name] -= 15; // Deduct points for Fuego on poison
                    roundBreakdown.push(`${resp.name} ranked "${item}" FUEGO! -15 pts (Poison)`);
                }
                // For other ranks or non-poison items, we'll give standard matching points
                // Similar to "We're Basic" but can be adjusted.
                // Here, let's combine it with a count.
                const tierCounts = { 'FUEGO': 0, 'MID': 0, 'TRASH': 0 };
                responses.forEach(r => {
                    const tier = r.placements?.[item];
                    if (tier) tierCounts[tier]++;
                });

                if (playerRank && playerRank !== 'FUEGO' || item !== poisonItem) { // Only award points if not Fuego on Poison
                    const matchCount = tierCounts[playerRank] - 1; // Number of other players they matched
                    if (matchCount > 0) {
                        newScores[resp.name] += matchCount; // Award 1 point per match
                    }
                }
            });
        });
      } else { // DEFAULT "BASIC" SCORING
        items.forEach((item) => {
          const tierCounts = {};
          responses.forEach((resp) => {
            const tier = resp.placements?.[item];
            if (!tier) return;
            tierCounts[tier] = (tierCounts[tier] || 0) + 1;
          });

          // Find the majority tier to award bonus
          const majorityTier = Object.entries(tierCounts).reduce((a, b) =>
            a[1] >= b[1] ? a : b
          )?.[0];

          responses.forEach((resp) => {
            const tier = resp.placements?.[item];
            if (!tier) return;

            // Basic match count (1 point per match)
            const matchCount = responses.filter(
              (r) => r.name !== resp.name && r.placements?.[item] === tier
            ).length;

            newScores[resp.name] += matchCount; // Add to existing score

            // Bonus for matching majority
            if (tier === majorityTier && matchCount > 0) {
              newScores[resp.name] += 2; // Add 2 points for majority match
            }
          });
        });
      }

      // Final update of players array in Firestore with new total scores
      const updatedPlayers = existingPlayers.map((p) => {
        return {
          ...p,
          score: newScores[p.name] // This now holds the new total score
        };
      });

      const newRoundSummary = {
        categoryTitle: category?.title || "Unknown Category",
        scoresThisRound: responses.reduce((acc, resp) => { // Store scores gained this round for summary
          acc[resp.name] = newScores[resp.name] - (existingPlayers.find(p => p.name === resp.name)?.score || 0);
          return acc;
        }, {}),
        breakdown: roundBreakdown,
        responses // Store raw responses for historical view
      };

      const previousRounds = gameData.rounds || [];

      await updateDoc(gameRef, {
        players: updatedPlayers,
        status: "scoreboard",
        responses: [], // Clear responses for next round
        revealIndex: 0, // Reset reveal index
        rounds: [...previousRounds, newRoundSummary], // Add this round to history
        gameMode: GAME_MODES.BASIC, // Reset game mode for next round
        targetPlayer: null, // Reset target player
        kingPlayerName: null, // Reset king player
        poisonItem: null // Reset poison item
      });
    } else {
      await updateDoc(gameRef, {
        revealIndex: revealIndex + 1 // Move to next item
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-white shadow rounded text-gray-800">
      <h2 className="text-2xl font-bold text-center mb-4">📢 Reveal Time!</h2>
      <h3 className="text-center text-xl mb-2">
        Item: <strong>{currentItem}</strong>
      </h3>
      <p className="text-center text-lg font-semibold mb-4">
          Mode: <span className="underline">{gameData?.gameMode?.replace(/([A-Z])/g, ' $1').trim()}</span>
      </p>

      {gameData?.gameMode === GAME_MODES.POISON_ROUND && revealIndex === 0 && gameData?.poisonItem && (
        <p className="text-red-500 font-semibold text-center mb-4 animate-pulse">
          ⚡️ The secret POISON item for this round was: <span className="underline font-extrabold">{gameData.poisonItem}</span>! ⚡️
        </p>
      )}

      <table className="w-full text-left border mt-4 mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">Player</th>
            <th className="p-2 border">Their Ranking</th>
          </tr>
        </thead>
        <tbody>
          {aggregatedPlayerRankings.map((entry, idx) => (
            <tr key={idx} className={`${gameData?.gameMode === GAME_MODES.POISON_ROUND && entry.tier === 'FUEGO' && currentItem === gameData?.poisonItem ? 'bg-red-100' : ''}`}>
              <td className="p-2 border">{entry.name}</td>
              <td className="p-2 border font-bold">
                {entry.tier === "FUEGO" && "🔥 FUEGO"}
                {entry.tier === "MID" && "😐 MID"}
                {entry.tier === "TRASH" && "🗑️ TRASH"}
                {entry.tier === "—" && "❓ No Vote"}
                {gameData?.gameMode === GAME_MODES.HOT_TAKE && // Hot Take highlight
                  (() => {
                    const currentItemResponses = responses.filter(r => r.placements?.[currentItem]);
                    const countInTier = currentItemResponses.filter(r => r.placements?.[currentItem] === entry.tier).length;
                    if (countInTier === 1 && currentItemResponses.length > 0) {
                      return <span className="ml-2 text-purple-600 font-bold">(HOT TAKE!)</span>;
                    }
                    return null;
                  })()}
                {gameData?.gameMode === GAME_MODES.POISON_ROUND && entry.tier === 'FUEGO' && currentItem === gameData?.poisonItem && // Poison Fuego highlight
                  <span className="ml-2 text-red-600 font-bold">(POISONED!)</span>}
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