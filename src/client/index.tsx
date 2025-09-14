import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Ensure the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('react-root');
  if (container) {
    const root = createRoot(container);
    root.render(<App />);
  } else {
    console.error('Could not find react-root element');
  }
});