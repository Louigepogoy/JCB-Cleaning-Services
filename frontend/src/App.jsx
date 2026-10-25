import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { Skel, SkeletonStats, SkeletonTable } from './components/Skeleton.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Customer from './pages/Customer.jsx';
import Admin from './pages/Admin.jsx';

function Guard({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="layout">
      <aside className="sidebar"><Skel w={44} h={44} r={22} /><Skel h={36} style={{ marginTop: 20 }} /><Skel h={36} /><Skel h={36} /></aside>
      <section className="content"><Skel w="30%" h={30} /><SkeletonStats /><SkeletonTable rows={4} cols={5} /></section>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<Guard role="customer"><Customer /></Guard>} />
      <Route path="/admin" element={<Guard role="admin"><Admin /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
