import React from 'react';

export default function ThinkingIndicator({ nextStepType }) {
  // A subtle pulsing indicator that looks like AI is thinking
  return (
    <div className="flex items-center gap-3 py-2 px-4 mb-4">
      <div className="flex gap-1.5">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 rounded-full bg-rose-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <span className="text-sm text-gray-500 font-medium animate-pulse">NeXus AI analysiert...</span>
    </div>
  );
}
