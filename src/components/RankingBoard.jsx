import React, { useState, useEffect } from "react";

const TIERS = ["FUEGO", "MID", "TRASH"];
const tierIcons = {
  FUEGO: "🔥",
  MID: "😐",
  TRASH: "🗑️"
};

function RankingBoard({ items, onRankingChange, lockedIn }) {
  const [placements, setPlacements] = useState({});

  const handleChitClick = (item, tier) => {
    if (lockedIn) return;

    const newPlacements = { ...placements, [item]: tier };
    setPlacements(newPlacements);

    // Call back to PlayerView
    if (onRankingChange) {
      onRankingChange(newPlacements);
    }
  };

  useEffect(() => {
    onRankingChange?.(placements); // Send initial blank state just in case
  }, []);

  return (
    <div className="overflow-x-auto">
      <div className="grid" style={{ gridTemplateColumns: `100px repeat(${items.length}, 1fr)` }}>
        <div className="font-bold text-center p-2">Tier ↓ / Item →</div>
        {items.map((item, idx) => (
          <div key={idx} className="font-bold text-center p-2 bg-gray-100 border">{item}</div>
        ))}

        {TIERS.map((tier) => (
          <React.Fragment key={tier}>
            <div className="font-semibold text-center p-2">{tierIcons[tier]} {tier}</div>
            {items.map((item, idx) => {
              const isSelected = placements[item] === tier;
              return (
                <div
                  key={idx}
                  onClick={() => handleChitClick(item, tier)}
                  className={`cursor-pointer border h-16 flex items-center justify-center transition
                    ${isSelected ? "bg-blue-200 font-bold" : "hover:bg-gray-100"}
                    ${lockedIn ? "opacity-60 cursor-default" : ""}
                  `}
                >
                  {isSelected ? tierIcons[tier] : ""}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export default RankingBoard;
