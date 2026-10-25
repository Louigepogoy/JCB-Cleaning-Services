import { useEffect, useState } from 'react';
import { api } from '../api.js';
import DashLayout from '../components/DashLayout.jsx';
import Profile from './Profile.jsx';
import Analytics from './Analytics.jsx';
import CaseStudy from './CaseStudy.jsx';
import { SkeletonStats, SkeletonTable } from '../components/Skeleton.jsx';

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];
const ITEMS = [['overview', 'Overview', '📊'], ['analytics', 'Analytics', '📈'], ['case', 'Case Study', '📘'], ['bookings', 'Bookings', '📅'], ['services', 'Services', '🧹'], ['messages', 'Messages', '✉️'], ['customers', 'Customers', '👥']];

export default function Admin() {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [messages, setMessages] = useState([]);
  const [filter, setFilter] = useState('all');
  const [newSvc, setNewSvc] = useState({ name: '', description: '', price: '' });
  const [error, setError] = useState('');

  const [loading, setLoading] = useState(true);
  const load = () =>
    Promise.all([
      api('/admin/stats').then(setStats),
      api('/admin/bookings').then(setBookings),
      api('/admin/users').then(setUsers),
      api('/admin/services').then(setServices),
      api('/admin/messages').then(setMessages),
    ]).catch((e) => setError(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const run = async (fn) => { try { setError(''); await fn(); load(); } catch (e) { setError(e.message); } };
  const setStatus = (id, status) => run(() => api(`/admin/bookings/${id}`, { method: 'PATCH', body: { status } }));
  const markMsg = (m, read) => run(() => api(`/admin/messages/${m.id}/read`, { method: 'PATCH', body: { read } }));
  const deleteMsg = (m) => { if (confirm(`Delete the message from ${m.name}?`)) run(() => api(`/admin/messages/${m.id}`, { method: 'DELETE' })); };
  const toggleSvc = (s) => run(() => api(`/admin/services/${s.id}`, { method: 'PUT', body: { active: !s.active } }));
  const editPrice = (s) => {
    const p = prompt(`New price for ${s.name}`, s.price);
    if (p !== null && !isNaN(p)) run(() => api(`/admin/services/${s.id}`, { method: 'PUT', body: { price: Number(p) } }));
  };
  const addSvc = (e) => {
    e.preventDefault();
    run(async () => {
      await api('/admin/services', { method: 'POST', body: { ...newSvc, price: Number(newSvc.price) || 0 } });
      setNewSvc({ name: '', description: '', price: '' });
    });
  };

  const BookingsTable = ({ rows }) => (
    <table>
      <thead><tr><th>#</th><th>Customer</th><th>Service</th><th>When</th><th>Address / Phone</th><th>Status</th></tr></thead>
      <tbody>
        {rows.map((b) => (
          <tr key={b.id}>
            <td>{b.id}</td>
            <td>{b.customer_name}<br /><small>{b.customer_email}</small></td>
            <td>{b.service_name}<br /><small>₱{Number(b.price).toLocaleString()}</small></td>
            <td>{new Date(b.scheduled_at).toLocaleString()}</td>
            <td>{b.address}<br /><small>{b.phone}</small>{b.notes && <><br /><small>“{b.notes}”</small></>}</td>
            <td>
              <select className={`tag ${b.status}`} value={b.status} onChange={(e) => setStatus(b.id, e.target.value)}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const shown = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

  return (
    <DashLayout title="Admin" items={ITEMS} active={tab} onSelect={setTab}>
      {error && <p className="error">{error}</p>}

      {tab === 'overview' && (
        <>
          <h1 className="page-title">Dashboard</h1>
          {loading && <SkeletonStats />}
          {!loading && stats && (
            <div className="stats">
              <div><b>{stats.customers}</b>Customers</div>
              <div><b>{stats.bookings}</b>Total bookings</div>
              <div><b>{stats.pending}</b>Pending</div>
              <div><b>₱{stats.revenue.toLocaleString()}</b>Revenue (completed)</div>
            </div>
          )}
          <section className="card">
            <h2>Needs attention</h2>
            {loading ? <SkeletonTable cols={6} rows={3} /> : bookings.filter((b) => b.status === 'pending').length
              ? <BookingsTable rows={bookings.filter((b) => b.status === 'pending')} />
              : <p>No pending bookings.</p>}
          </section>
          <section className="card">
            <h2>Recent bookings</h2>
            {loading ? <SkeletonTable cols={6} rows={4} /> : bookings.length ? <BookingsTable rows={bookings.slice(0, 5)} /> : <p>No bookings yet.</p>}
          </section>
        </>
      )}

      {tab === 'analytics' && <Analytics />}
      {tab === 'case' && <CaseStudy />}
      {tab === 'profile' && <Profile />}

      {tab === 'bookings' && (
        <section className="card">
          <h2>All Bookings</h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          {loading ? <SkeletonTable cols={6} rows={5} /> : shown.length ? <BookingsTable rows={shown} /> : <p>No bookings.</p>}
        </section>
      )}

      {tab === 'services' && (
        <section className="card">
          <h2>Services</h2>
          <form className="inline-form" onSubmit={addSvc}>
            <input placeholder="Service name" required value={newSvc.name} onChange={(e) => setNewSvc({ ...newSvc, name: e.target.value })} />
            <input placeholder="Description" value={newSvc.description} onChange={(e) => setNewSvc({ ...newSvc, description: e.target.value })} />
            <input placeholder="Price" type="number" min="0" value={newSvc.price} onChange={(e) => setNewSvc({ ...newSvc, price: e.target.value })} />
            <button className="btn dark small">Add</button>
          </form>
          {loading ? <SkeletonTable cols={4} rows={5} /> : <table>
            <thead><tr><th>Name</th><th>Description</th><th>Price</th><th>Active</th></tr></thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td><td>{s.description}</td>
                  <td>₱{Number(s.price).toLocaleString()} <button className="btn small" onClick={() => editPrice(s)}>Edit</button></td>
                  <td><button className="btn small" onClick={() => toggleSvc(s)}>{s.active ? 'Disable' : 'Enable'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>}
        </section>
      )}

      {tab === 'messages' && (
        <section className="card">
          <h2>Contact messages {messages.filter((m) => !m.read).length > 0 && <span className="tag pending">{messages.filter((m) => !m.read).length} new</span>}</h2>
          {loading ? <SkeletonTable rows={3} cols={2} /> : messages.length === 0 ? <p>No messages yet. Messages sent from the Contact Us form on the landing page appear here.</p> : messages.map((m) => (
            <article key={m.id} className={`msg-item ${m.read ? '' : 'unread'}`}>
              <div className="msg-head">
                <b>{m.name}</b>
                <small>{new Date(m.created_at).toLocaleString()}</small>
              </div>
              <small><a href={`mailto:${m.email}`}>{m.email}</a>{m.phone && <> · <a href={`tel:${m.phone}`}>{m.phone}</a></>}</small>
              <p>{m.message}</p>
              <div className="msg-actions">
                <a className="btn small dark" href={`mailto:${m.email}?subject=${encodeURIComponent('Re: your message to JCB Cleaning Services')}`}>Reply by email</a>
                <button className="btn small" onClick={() => markMsg(m, !m.read)}>{m.read ? 'Mark as unread' : 'Mark as read'}</button>
                <button className="btn small" onClick={() => deleteMsg(m)}>Delete</button>
              </div>
            </article>
          ))}
        </section>
      )}

      {tab === 'customers' && (
        <section className="card">
          <h2>Users</h2>
          {loading ? <SkeletonTable cols={5} rows={5} /> : <table>
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Address</th><th>Role</th><th>Bookings</th><th>Joined</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.phone || '–'}</td><td>{u.address || '–'}</td><td>{u.role}</td><td>{u.bookings}</td><td>{new Date(u.created_at).toLocaleDateString()}</td></tr>
              ))}
            </tbody>
          </table>}
        </section>
      )}
    </DashLayout>
  );
}
