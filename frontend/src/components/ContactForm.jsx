import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function ContactForm() {
  const { user } = useAuth();
  const [f, setF] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '', message: '' });
  const [state, setState] = useState({ status: 'idle', text: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setState({ status: 'sending', text: '' });
    try {
      await api('/contact', { method: 'POST', body: f });
      setF({ ...f, message: '' });
      setState({ status: 'ok', text: 'Thank you! Your message was sent. We will get back to you soon.' });
    } catch (err) {
      setState({ status: 'error', text: err.message });
    }
  };

  return (
    <form className="contact-form" onSubmit={submit}>
      <div className="contact-row">
        <label>Your name<input required maxLength={100} value={f.name} onChange={set('name')} /></label>
        <label>Email<input type="email" required value={f.email} onChange={set('email')} /></label>
      </div>
      <label>Phone number (optional)<input type="tel" placeholder="+639171234567" value={f.phone} onChange={set('phone')} /></label>
      <label>Message<textarea required rows="5" maxLength={2000} placeholder="Tell us what you need cleaned…" value={f.message} onChange={set('message')} /></label>
      {state.text && <p className={state.status === 'ok' ? 'ok' : 'error'} role="status">{state.text}</p>}
      <button className="btn dark" disabled={state.status === 'sending'}>{state.status === 'sending' ? 'Sending…' : 'Send message  >'}</button>
    </form>
  );
}
