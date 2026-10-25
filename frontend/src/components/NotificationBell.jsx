import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');
  const lastId = useRef(null);
  const box = useRef(null);

  const load = async () => {
    try {
      const rows = await api('/notifications');
      const newest = rows[0]?.id ?? 0;
      if (lastId.current !== null && newest > lastId.current) {
        const fresh = rows.find((r) => r.id > lastId.current);
        if (fresh) { setToast(fresh.message); setTimeout(() => setToast(''), 5000); }
      }
      lastId.current = newest;
      setItems(rows);
    } catch { /* ignore polling errors */ }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const unread = items.filter((n) => !n.read).length;
  const markAll = async () => { await api('/notifications/read-all', { method: 'POST' }); load(); };
  const markOne = async (n) => { if (!n.read) { await api(`/notifications/${n.id}/read`, { method: 'PATCH' }); load(); } };

  return (
    <div className="bell" ref={box}>
      <button className="icon-btn" onClick={() => setOpen(!open)} aria-label="Notifications" title="Notifications">
        🔔{unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-menu">
          <div className="bell-head">
            <b>Notifications</b>
            {unread > 0 && <button onClick={markAll}>Mark all read</button>}
          </div>
          {items.length === 0 && <p className="bell-empty">No notifications yet.</p>}
          {items.map((n) => (
            <div key={n.id} className={`bell-item ${n.read ? '' : 'unread'}`} onClick={() => markOne(n)}>
              <p>{n.message}</p>
              <small>{new Date(n.created_at).toLocaleString()}</small>
            </div>
          ))}
        </div>
      )}
      {toast && <div className="toast" onClick={() => setToast('')}>🔔 {toast}</div>}
    </div>
  );
}
