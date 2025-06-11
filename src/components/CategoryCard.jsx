import React from "react";

function CategoryCard({ title, items }) {
  return (
    <div className="bg-white shadow rounded-lg p-4 mb-6">
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <ul className="list-disc pl-5">
        {items.map((item, index) => (
          <li key={index} className="text-gray-800">{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default CategoryCard;
