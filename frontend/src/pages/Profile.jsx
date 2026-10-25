import { useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Avatar from '../components/Avatar.jsx';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [f, setF] = useState({ name: user.name, email: user.email, phone: user.phone || '', address: user.address || '' });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const fileRef = useRef(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  // crop to a centered square, shrink to 256px and compress so it stays small in the database
  const resize = (file) => new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      canvas.getContext('2d').drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('That file is not a valid image'));
    img.src = url;
  });

  const savePhoto = async (avatar) => {
    setPhotoBusy(true);
    setMsg({ type: '', text: '' });
    try {
      const d = await api('/profile/avatar', { method: 'PUT', body: { avatar } });
      updateUser(d.user);
      setMsg({ type: 'ok', text: avatar ? 'Profile picture updated.' : 'Profile picture removed.' });
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
    finally { setPhotoBusy(false); }
  };

  const onFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setMsg({ type: 'error', text: 'Please choose an image file' });
    if (file.size > 10 * 1024 * 1024) return setMsg({ type: 'error', text: 'Image is too large (max 10 MB)' });
    try { await savePhoto(await resize(file)); }
    catch (err) { setMsg({ type: 'error', text: err.message }); }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg({ type: '', text: '' });
    try {
      const d = await api('/profile', { method: 'PUT', body: f });
      updateUser(d.user);
      setMsg({ type: 'ok', text: 'Profile saved.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally { setSaving(false); }
  };

  return (
    <>
      <h1 className="page-title">My Profile</h1>
      <div className="profile-grid">
        <section className="card profile-card">
          <button type="button" className="avatar-upload" onClick={() => fileRef.current.click()} disabled={photoBusy} title="Click to change your picture">
            <Avatar user={user} size={120} />
            <span>{photoBusy ? 'Uploading…' : '📷 Change photo'}</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
          {user.avatar && <button type="button" className="btn small" onClick={() => savePhoto('')} disabled={photoBusy}>Remove photo</button>}
          <h2>{user.name}</h2>
          <span className="tag confirmed">{user.role}</span>
          <dl>
            <dt>Email</dt><dd>{user.email}</dd>
            <dt>Phone</dt><dd>{user.phone || <i>not added yet</i>}</dd>
            <dt>Address</dt><dd>{user.address || <i>not added yet</i>}</dd>
          </dl>
        </section>

        <section className="card">
          <h2>Edit information</h2>
          <form className="form-grid" onSubmit={save}>
            <label>Full name<input required value={f.name} onChange={set('name')} /></label>
            <label>Email<input type="email" required value={f.email} onChange={set('email')} /></label>
            <label>Phone number<input type="tel" placeholder="+639171234567" value={f.phone} onChange={set('phone')} /></label>
            <label>Address<input placeholder="Street, barangay, city" value={f.address} onChange={set('address')} /></label>
            {msg.text && <p className={msg.type === 'ok' ? 'ok' : 'error'}>{msg.text}</p>}
            <button className="btn dark" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </form>
          <small>Your phone and address are used to fill in the booking form automatically.</small>
        </section>
      </div>
    </>
  );
}
