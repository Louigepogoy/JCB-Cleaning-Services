import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Logo from './Logo.jsx';
import Avatar from './Avatar.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import NotificationBell from './NotificationBell.jsx';

export default function DashLayout({ title, items, active, onSelect, children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="layout">
      <aside className="sidebar">
        <Link to="/" className="brand"><Logo size={44} /><span>JCB</span></Link>
        <p className="role-label">{title}</p>
        {items.map(([key, label, icon]) => (
          <button key={key} className={active === key ? 'active' : ''} onClick={() => onSelect(key)}>
            <span>{icon}</span> {label}
          </button>
        ))}
        <div className="sidebar-foot">
          <button className={`profile-link ${active === 'profile' ? 'active' : ''}`} onClick={() => onSelect('profile')} title="View my profile">
            <Avatar user={user} />
            <div><b>{user?.name}</b><small>{user?.email}</small></div>
          </button>
          <button className="logout" onClick={() => { logout(); nav('/'); }}>Log out</button>
        </div>
      </aside>
      <section className="content">
        <div className="top-actions">
          <Link to="/" className="btn small">← Landing page</Link>
          <ThemeToggle />
          <NotificationBell />
        </div>
        {children}
      </section>
    </div>
  );
}
