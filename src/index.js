import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';   // if you have Tailwind/global styles
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
