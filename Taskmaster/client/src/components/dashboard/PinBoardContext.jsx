import React, { createContext, useContext, useState, useCallback } from 'react';

const emptyDraft = () => ({ editingId: null, title: '', content: '' });

const PinBoardContext = createContext(null);

export const PinBoardProvider = ({ children }) => {
  const [draft, setDraft] = useState(emptyDraft);

  const loadPin = useCallback((pin) => {
    setDraft({
      editingId: pin._id,
      title: pin.title || '',
      content: pin.content || '',
    });
  }, []);

  const resetDraft = useCallback(() => setDraft(emptyDraft()), []);

  return (
    <PinBoardContext.Provider value={{ draft, setDraft, loadPin, resetDraft }}>
      {children}
    </PinBoardContext.Provider>
  );
};

export const usePinBoardDraft = () => {
  const ctx = useContext(PinBoardContext);
  if (!ctx) throw new Error('usePinBoardDraft must be used within PinBoardProvider');
  return ctx;
};
