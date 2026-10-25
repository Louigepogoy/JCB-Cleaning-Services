import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell, Area,
} from 'recharts';
import { api } from '../api.js';
import { SkeletonStats, SkeletonTable } from '../components/Skeleton.jsx';

export const COLORS = ['#34b32f', '#1a7a14', '#f2b705', '#2f80ed', '#e5322d', '#8e5cf7'];
export const peso = (n) => `₱${Math.round(n || 0).toLocaleString()}`;
const monthLabel = (m) => {
  const [y, mo] = m.split('-');
  return new Date(y, mo - 1).toLocaleString('en', { month: 'short' }) + " '" + y.slice(2);
};

function Chart({ title, note, height = 280, children }) {
  return (
    <div className="card chart-card">
      <h3>{title}</h3>
      {note && <small>{note}</small>}
      <div style={{ height }}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
    </div>
  );
}

const Kpi = ({ label, value, sub }) => <div><b>{value}</b>{label}{sub && <small className="kpi-sub">{sub}</small>}</div>;

function Loading() {
  return <><SkeletonStats /><div className="chart-grid"><div className="card"><SkeletonTable rows={5} cols={2} /></div><div className="card"><SkeletonTable rows={5} cols={2} /></div></div></>;
}

// ---------------- DESCRIPTIVE ----------------
function Descriptive({ filters }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    setD(null);
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
    api(`/admin/analytics/descriptive?${qs}`).then(setD).catch((e) => setErr(e.message));
  }, [filters]);
  if (err) return <p className="error">{err}</p>;
  if (!d) return <Loading />;

  const k = d.kpis;
  const months = d.monthly.map((m) => ({ ...m, label: monthLabel(m.month) }));
  const topService = d.byService[0];
  const topChannel = [...d.byChannel].sort((a, b) => b.revenue - a.revenue)[0];
  const bestMonth = [...d.monthly].sort((a, b) => b.revenue - a.revenue)[0];
  const lowRated = [...d.byService].filter((s) => s.rating).sort((a, b) => a.rating - b.rating)[0];

  return (
    <>
      <div className="stats">
        <Kpi label="Revenue" value={peso(k.revenue)} />
        <Kpi label="Profit" value={peso(k.profit)} sub={`${k.margin}% margin`} />
        <Kpi label="Bookings" value={k.bookings} sub={`${k.completionRate}% completed`} />
        <Kpi label="Active customers" value={k.customers} />
        <Kpi label="Avg. order value" value={peso(k.avgOrder)} />
        <Kpi label="Avg. rating" value={`${k.rating || '–'} ★`} sub={`${k.reviews} reviews`} />
      </div>

      <div className="card insights">
        <h3>What happened? (key findings)</h3>
        <ul>
          {topService && <li><b>{topService.name}</b> earned the most revenue ({peso(topService.revenue)}).</li>}
          {bestMonth && <li>The best month was <b>{monthLabel(bestMonth.month)}</b> with {peso(bestMonth.revenue)} revenue.</li>}
          {topChannel && <li><b>{topChannel.channel}</b> brought in customers worth {peso(topChannel.revenue)} in total.</li>}
          {lowRated && <li>Lowest rated service: <b>{lowRated.name}</b> ({lowRated.rating} ★).</li>}
          <li>{k.cancelled} of {k.bookings} bookings were cancelled ({k.bookings ? Math.round((k.cancelled / k.bookings) * 100) : 0}%).</li>
        </ul>
      </div>

      <div className="chart-grid">
        <Chart title="Monthly revenue and profit" note="Bars = revenue, line = profit">
          <ComposedChart data={months}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip formatter={(v) => peso(v)} /><Legend />
            <Bar dataKey="revenue" name="Revenue" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
            <Line dataKey="profit" name="Profit" stroke={COLORS[2]} strokeWidth={3} dot />
          </ComposedChart>
        </Chart>
        <Chart title="Monthly bookings">
          <LineChart data={months}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
            <Line dataKey="bookings" name="Bookings" stroke={COLORS[3]} strokeWidth={3} />
          </LineChart>
        </Chart>
        <Chart title="Revenue and profit by service">
          <BarChart data={d.byService} layout="vertical" margin={{ left: 30 }}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="name" width={130} /><Tooltip formatter={(v) => peso(v)} /><Legend />
            <Bar dataKey="revenue" name="Revenue" fill={COLORS[0]} /><Bar dataKey="profit" name="Profit" fill={COLORS[2]} />
          </BarChart>
        </Chart>
        <Chart title="Customers by marketing channel">
          <PieChart>
            <Pie data={d.byChannel} dataKey="customers" nameKey="channel" outerRadius={95} label={(e) => `${e.channel} (${e.customers})`}>
              {d.byChannel.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie><Tooltip />
          </PieChart>
        </Chart>
        <Chart title="Payment methods">
          <PieChart>
            <Pie data={d.paymentMethods} dataKey="amount" nameKey="method" outerRadius={95} label={(e) => e.method}>
              {d.paymentMethods.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie><Tooltip formatter={(v) => peso(v)} />
          </PieChart>
        </Chart>
        <Chart title="Customer ratings" note="Number of reviews per star rating">
          <BarChart data={d.ratings}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="rating" tickFormatter={(r) => `${r} ★`} /><YAxis allowDecimals={false} /><Tooltip />
            <Bar dataKey="count" name="Reviews" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </Chart>
        <Chart title="New customers per month">
          <BarChart data={d.newCustomers.map((m) => ({ ...m, label: monthLabel(m.month) }))}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip />
            <Bar dataKey="customers" name="New customers" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </Chart>
        <div className="card">
          <h3>Marketing channels</h3>
          <table>
            <thead><tr><th>Channel</th><th>Spend</th><th>Customers</th><th>Cost / customer</th></tr></thead>
            <tbody>{d.byChannel.map((c) => (
              <tr key={c.channel}><td>{c.channel}</td><td>{peso(c.spend)}</td><td>{c.customers}</td><td>{c.cpa ? peso(c.cpa) : '–'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ---------------- PREDICTIVE ----------------
function Predictive() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api('/admin/analytics/predictive').then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="error">{err}</p>;
  if (!d) return <Loading />;
  if (!d.ready) return <p>{d.message}</p>;

  const lastHist = d.history[d.history.length - 1];
  const series = [
    ...d.history.map((h) => ({ label: monthLabel(h.month), actual: h.revenue, ma3: h.ma3, bookings: h.bookings })),
    ...d.forecast.map((f, i) => ({ label: monthLabel(f.month), forecast: f.revenue, band: [f.low, f.high], fbookings: f.bookings, ...(i === 0 ? {} : {}) })),
  ];
  // join the lines so the forecast starts where the history ends
  series[d.history.length - 1].forecast = lastHist.revenue;
  const bookingSeries = [
    ...d.history.map((h) => ({ label: monthLabel(h.month), actual: h.bookings })),
    ...d.forecast.map((f) => ({ label: monthLabel(f.month), forecast: f.bookings })),
  ];
  bookingSeries[d.history.length - 1].forecast = lastHist.bookings;

  return (
    <>
      <div className="card insights">
        <h3>What will happen? (forecast for the next 3 months)</h3>
        <p>Model: {d.model.type}, trained on {d.model.months} months of completed bookings. Revenue trend is
          <b> {d.model.revenueSlope >= 0 ? '+' : ''}{peso(d.model.revenueSlope)} per month</b> (R² = {d.model.revenueR2}); bookings trend is
          <b> {d.model.bookingSlope >= 0 ? '+' : ''}{d.model.bookingSlope} per month</b> (R² = {d.model.bookingR2}).</p>
      </div>
      <div className="stats">
        {d.forecast.map((f) => <Kpi key={f.month} label={`Forecast revenue, ${monthLabel(f.month)}`} value={peso(f.revenue)} sub={`${f.bookings} bookings · range ${peso(f.low)}–${peso(f.high)}`} />)}
      </div>
      <div className="chart-grid">
        <Chart title="Revenue: actual vs forecast" note="Shaded area = 95% prediction range">
          <ComposedChart data={series}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip formatter={(v) => (Array.isArray(v) ? `${peso(v[0])} – ${peso(v[1])}` : peso(v))} /><Legend />
            <Area dataKey="band" name="95% range" stroke="none" fill={COLORS[0]} fillOpacity={0.18} />
            <Line dataKey="actual" name="Actual" stroke={COLORS[1]} strokeWidth={3} />
            <Line dataKey="ma3" name="3-month average" stroke={COLORS[3]} strokeDasharray="4 4" dot={false} />
            <Line dataKey="forecast" name="Forecast" stroke={COLORS[2]} strokeWidth={3} strokeDasharray="6 4" />
          </ComposedChart>
        </Chart>
        <Chart title="Bookings: actual vs forecast">
          <LineChart data={bookingSeries}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
            <Line dataKey="actual" name="Actual" stroke={COLORS[1]} strokeWidth={3} />
            <Line dataKey="forecast" name="Forecast" stroke={COLORS[2]} strokeWidth={3} strokeDasharray="6 4" />
          </LineChart>
        </Chart>
        <Chart title="Demand growth by service" note="% change in monthly bookings (last 6 months trend)">
          <BarChart data={d.serviceTrends} layout="vertical" margin={{ left: 30 }}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" unit="%" /><YAxis type="category" dataKey="name" width={130} /><Tooltip formatter={(v) => `${v}% per month`} />
            <Bar dataKey="growthPct" name="Growth per month">
              {d.serviceTrends.map((s, i) => <Cell key={i} fill={s.growthPct >= 0 ? COLORS[0] : COLORS[4]} />)}
            </Bar>
          </BarChart>
        </Chart>
        <div className="card">
          <h3>Service demand next month</h3>
          <table>
            <thead><tr><th>Service</th><th>Avg / month</th><th>Next month</th><th>Trend</th></tr></thead>
            <tbody>{d.serviceTrends.map((s) => (
              <tr key={s.id}><td>{s.name}</td><td>{s.avgBookings}</td><td>{s.nextMonth}</td>
                <td><span className={`tag ${s.trend === 'rising' ? 'completed' : s.trend === 'falling' ? 'cancelled' : 'pending'}`}>{s.trend} {s.growthPct}%</span></td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ---------------- PRESCRIPTIVE ----------------
function Slider({ label, value, min, max, step, onChange, format = (v) => v }) {
  return (
    <label className="slider">
      <span>{label}: <b>{format(value)}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Prescriptive() {
  const [p, setP] = useState({ budget: null, cap: 40, jobs: 20, price: 0 });
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams(Object.entries(p).filter(([, v]) => v !== null)).toString();
      api(`/admin/analytics/prescriptive?${qs}`).then((r) => {
        setD(r);
        if (r.ready && p.budget === null) setP((x) => ({ ...x, budget: r.params.budget }));
      }).catch((e) => setErr(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [p]);

  if (err) return <p className="error">{err}</p>;
  if (!d) return <Loading />;
  if (!d.ready) return <p>{d.message}</p>;

  const m = d.marketing;
  const budgetMax = Math.max(20000, Math.round((d.params.budget || 4000) * 3));
  const chart = m.channels.map((c) => ({ name: c.channel, Current: c.currentCustomers, Recommended: c.recommendedCustomers }));
  const pr = d.pricing;

  return (
    <>
      <div className="card insights">
        <h3>What should we do? (recommendations)</h3>
        <ol className="rec-list">{d.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ol>
      </div>

      <div className="card">
        <h3>What-if controls</h3>
        <div className="slider-grid">
          <Slider label="Monthly marketing budget" value={p.budget ?? d.params.budget} min={1000} max={budgetMax} step={500} format={peso} onChange={(v) => setP({ ...p, budget: v })} />
          <Slider label="Max share per channel" value={p.cap} min={20} max={100} step={5} format={(v) => `${v}%`} onChange={(v) => setP({ ...p, cap: v })} />
          <Slider label="Jobs per cleaner / month" value={p.jobs} min={5} max={40} step={1} onChange={(v) => setP({ ...p, jobs: v })} />
          <Slider label="Price change" value={p.price} min={-20} max={30} step={1} format={(v) => `${v > 0 ? '+' : ''}${v}%`} onChange={(v) => setP({ ...p, price: v })} />
        </div>
      </div>

      <div className="stats">
        <Kpi label="New customers / month (recommended)" value={m.totals.recommendedCustomers} sub={`now: ${m.totals.currentCustomers}`} />
        <Kpi label="Expected customer value" value={peso(m.totals.recommendedRevenue)} sub={`now: ${peso(m.totals.currentRevenue)}`} />
        <Kpi label="Cleaners needed (peak)" value={Math.max(...d.staffing.months.map((x) => x.cleaners))} sub={`current need: ${d.staffing.currentStaff}`} />
        <Kpi label="Profit with price change" value={peso(pr.newProfit)} sub={`now: ${peso(pr.baseProfit)} / month`} />
      </div>

      <div className="chart-grid">
        <Chart title="Marketing: new customers per month" note="Current spending split vs recommended split (same total budget)">
          <BarChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend />
            <Bar dataKey="Current" fill={COLORS[3]} radius={[4, 4, 0, 0]} /><Bar dataKey="Recommended" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </Chart>
        <div className="card">
          <h3>Budget allocation by channel</h3>
          <table>
            <thead><tr><th>Channel</th><th>Cost / customer</th><th>Return per ₱1</th><th>Current</th><th>Recommended</th><th /></tr></thead>
            <tbody>{m.channels.map((c) => (
              <tr key={c.channel}><td>{c.channel}</td><td>{peso(c.cpa)}</td><td>₱{c.returnPerPeso}</td><td>{peso(c.currentBudget)}</td><td><b>{peso(c.recommendedBudget)}</b></td>
                <td><span className={`tag ${c.action === 'Increase' ? 'completed' : c.action === 'Reduce' ? 'cancelled' : 'pending'}`}>{c.action}</span></td></tr>
            ))}</tbody>
          </table>
        </div>
        <div className="card">
          <h3>Which services to promote</h3>
          <table>
            <thead><tr><th>#</th><th>Service</th><th>Profit / job</th><th>Margin</th><th>Growth</th><th>Rating</th><th>Action</th></tr></thead>
            <tbody>{d.services.map((s) => (
              <tr key={s.id}><td>{s.rank}</td><td>{s.name}</td><td>{peso(s.profitPerBooking)}</td><td>{s.marginPct}%</td><td>{s.growthPct}%</td><td>{s.rating ?? '–'}</td>
                <td><span className={`tag ${s.action === 'Promote' ? 'completed' : s.action === 'Maintain' ? 'confirmed' : 'pending'}`}>{s.action}</span></td></tr>
            ))}</tbody>
          </table>
        </div>
        <div className="card">
          <h3>Staffing plan</h3>
          <table>
            <thead><tr><th>Month</th><th>Forecast jobs</th><th>Cleaners needed</th><th>Change</th></tr></thead>
            <tbody>{d.staffing.months.map((s) => (
              <tr key={s.month}><td>{monthLabel(s.month)}</td><td>{s.bookings}</td><td>{s.cleaners}</td><td>{s.change > 0 ? `+${s.change} hire` : s.change < 0 ? `${s.change}` : 'no change'}</td></tr>
            ))}</tbody>
          </table>
          <h3 style={{ marginTop: 20 }}>Price what-if ({pr.priceChange > 0 ? '+' : ''}{pr.priceChange}%)</h3>
          <table>
            <thead><tr><th /><th>Now</th><th>After change</th></tr></thead>
            <tbody>
              <tr><td>Bookings / month</td><td>{pr.baseBookings}</td><td>{pr.newBookings}</td></tr>
              <tr><td>Revenue / month</td><td>{peso(pr.baseRevenue)}</td><td>{peso(pr.newRevenue)}</td></tr>
              <tr><td>Profit / month</td><td>{peso(pr.baseProfit)}</td><td><b>{peso(pr.newProfit)}</b></td></tr>
            </tbody>
          </table>
          <small>Assumes demand falls {Math.abs(pr.elasticity) * 10}% for every 10% price increase (elasticity {pr.elasticity}).</small>
        </div>
      </div>
    </>
  );
}

// ---------------- PAGE ----------------
const TABS = [['descriptive', '1 · Descriptive', 'What happened?'], ['predictive', '2 · Predictive', 'What will happen?'], ['prescriptive', '3 · Prescriptive', 'What should we do?']];

export default function Analytics() {
  const [tab, setTab] = useState('descriptive');
  const [services, setServices] = useState([]);
  const [filters, setFilters] = useState({ from: '', to: '', service_id: '' });
  useEffect(() => { api('/admin/services').then(setServices).catch(() => {}); }, []);
  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });

  return (
    <>
      <h1 className="page-title">Business Analytics</h1>
      <div className="sub-tabs">
        {TABS.map(([key, label, sub]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><b>{label}</b><small>{sub}</small></button>
        ))}
      </div>
      {tab === 'descriptive' && (
        <div className="card filter-bar">
          <label>From<input type="date" value={filters.from} onChange={set('from')} /></label>
          <label>To<input type="date" value={filters.to} onChange={set('to')} /></label>
          <label>Service
            <select value={filters.service_id} onChange={set('service_id')}>
              <option value="">All services</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <button className="btn small" onClick={() => setFilters({ from: '', to: '', service_id: '' })}>Reset</button>
        </div>
      )}
      {tab === 'descriptive' && <Descriptive filters={filters} />}
      {tab === 'predictive' && <Predictive />}
      {tab === 'prescriptive' && <Prescriptive />}
    </>
  );
}
