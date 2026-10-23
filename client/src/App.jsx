import React, { useEffect, useRef, useState, useCallback } from 'react';
import { socket, join, onToast } from './net.js';
import Home from './components/Home.jsx';
import Lobby from './components/Lobby.jsx';
import Game from './components/Game.jsx';
import Demo from './components/Demo.jsx';
import { notifyHost, notifyReady } from './embed.js';

const roomFromUrl = () => {
  const m = window.location.pathname.match(/\/room\/([A-Za-z0-9]+)/);
  return m ? m[1].toUpperCase() : null;
};

export default function App() {
  const [state, setState] = useState(null);
  const [session, setSession] = useState(null); // { roomId, playerId }
  const [connected, setConnected] = useState(socket.connected);
  const [toasts, setToasts] = useState([]);
  const sessionRef = useRef(null);
  sessionRef.current = session;

  const pushToast = useCallback((text, kind = 'error') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  // en mode intégré, la page hôte suit la partie en cours pour garder une adresse partageable
  useEffect(() => {
    if (window.location.pathname.startsWith('/demo')) notifyHost({ demo: true });
    else notifyHost(session ? { room: session.roomId } : {});
  }, [session?.roomId]);

  useEffect(() => {
    notifyReady();
    onToast(pushToast);
    const onState = (s) => setState(s);
    const onConnect = async () => {
      setConnected(true);
      const s = sessionRef.current;
      const roomId = s?.roomId || roomFromUrl();
      const name = localStorage.getItem('mq_name');
      if (roomId && (s || name)) await enter(roomId, name, true);
    };
    const onDisconnect = () => setConnected(false);
    socket.on('state', onState);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) onConnect();
    window.addEventListener('popstate', () => { if (!roomFromUrl()) leave(); });
    return () => {
      socket.off('state', onState);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  async function enter(roomId, name, silent = false) {
    const res = await join(roomId, name);
    if (res.error) {
      if (silent && roomId) window.history.replaceState(null, '', '/');
      return false;
    }
    setSession({ roomId: res.roomId, playerId: res.playerId });
    setState(res.state);
    if (roomFromUrl() !== res.roomId) window.history.pushState(null, '', `/room/${res.roomId}`);
    return true;
  }

  function leave() {
    setSession(null);
    setState(null);
    window.history.pushState(null, '', '/');
  }

  let screen;
  if (window.location.pathname.startsWith('/demo')) {
    screen = <Demo />;
  } else if (!session || !state) {
    screen = <Home initialRoom={roomFromUrl()} onEnter={enter} />;
  } else if (state.phase === 'lobby') {
    screen = <Lobby state={state} me={session.playerId} onLeave={leave} />;
  } else {
    screen = <Game state={state} me={session.playerId} onLeave={leave} />;
  }

  return (
    <>
      {screen}
      {!connected && <div className="conn-banner">Connexion au serveur…</div>}
      <div className="toasts">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
      </div>
    </>
  );
}
