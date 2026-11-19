import { createContext, useContext, useEffect, useState } from 'react';
import { api, tokenStore } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null, token: null });

  useEffect(() => {
    const token = tokenStore.get();
    if (!token) { setState({ status: 'anon', user: null, token: null }); return undefined; }
    let live = true;
    api('/api/me', { token })
      .then(d => live && setState({ status: 'authed', user: d.user, token }))
      .catch(e => {
        if (!live) return;
        if (e.status === 401) tokenStore.clear();       // only a rejected token is dropped, not a network failure
        setState({ status: 'anon', user: null, token: null });
      });
    return () => { live = false; };
  }, []);

  const enter = d => { tokenStore.set(d.token); setState({ status: 'authed', user: d.user, token: d.token }); };
  const value = {
    ...state,
    login: async (email, password) => enter(await api('/api/auth/login', { method: 'POST', body: { email, password } })),
    register: async (email, password, displayName) => enter(await api('/api/auth/register', { method: 'POST', body: { email, password, displayName } })),
    logout: async () => {
      const t = state.token; tokenStore.clear(); setState({ status: 'anon', user: null, token: null });
      try { await api('/api/auth/logout', { method: 'POST', token: t }); } catch { /* already signed out locally */ }
    },
    setProfile: profile => setState(s => ({ ...s, user: { ...s.user, profile } }))
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
