import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { GUIDE_CONTENT } from '../lib/guide-content';
import { HelpCircle, X, Sparkles, MessageCircle, ArrowRight, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { callNexusAI } from '../lib/nexus-ai';
import './GuideContext.css';

const GuideContext = createContext(null);

export function GuideProvider({ children }) {
  const [activeContextHelp, setActiveContextHelp] = useState(null);
  
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantContextKey, setAssistantContextKey] = useState(null);
  
  // Chat State
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hallo! Ich bin dein NeXus Assistent. Wie kann ich dir helfen?' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (assistantOpen) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, assistantOpen]);

  const openContextHelp = (helpKey) => {
    setActiveContextHelp(helpKey);
  };

  const closeContextHelp = () => {
    setActiveContextHelp(null);
  };

  const openAssistant = (contextKey = null) => {
    setAssistantContextKey(contextKey);
    setAssistantOpen(true);
    
    // Add context hint message if opened from a specific help context
    if (contextKey && GUIDE_CONTENT[contextKey]) {
      const title = GUIDE_CONTENT[contextKey].title;
      // Only add hint if the last message isn't already this hint
      const lastMsg = messages[messages.length - 1];
      if (!lastMsg.isContextHint || lastMsg.contextKey !== contextKey) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Du fragst speziell zu **${title}**. Was genau möchtest du darüber wissen?`,
          isContextHint: true,
          contextKey: contextKey
        }]);
      }
    }
  };

  const closeAssistant = () => {
    setAssistantOpen(false);
  };
  
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const text = inputValue.trim();
    if (!text || isTyping) return;
    
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsTyping(true);
    
    try {
      // Baue den aktuellen Kontext für die KI zusammen
      let enhancedContext = null;
      if (assistantContextKey && GUIDE_CONTENT[assistantContextKey]) {
        const info = GUIDE_CONTENT[assistantContextKey];
        enhancedContext = `Der Nutzer fragt im Kontext des UI-Elements: "${info.title}".\nKurzbeschreibung: ${info.whatIsIt}\nHandlungsempfehlung: ${info.whatToDo}\nWarum es wichtig ist: ${info.whyItMatters}`;
      }
      
      const response = await callNexusAI({
        mode: 'assistant',
        message: text,
        context: enhancedContext,
        temperature: 0.5
      });
      
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      console.error('Assistant Error:', err);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Entschuldigung, ich konnte meine Wissensdatenbank gerade nicht erreichen. Bitte versuche es noch einmal.' 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const activeContent = activeContextHelp ? GUIDE_CONTENT[activeContextHelp] : null;

  return (
    <GuideContext.Provider value={{
      openContextHelp,
      closeContextHelp,
      openAssistant,
      closeAssistant,
      assistantOpen,
      assistantContextKey
    }}>
      {children}
      
      {/* Globales Context-Help Modal */}
      {activeContent && (
        <div className="nexus-guide-overlay" onClick={closeContextHelp}>
          <div className="nexus-guide-modal" onClick={e => e.stopPropagation()}>
            <div className="guide-modal-header">
              <h3><HelpCircle size={18} /> {activeContent.title}</h3>
              <button className="close-btn" onClick={closeContextHelp}><X size={18} /></button>
            </div>
            
            <div className="guide-modal-body">
              <div className="guide-section">
                <h4>Was ist das?</h4>
                <p>{activeContent.whatIsIt}</p>
              </div>
              
              <div className="guide-section">
                <h4>Was soll ich tun?</h4>
                <p>{activeContent.whatToDo}</p>
              </div>

              {activeContent.whyItMatters && (
                <div className="guide-section highlight">
                  <h4>Warum ist das wichtig?</h4>
                  <p>{activeContent.whyItMatters}</p>
                </div>
              )}
            </div>
            
            <div className="guide-modal-footer">
              <button className="ask-assistant-btn" onClick={() => {
                closeContextHelp();
                openAssistant(activeContextHelp);
              }}>
                <MessageCircle size={16} /> NeXus Assistent fragen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Globaler permanenter Assistant Button (unten rechts) */}
      <button 
        className="nexus-floating-assistant-btn"
        onClick={() => openAssistant()}
      >
        <Sparkles size={20} />
        <span>NeXus fragen</span>
      </button>

      {/* Globaler Assistant Slide-Out */}
      {assistantOpen && (
        <div className="nexus-assistant-slideout">
          <div className="slideout-header">
            <h3><Sparkles size={18} /> NeXus Assistent</h3>
            <button className="close-btn" onClick={closeAssistant}><X size={18} /></button>
          </div>
          
          <div className="slideout-body chat-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.role}`}>
                <div className="msg-content">
                  <ReactMarkdown
                    components={{
                      a: ({node, href, children, ...props}) => {
                        if (href && href.startsWith('/')) {
                          return (
                            <a 
                              href={href} 
                              onClick={(e) => {
                                e.preventDefault();
                                window.location.href = href;
                              }}
                              {...props}
                            >
                              {children}
                            </a>
                          );
                        }
                        return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
                      }
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="chat-message assistant typing">
                <div className="msg-content">
                  <Loader2 size={16} className="spinner" /> <em>NeXus denkt nach...</em>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <form className="slideout-footer" onSubmit={handleSendMessage}>
             <input 
               type="text" 
               placeholder="Frag mich alles über NeXus..." 
               value={inputValue}
               onChange={e => setInputValue(e.target.value)}
               disabled={isTyping}
             />
             <button type="submit" disabled={!inputValue.trim() || isTyping}>
               <ArrowRight size={16} />
             </button>
          </form>
        </div>
      )}
    </GuideContext.Provider>
  );
}

export function useGuide() {
  const context = useContext(GuideContext);
  if (!context) {
    throw new Error('useGuide must be used within a GuideProvider');
  }
  return context;
}

export function ContextHelpButton({ helpKey }) {
  const { openContextHelp } = useGuide();
  
  return (
    <button 
      className="nexus-context-help-btn"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openContextHelp(helpKey);
      }}
      title="Hilfe anzeigen"
    >
      <HelpCircle size={14} />
    </button>
  );
}
