import React, { useEffect, useRef } from 'react';
import { useDemoRunner } from '../../../hooks/useDemoRunner';
import SignalStepCard from './SignalStepCard';
import ThinkingIndicator from './ThinkingIndicator';
import { RefreshCw, PlayCircle } from 'lucide-react';

export default function SignalChainDemo({ scenario }) {
  const stepsData = [
    { type: 'signal', content: scenario.signal },
    { type: 'business_context', content: scenario.business_context },
    { type: 'offering_fit', content: scenario.offering_fit },
    { type: 'opportunity', content: scenario.opportunity },
    { type: 'action_pitch', content: scenario.action_pitch }
  ];

  const { visibleSteps, isThinking, isPlaying, startDemo, isComplete } = useDemoRunner(stepsData, true);
  const containerRef = useRef(null);

  // Auto-scroll to bottom when new steps appear
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [visibleSteps, isThinking]);

  // Restart demo when scenario changes
  useEffect(() => {
    startDemo();
  }, [scenario, startDemo]);

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex flex-col h-[600px] shadow-2xl">
      {/* Header */}
      <div className="bg-gray-800/80 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
        <div>
          <h3 className="text-white font-medium flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            NeXus Live Radar
          </h3>
          <p className="text-xs text-gray-400 mt-1">Lead: {scenario.company}</p>
        </div>
        <button 
          onClick={startDemo}
          className="text-gray-400 hover:text-white transition-colors p-2 bg-gray-700/50 rounded-lg flex items-center gap-2 text-sm"
          title="Demo neu starten"
        >
          {isPlaying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
          <span className="hidden sm:inline">{isPlaying ? 'Läuft...' : 'Neu starten'}</span>
        </button>
      </div>

      {/* Content Area */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-6 scroll-smooth">
        {visibleSteps.map((step, idx) => (
          <SignalStepCard key={`${scenario.id}-${step.type}-${idx}`} step={step} />
        ))}
        
        {isThinking && <ThinkingIndicator />}
        
        {isComplete && (
          <div className="mt-6 p-4 bg-green-900/20 border border-green-800/50 rounded-lg flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-green-400">Pipeline abgeschlossen</h4>
              <p className="text-xs text-gray-400 mt-1">Dieser Lead ist bereit für die Kaltakquise und kann mit einem Klick in den Sales Workspace übernommen werden.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
