import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import DashLayout from '../components/DashLayout.jsx';
import Profile from './Profile.jsx';
import { SkeletonStats, SkeletonTable, SkeletonCards } from '../components/Skeleton.jsx';

const empty = { service_id: '', address: '', phone: '', scheduled_at: '', notes: '' };
const ITEMS = [['overview', 'Overview', '🏠'], ['book', 'Book a Service', '📝'], ['bookings', 'My Bookings', '📅']];

function BookingsTable({ bookings, onCancel }) {
  if (!bookings.length) return <p>No bookings yet.</p>;
  return (
    <table>
      <thead><tr><th>Service</th><th>When</th><th>Address</th><th>Price</th><th>Status</th>{onCancel && <th />}</tr></thead>
      <tbody>
        {bookings.map((b) => (
          <tr key={b.id}>
            <td>{b.service_name}</td>
            <td>{new Date(b.scheduled_at).toLocaleString()}</td>
            <td>{b.address}</td>
            <td>₱{Number(b.price).toLocaleString()}</td>
            <td><span className={`tag ${b.status}`}>{b.status}</span></td>
            {onCancel && <td>{['pending', 'confirmed'].includes(b.status) && <button className="btn small" onClick={() => onCancel(b.id)}>Cancel</button>}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Customer() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [form, setForm] = useState(empty);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const [loading, setLoading] = useState(true);
  const load = () => api('/bookings/mine').then(setBookings).catch((e) => setMsg({ type: 'error', text: e.message }));
  useEffect(() => {
    Promise.all([api('/services').then(setServices).catch(() => {}), load()]).finally(() => setLoading(false));
  }, []);

  // booking form starts with the phone and address saved in the profile
  const blank = { ...empty, phone: user.phone || '', address: user.address || '' };
  useEffect(() => { setForm((f) => ({ ...f, phone: f.phone || user.phone || '', address: f.address || user.address || '' })); }, [user.phone, user.address]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api('/bookings', { method: 'POST', body: { ...form, scheduled_at: new Date(form.scheduled_at).toISOString() } });
      setForm(blank);
      setMsg({ type: '', text: '' });
      await load();
      setTab('bookings');
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  };
  const cancel = async (id) => {
    if (!confirm('Cancel this booking?')) return;
    try { await api(`/bookings/${id}/cancel`, { method: 'PATCH' }); load(); }
    catch (err) { setMsg({ type: 'error', text: err.message }); }
  };

  const now = new Date();
  const upcoming = bookings
    .filter((b) => ['pending', 'confirmed'].includes(b.status) && new Date(b.scheduled_at) >= now)
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const count = (s) => bookings.filter((b) => b.status === s).length;

  return (
    <DashLayout title="Customer" items={ITEMS} active={tab} onSelect={setTab}>
      {tab === 'overview' && (
        <>
          <h1 className="page-title">Hello, {user.name.split(' ')[0]} 👋</h1>
          {loading ? <SkeletonStats /> : (
            <div className="stats">
              <div><b>{bookings.length}</b>Total bookings</div>
              <div><b>{count('pending')}</b>Awaiting confirmation</div>
              <div><b>{count('confirmed')}</b>Confirmed</div>
              <div><b>{count('completed')}</b>Completed</div>
            </div>
          )}
          <section className="card">
            <h2>Next booking</h2>
            {loading ? <SkeletonTable rows={1} cols={2} /> : upcoming[0] ? (
              <p><b>{upcoming[0].service_name}</b> — {new Date(upcoming[0].scheduled_at).toLocaleString()}<br />
                {upcoming[0].address} <span className={`tag ${upcoming[0].status}`}>{upcoming[0].status}</span></p>
            ) : <p>Nothing scheduled. <button className="btn dark small" onClick={() => setTab('book')}>Book a service</button></p>}
          </section>
          <section className="card">
            <h2>Our services</h2>
            {loading ? <SkeletonCards /> : <div className="svc-grid">
              {services.map((s) => (
                <div key={s.id} className="svc">
                  <h3>{s.name}</h3><p>{s.description}</p>
                  <b>₱{Number(s.price).toLocaleString()}</b>
                  <button className="btn dark small" onClick={() => { setForm({ ...blank, service_id: String(s.id) }); setTab('book'); }}>Book</button>
                </div>
              ))}
            </div>}
          </section>
        </>
      )}

      {tab === 'book' && (
        <section className="card">
          <h2>Book a Service</h2>
          <form className="form-grid" onSubmit={submit}>
            <label>Service
              <select required value={form.service_id} onChange={set('service_id')}>
                <option value="">Select…</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name} — ₱{Number(s.price).toLocaleString()}</option>)}
              </select>
            </label>
            <label>Date &amp; time<input type="datetime-local" required value={form.scheduled_at} onChange={set('scheduled_at')} /></label>
            <label>Address<input required value={form.address} onChange={set('address')} /></label>
            <label>Phone<input required value={form.phone} onChange={set('phone')} /></label>
            <label className="full">Notes<textarea rows="3" value={form.notes} onChange={set('notes')} /></label>
            {msg.text && <p className="error">{msg.text}</p>}
            <button className="btn dark">Submit booking</button>
          </form>
        </section>
      )}

      {tab === 'profile' && <Profile />}

      {tab === 'bookings' && (
        <section className="card">
          <h2>My Bookings</h2>
          {msg.text && <p className="error">{msg.text}</p>}
          {loading ? <SkeletonTable rows={4} cols={5} /> : <BookingsTable bookings={bookings} onCancel={cancel} />}
        </section>
      )}
    </DashLayout>
  );
}
