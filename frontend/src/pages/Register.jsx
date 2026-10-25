import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const noSpace = (k) => (e) => setF({ ...f, [k]: e.target.value.replace(/\s/g, '') });
  const blockSpace = (e) => { if (e.key === ' ') e.preventDefault(); };

  const rules = [
    ['At least 8 characters', f.password.length >= 8],
    ['One uppercase letter', /[A-Z]/.test(f.password)],
    ['One special symbol (! @ # $ …)', /[^A-Za-z0-9\s]/.test(f.password)],
    ['No spaces', f.password.length > 0 && !/\s/.test(f.password)],
  ];

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!rules.every(([, ok]) => ok)) return setError('Password does not meet all the requirements');
    if (f.password !== f.confirm) return setError('Passwords do not match');
    try {
      await register(f.name, f.email, f.password);
      nav('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-photo signup-photo" />
      <form className="auth-form" onSubmit={submit}>
        <div className="auth-top"><Link to="/">← Home</Link><ThemeToggle /></div>
        <h1>Create Account</h1>
        <label>Name<input required value={f.name} onChange={set('name')} /></label>
        <label>Email<input type="email" required value={f.email} onChange={set('email')} /></label>
        <label>Password<input type="password" required value={f.password} onChange={noSpace('password')} onKeyDown={blockSpace} /></label>
        <ul className="pw-rules">
          {rules.map(([text, ok]) => <li key={text} className={ok ? 'ok' : ''}>{ok ? '✔' : '○'} {text}</li>)}
        </ul>
        <label>Confirm Password<input type="password" required value={f.confirm} onChange={noSpace('confirm')} onKeyDown={blockSpace} /></label>
        {error && <p className="error">{error}</p>}
        <p className="auth-link">Already have account? <Link to="/login">Sign In</Link></p>
        <button className="auth-btn">Sign up</button>
      </form>
    </div>
  );
}
