import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Logo from './Logo.jsx';

export default function Topbar({ title }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <header className="topbar">
      <Link to="/" className="brand"><Logo size={44} /> <span>{title}</span></Link>
      <div className="topbar-right">
        <span>{user?.name} ({user?.role})</span>
        <button className="btn small" onClick={() => { logout(); nav('/'); }}>Log out</button>
      </div>
    </header>
  );
}
