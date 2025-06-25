// src/components/JoinGame.jsx
import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';

function JoinGame({ onJoin }) {
    const [name, setName] = useState('');
    const [gameCode, setGameCode] = useState('');
    const [error, setError] = useState('');
    const [isJoining, setIsJoining] = useState(false); // State to prevent double clicks

    const handleJoinGame = async (e) => {
        e.preventDefault();
        setError('');
        setIsJoining(true); // Disable button and inputs immediately

        const enteredName = name.trim(); // Trim whitespace from input
        const normalizedEnteredName = enteredName.toLowerCase(); // Normalize for comparison and storage

        if (!enteredName || !gameCode) {
            setError('Please enter your name and the game code.');
            setIsJoining(false); // Re-enable button
            return;
        }

        const gameRef = doc(db, 'games', gameCode.toUpperCase());

        try {
            const gameSnap = await getDoc(gameRef);

            if (!gameSnap.exists()) {
                setError('Game not found. Please check the code.');
                setIsJoining(false); // Re-enable button
                return;
            }

            const gameData = gameSnap.data();

            // Check if player already exists in the game (case-insensitive comparison)
            const playerExists = gameData.players.some(p => p.name.toLowerCase() === normalizedEnteredName);

            if (playerExists) {
                setError('You have already joined this game. Please wait for the host to start.');
                setIsJoining(false); // Re-enable button
                // If player already exists, still transition to game view by calling onJoin.
                // Pass the normalized name to ensure consistency with Firebase data.
                onJoin({ name: normalizedEnteredName, gameCode: gameCode.toUpperCase(), isHost: false });
                return;
            }

            // Add new player to the game
            const newPlayer = {
                name: normalizedEnteredName, // Store the normalized name in Firestore for strict uniqueness 
                isHost: false, // Players joining are never hosts
                joinedAt: new Date().toISOString(),
                score: 0 // Initialize score for new player
            };

            await updateDoc(gameRef, {
                players: arrayUnion(newPlayer)
            });

            // Pass the normalized name to App.js's state for consistency
            onJoin({ name: normalizedEnteredName, gameCode: gameCode.toUpperCase(), isHost: false });

        } catch (err) {
            console.error('Error joining game:', err);
            setError('Failed to join game. Please try again.');
        } finally {
            setIsJoining(false); // Re-enable button in finally block
        }
    };

    return (
        <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow-lg rounded-lg text-gray-800">
            <h2 className="text-3xl font-bold text-center mb-6 text-indigo-700">Join Game</h2>
            <form onSubmit={handleJoinGame} className="space-y-4">
                <div>
                    <label htmlFor="name" className="block text-lg font-medium text-gray-700 mb-1">Your Name:</label>
                    <input
                        type="text"
                        id="name"
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your name"
                        disabled={isJoining} // Disable input while joining
                    />
                </div>
                <div>
                    <label htmlFor="gameCode" className="block text-lg font-medium text-gray-700 mb-1">Game Code:</label>
                    <input
                        type="text"
                        id="gameCode"
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-lg uppercase"
                        value={gameCode}
                        onChange={(e) => setGameCode(e.target.value)}
                        placeholder="e.g., ABC123"
                        maxLength="6"
                        disabled={isJoining} // Disable input while joining
                    />
                </div>
                {error && <p className="text-red-600 text-center text-md">{error}</p>}
                <button
                    type="submit"
                    className={`w-full px-6 py-3 text-lg font-semibold rounded-md transition duration-300 ${
                        isJoining ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                    disabled={isJoining}
                >
                    {isJoining ? 'Joining...' : '🚀 Join Game'}
                </button>
            </form>
        </div>
    );
}

export default JoinGame;