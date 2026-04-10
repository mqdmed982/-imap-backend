import React, { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';

export default function App() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem('inboxious_auth') === '1'
  );

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />;
  }

  return <Dashboard onLogout={() => {
    sessionStorage.removeItem('inboxious_auth');
    setAuthed(false);
  }} />;
}
