import { useState, useEffect, useCallback } from 'react';

export function useDemoRunner(stepsData, autoPlay = true) {
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [isThinking, setIsThinking] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const startDemo = useCallback(() => {
    setCurrentStepIndex(-1);
    setIsThinking(true);
    setIsPlaying(true);
  }, []);

  const resetDemo = useCallback(() => {
    setCurrentStepIndex(-1);
    setIsThinking(false);
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    if (autoPlay && stepsData && stepsData.length > 0) {
      startDemo();
    }
  }, [autoPlay, stepsData, startDemo]);

  useEffect(() => {
    if (!isPlaying || !stepsData) return;

    let timeout;

    if (currentStepIndex === -1 && isThinking) {
      // Initial thinking before showing the first signal
      timeout = setTimeout(() => {
        setIsThinking(false);
        setCurrentStepIndex(0);
      }, 1200);
    } else if (currentStepIndex >= 0 && currentStepIndex < stepsData.length - 1) {
      // We just showed a step, wait a bit, then show thinking for the next step
      if (!isThinking) {
        timeout = setTimeout(() => {
          setIsThinking(true);
        }, 1500); // Read time for the current card
      } else {
        // Thinking is active, resolve it to show the next card
        timeout = setTimeout(() => {
          setIsThinking(false);
          setCurrentStepIndex(prev => prev + 1);
        }, 1000); // Thinking duration between cards
      }
    } else if (currentStepIndex === stepsData.length - 1) {
      setIsPlaying(false);
      setIsThinking(false);
    }

    return () => clearTimeout(timeout);
  }, [currentStepIndex, isThinking, isPlaying, stepsData]);

  const visibleSteps = stepsData ? stepsData.slice(0, currentStepIndex + 1) : [];

  return {
    visibleSteps,
    isThinking,
    isPlaying,
    startDemo,
    resetDemo,
    isComplete: currentStepIndex === (stepsData ? stepsData.length - 1 : 0) && !isThinking
  };
}
