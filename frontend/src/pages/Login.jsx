import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const u = await login(form.email, form.password);
      nav(u.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-photo login-photo" />
      <form className="auth-form" onSubmit={submit}>
        <div className="auth-top"><Link to="/">← Home</Link><ThemeToggle /></div>
        <h1>Welcome To JCB</h1>
        <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Password<input type="password" required value={form.password} onKeyDown={(e) => { if (e.key === ' ') e.preventDefault(); }} onChange={(e) => setForm({ ...form, password: e.target.value.replace(/\s/g, '') })} /></label>
        {error && <p className="error">{error}</p>}
        <p className="auth-link">First time here? <Link to="/register">Create Account.</Link></p>
        <button className="auth-btn">Sign In</button>
      </form>
    </div>
  );
}
