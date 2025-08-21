import React from 'react';
import TelegramDashboard from './TelegramMessagesDashboard';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-indigo-600 text-white p-4 shadow">
        <h1 className="text-xl font-bold">Telegram Dashboard</h1>
      </header>

      <main className="p-4">
        <TelegramDashboard />
      </main>
    </div>
  );
}

export default App;
