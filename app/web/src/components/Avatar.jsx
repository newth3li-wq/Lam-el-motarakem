import { useEffect, useState } from 'react';
import { API_BASE, api } from '../api';
import { useAuth } from '../auth';

const cache = new Map();

export default function Avatar({ size = 'md', className = '', alt = '' }) {
  const { user, token } = useAuth();
  const [src, setSrc] = useState(() => cache.get(user?.id) || null);
  const has = !!user?.profile?.hasAvatar;
  const initial = (user?.profile?.displayName || user?.email || '؟').trim().charAt(0);

  useEffect(() => {
    let live = true;
    if (!has || !token) {
      setSrc(null);
      return undefined;
    }
    const cached = cache.get(user.id);
    if (cached) {
      setSrc(cached);
      return undefined;
    }
    fetch(`${API_BASE}/api/profile/avatar`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error('no avatar'))))
      .then((blob) => {
        if (!live) return;
        const url = URL.createObjectURL(blob);
        const old = cache.get(user.id);
        if (old) URL.revokeObjectURL(old);
        cache.set(user.id, url);
        setSrc(url);
      })
      .catch(() => { /* fall back to the initial */ });
    return () => { live = false; };
  }, [has, token, user?.id]);

  return (
    <span className={`avatar ${size === 'lg' ? 'avatar-lg' : ''} ${className}`.trim()} aria-hidden={!alt}>
      {src ? <img src={src} alt={alt} /> : <span>{initial || '؟'}</span>}
    </span>
  );
}

export function clearAvatarCache() {
  for (const url of cache.values()) URL.revokeObjectURL(url);
  cache.clear();
}
