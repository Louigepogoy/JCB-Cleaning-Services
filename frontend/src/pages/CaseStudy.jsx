import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { peso } from './Analytics.jsx';
import { Skel } from '../components/Skeleton.jsx';

const monthName = (m) => new Date(m.split('-')[0], m.split('-')[1] - 1).toLocaleString('en', { month: 'long', year: 'numeric' });

export default function CaseStudy() {
  const [o, setO] = useState(null);
  const [d, setD] = useState(null);
  const [pd, setPd] = useState(null);
  const [rx, setRx] = useState(null);

  useEffect(() => {
    api('/admin/analytics/overview').then(setO).catch(() => {});
    api('/admin/analytics/descriptive').then(setD).catch(() => {});
    api('/admin/analytics/predictive').then(setPd).catch(() => {});
    api('/admin/analytics/prescriptive').then(setRx).catch(() => {});
  }, []);

  const variables = o && [
    ['Customers', o.customers, 'Name, sign-up date, acquisition channel (users table)'],
    ['Bookings', o.bookings, 'Service, date, address, status (bookings table)'],
    ['Payments', o.payments, 'Amount, method, date paid (payments table)'],
    ['Reviews', o.reviews, 'Rating 1–5 and comment (reviews table)'],
    ['Marketing campaigns', o.campaigns, 'Channel, month, cost, leads, conversions (marketing_campaigns table)'],
  ];
  const topService = d?.byService?.[0];
  const topChannel = d && [...d.byChannel].sort((a, b) => b.revenue - a.revenue)[0];
  const next = pd?.ready && pd.forecast[0];

  return (
    <>
      <h1 className="page-title">Case Study: JCB Cleaning Services</h1>

      <section className="card prose">
        <h2>1. Problem background</h2>
        <p><b>JCB Cleaning Services</b> is a cleaning company in Cebu City offering house, commercial, mattress, carpet, hard-floor and upholstery cleaning.
          Customers book online and the business earns from every completed job.</p>
        <p><b>The problem:</b> the owner has a limited marketing budget and a limited number of cleaners, and has to decide
          <i> where to spend the budget, which services to promote, and how many cleaners to have each month</i> so that revenue and profit grow.
          Today these decisions are made by guesswork.</p>
        <p><b>Business question:</b> <i>How can JCB increase profit by choosing the right marketing channels, the right services to promote, and the right staffing level?</i></p>
        <p><b>Objectives:</b> (1) understand past performance, (2) forecast demand and revenue, (3) recommend the best actions.</p>
      </section>

      <section className="card">
        <h2>2. Data collected (5 variables, 50+ records each)</h2>
        {!variables ? <Skel h={90} /> : (
          <table>
            <thead><tr><th>Variable</th><th>Records</th><th>Fields</th></tr></thead>
            <tbody>{variables.map(([n, c, f]) => (
              <tr key={n}><td><b>{n}</b></td><td>{c} {c >= 50 ? '✅' : '⚠️'}</td><td>{f}</td></tr>
            ))}</tbody>
          </table>
        )}
        <small>Data covers the last 12 months and is simulated for this case study. Live bookings made in the system are included automatically.</small>
      </section>

      <section className="card">
        <h2>3. Business analytics process (step by step)</h2>
        <div className="flow">
          <div className="flow-step">
            <span className="flow-n">1</span>
            <h3>Descriptive</h3><em>What happened?</em>
            {!d ? <Skel h={60} /> : (
              <ul>
                <li>Revenue {peso(d.kpis.revenue)}, profit {peso(d.kpis.profit)} ({d.kpis.margin}% margin)</li>
                {topService && <li>Top service: {topService.name}</li>}
                {topChannel && <li>Best channel by revenue: {topChannel.channel}</li>}
                <li>Average rating {d.kpis.rating} ★</li>
              </ul>
            )}
          </div>
          <div className="flow-arrow">➜<small>past patterns become the model's input</small></div>
          <div className="flow-step">
            <span className="flow-n">2</span>
            <h3>Predictive</h3><em>What will happen?</em>
            {!pd ? <Skel h={60} /> : !pd.ready ? <p>{pd.message}</p> : (
              <ul>
                <li>Linear regression on {pd.model.months} months of history</li>
                {next && <li>{monthName(next.month)}: about {peso(next.revenue)} and {next.bookings} bookings</li>}
                <li>Fastest growing service: {pd.serviceTrends[0].name} ({pd.serviceTrends[0].growthPct}%/month)</li>
              </ul>
            )}
          </div>
          <div className="flow-arrow">➜<small>forecasts become the plan's input</small></div>
          <div className="flow-step">
            <span className="flow-n">3</span>
            <h3>Prescriptive</h3><em>What should we do?</em>
            {!rx ? <Skel h={60} /> : !rx.ready ? <p>{rx.message}</p> : (
              <ul>
                {rx.recommendations.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            )}
          </div>
        </div>
        <p className="flow-note"><b>How the steps connect:</b> the <i>descriptive</i> step measures revenue, cost, channel performance and ratings from the five data variables.
          The <i>predictive</i> step uses the monthly revenue and booking history to forecast the next three months and each service's demand trend.
          The <i>prescriptive</i> step uses both: channel costs and customer value (descriptive) plus forecast jobs (predictive) to choose the marketing split,
          the services to promote and the number of cleaners.</p>
      </section>

      <section className="card prose">
        <h2>4. Methods</h2>
        <ul>
          <li><b>Descriptive:</b> SQL aggregation (totals, averages, group-by month, service and channel) shown as charts.</li>
          <li><b>Predictive:</b> least-squares linear regression for revenue and bookings with a 95% prediction range; 3-month moving average for comparison; per-service trend of the last 6 months.</li>
          <li><b>Prescriptive:</b> greedy budget optimisation (fund the channel with the best return per peso first, with a per-channel cap and 10% minimum), service ranking by profit × growth × rating, staffing = forecast jobs ÷ jobs per cleaner, and a price what-if with assumed elasticity −0.8.</li>
        </ul>
        <h2>5. Conclusion</h2>
        <p>With the dashboard the owner can see past results, expect the coming months, and test decisions using the sliders in the Prescriptive tab
          before spending money. Open <b>Analytics</b> in the sidebar to explore the charts and change the filters.</p>
        <h2>6. Limitations</h2>
        <p>The data is simulated; forecasts use a simple trend model and assume past patterns continue; marketing cost per customer is assumed constant when the budget changes.</p>
      </section>
    </>
  );
}
