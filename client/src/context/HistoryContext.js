import { createContext, useContext } from 'react';

// Menyediakan takeSnapshot() untuk komponen di dalam kanvas (mis. EndpointNode)
// supaya perubahan dari dalam node tetap bisa di-undo.
export const HistoryContext = createContext(() => {});

export const useTakeSnapshot = () => useContext(HistoryContext);
