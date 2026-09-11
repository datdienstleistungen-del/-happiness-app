import React from 'react';

export default function IndustrySelector({ scenarios, activeScenarioId, onSelect }) {
  return (
    <div className="flex flex-wrap gap-3 mb-8">
      {Object.values(scenarios).map((scenario) => {
        const isActive = scenario.id === activeScenarioId;
        return (
          <button
            key={scenario.id}
            onClick={() => onSelect(scenario.id)}
            className={`
              px-5 py-3 rounded-xl border text-sm font-medium transition-all duration-200
              ${isActive 
                ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' 
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750 hover:text-gray-200 hover:border-gray-500'}
            `}
          >
            <div className="text-xs uppercase tracking-wider mb-1 opacity-80">{scenario.industryLabel}</div>
            <div className={isActive ? 'text-white' : 'text-gray-300'}>{scenario.offeringExample}</div>
          </button>
        );
      })}
    </div>
  );
}
