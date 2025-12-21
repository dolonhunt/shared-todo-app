import React from 'react';
import ReactDOM from 'react-dom/client';
import SharedProductivityApp from './SharedProductivityApp';
import './index.css';
import './storage';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SharedProductivityApp />
  </React.StrictMode>
);
