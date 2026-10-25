import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const FALLBACK = [
  ['House Cleaning', 'Complete top-to-bottom cleaning for your home.'],
  ['Commercial Cleaning', 'Offices, shops and commercial spaces.'],
  ['Mattress Cleaning', 'Deep clean and allergen removal for mattresses.'],
  ['Carpet Cleaning', 'Stain removal and deep carpet shampoo.'],
  ['Hard Floor Cleaning', 'Scrub, polish and restore hard floors.'],
  ['Upholstery Cleaning', 'Sofas, chairs and fabric furniture cleaning.'],
].map(([name, description], id) => ({ id, name, description, price: null }));

const ICONS = { House: '🏠', Commercial: '🏢', Mattress: '🛏️', Carpet: '🧶', 'Hard Floor': '🧹', Upholstery: '🛋️' };
const iconFor = (name) => Object.entries(ICONS).find(([k]) => name.startsWith(k))?.[1] || '✨';

const perViewNow = () => (window.matchMedia('(max-width: 800px)').matches ? 1 : 2);

export default function ServiceCarousel({ bookTo }) {
  const [services, setServices] = useState(FALLBACK);
  const [perView, setPerView] = useState(perViewNow);
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(null);

  useEffect(() => { api('/services').then((s) => s.length && setServices(s)).catch(() => {}); }, []);
  useEffect(() => {
    const onResize = () => setPerView(perViewNow());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const pages = Math.ceil(services.length / perView);
  const go = (p) => setPage(((p % pages) + pages) % pages);
  useEffect(() => { if (page >= pages) setPage(0); }, [pages, page]);

  // auto-advance every 5 seconds, paused while the mouse is over the slider
  useEffect(() => {
    if (paused || pages < 2) return;
    const t = setInterval(() => setPage((p) => (p + 1) % pages), 5000);
    return () => clearInterval(t);
  }, [paused, pages]);

  const slides = Array.from({ length: pages }, (_, i) => services.slice(i * perView, i * perView + perView));

  return (
    <div
      className="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(page + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      <button className="car-arrow left" onClick={() => go(page - 1)} aria-label="Previous services">‹</button>
      <div className="car-viewport">
        <div className="car-track" style={{ transform: `translateX(-${page * 100}%)` }}>
          {slides.map((group, i) => (
            <div className="car-slide" key={i} aria-hidden={i !== page}>
              {group.map((s) => (
                <article className="car-card" key={s.id}>
                  <div className="car-icon">{iconFor(s.name)}</div>
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                  {s.price != null && <b className="car-price">From ₱{Number(s.price).toLocaleString()}</b>}
                  <Link className="btn dark small" to={bookTo} tabIndex={i === page ? 0 : -1}>Book now &nbsp;&gt;</Link>
                </article>
              ))}
            </div>
          ))}
        </div>
      </div>
      <button className="car-arrow right" onClick={() => go(page + 1)} aria-label="Next services">›</button>

      <div className="car-dots" role="tablist" aria-label="Service slides">
        {slides.map((_, i) => (
          <button key={i} role="tab" aria-selected={i === page} aria-label={`Slide ${i + 1}`} className={i === page ? 'active' : ''} onClick={() => go(i)} />
        ))}
      </div>
    </div>
  );
}
