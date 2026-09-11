import React, { useState, useEffect } from 'react';
import { Radar, Briefcase, Target, Lightbulb, MessageSquare } from 'lucide-react';

const icons = {
  signal: <Radar className="w-5 h-5 text-blue-400" />,
  business_context: <Briefcase className="w-5 h-5 text-purple-400" />,
  offering_fit: <Target className="w-5 h-5 text-green-400" />,
  opportunity: <Lightbulb className="w-5 h-5 text-yellow-400" />,
  action_pitch: <MessageSquare className="w-5 h-5 text-rose-400" />
};

const labels = {
  signal: '1. Signal erkannt',
  business_context: '2. Business Context',
  offering_fit: '3. Offering Fit',
  opportunity: '4. Opportunity',
  action_pitch: '5. Action / Pitch'
};

export default function SignalStepCard({ step }) {
  const [displayedText, setDisplayedText] = useState('');
  const isTyping = step.type === 'action_pitch';

  useEffect(() => {
    if (isTyping) {
      setDisplayedText('');
      let i = 0;
      const interval = setInterval(() => {
        setDisplayedText(step.content.slice(0, i));
        i += 2;
        if (i > step.content.length) {
          clearInterval(interval);
          setDisplayedText(step.content);
        }
      }, 15);
      return () => clearInterval(interval);
    } else {
      setDisplayedText(step.content);
    }
  }, [step.content, isTyping]);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-5 mb-4 shadow-lg transform transition-all duration-300 ease-out translate-y-0 opacity-100 flex gap-4">
      <div className="flex-shrink-0 mt-1">
        <div className="w-10 h-10 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center">
          {icons[step.type]}
        </div>
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
          {labels[step.type]}
        </h4>
        <div className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
          {displayedText}
          {isTyping && displayedText.length < step.content.length && (
            <span className="inline-block w-2 h-4 ml-1 bg-rose-400 animate-pulse"></span>
          )}
        </div>
      </div>
    </div>
  );
}
