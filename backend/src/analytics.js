import { Router } from 'express';
import { query } from './db.js';

export const analyticsRouter = Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const num = (v, d) => (v === undefined || v === '' || isNaN(Number(v)) ? d : Number(v));
const round = (n, p = 0) => Math.round(n * 10 ** p) / 10 ** p;
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

// Builds the "AND ..." filter text for bookings aliased as b (date range + service).
function filters(q, { service = true } = {}) {
  const params = [];
  let sql = '';
  if (isDate(q.from)) { params.push(q.from); sql += ` AND b.scheduled_at >= $${params.length}::date`; }
  if (isDate(q.to)) { params.push(q.to); sql += ` AND b.scheduled_at < ($${params.length}::date + 1)`; }
  if (service && /^\d+$/.test(q.service_id || '')) { params.push(Number(q.service_id)); sql += ` AND b.service_id = $${params.length}`; }
  return { sql, params };
}

// ---------- helpers ----------
function linreg(ys) {
  const n = ys.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0, r2: 0, se: 0 };
  const mx = (n - 1) / 2;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  ys.forEach((y, x) => { sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); syy += (y - my) ** 2; });
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const sse = ys.reduce((a, y, x) => a + (y - (intercept + slope * x)) ** 2, 0);
  return { slope, intercept, r2: syy ? 1 - sse / syy : 0, se: n > 2 ? Math.sqrt(sse / (n - 2)) : 0 };
}

const addMonths = (ym, k) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + k, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// monthly completed bookings / revenue over full months only (current month is incomplete)
async function history() {
  const { rows } = await query(`
    SELECT to_char(date_trunc('month', b.scheduled_at),'YYYY-MM') AS month, b.service_id,
           COUNT(*)::int AS bookings, COALESCE(SUM(p.amount),0)::float AS revenue, COALESCE(SUM(s.cost),0)::float AS cost
    FROM bookings b JOIN services s ON s.id=b.service_id LEFT JOIN payments p ON p.booking_id=b.id
    WHERE b.status='completed' AND b.scheduled_at < date_trunc('month', now())
    GROUP BY 1,2 ORDER BY 1`);
  if (!rows.length) return { months: [], total: [], perService: {} };
  const first = rows[0].month, last = rows[rows.length - 1].month;
  const months = [];
  for (let m = first; m <= last; m = addMonths(m, 1)) months.push(m);
  const total = months.map((month) => ({ month, bookings: 0, revenue: 0, cost: 0 }));
  const perService = {};
  for (const r of rows) {
    const t = total[months.indexOf(r.month)];
    t.bookings += r.bookings; t.revenue += r.revenue; t.cost += r.cost;
    (perService[r.service_id] ||= months.map(() => 0))[months.indexOf(r.month)] = r.bookings;
  }
  return { months, total, perService };
}

function buildForecast(h, ahead = 3) {
  const rev = h.total.map((t) => t.revenue);
  const bk = h.total.map((t) => t.bookings);
  const rm = linreg(rev), bm = linreg(bk);
  const n = h.months.length;
  const last = h.months[n - 1];
  const forecast = [];
  for (let i = 1; i <= ahead; i++) {
    const x = n - 1 + i;
    const revenue = Math.max(0, rm.intercept + rm.slope * x);
    const margin = 1.96 * rm.se;
    forecast.push({
      month: addMonths(last, i),
      revenue: round(revenue),
      low: round(Math.max(0, revenue - margin)),
      high: round(revenue + margin),
      bookings: Math.max(0, round(bm.intercept + bm.slope * x)),
    });
  }
  return { revenueModel: rm, bookingModel: bm, forecast };
}

// ---------- overview (row counts for the 5 variables) ----------
analyticsRouter.get('/overview', wrap(async (req, res) => {
  const { rows } = await query(`SELECT
    (SELECT COUNT(*)::int FROM users WHERE role='customer') AS customers,
    (SELECT COUNT(*)::int FROM bookings) AS bookings,
    (SELECT COUNT(*)::int FROM payments) AS payments,
    (SELECT COUNT(*)::int FROM reviews) AS reviews,
    (SELECT COUNT(*)::int FROM marketing_campaigns) AS campaigns,
    (SELECT COUNT(*)::int FROM services) AS services`);
  res.json(rows[0]);
}));

// ---------- 1. DESCRIPTIVE: what happened? ----------
analyticsRouter.get('/descriptive', wrap(async (req, res) => {
  const f = filters(req.query);
  const fd = filters(req.query, { service: false });
  const base = `FROM bookings b JOIN services s ON s.id=b.service_id LEFT JOIN payments p ON p.booking_id=b.id WHERE TRUE`;

  const [kpi, monthly, byService, byChannel, spend, methods, ratings, newCustomers, avgRating] = await Promise.all([
    query(`SELECT COUNT(b.id)::int AS bookings,
             COUNT(*) FILTER (WHERE b.status='completed')::int AS completed,
             COUNT(*) FILTER (WHERE b.status='cancelled')::int AS cancelled,
             COUNT(DISTINCT b.user_id)::int AS customers,
             COALESCE(SUM(p.amount),0)::float AS revenue,
             COALESCE(SUM(s.cost) FILTER (WHERE b.status='completed'),0)::float AS cost
           ${base}${f.sql}`, f.params),
    query(`SELECT to_char(date_trunc('month', b.scheduled_at),'YYYY-MM') AS month,
             COUNT(b.id)::int AS bookings, COALESCE(SUM(p.amount),0)::float AS revenue,
             COALESCE(SUM(s.cost) FILTER (WHERE b.status='completed'),0)::float AS cost
           ${base}${f.sql} GROUP BY 1 ORDER BY 1`, f.params),
    query(`SELECT s.id, s.name, s.price::float AS price, s.cost::float AS cost, COUNT(b.id)::int AS bookings,
             COALESCE(SUM(p.amount),0)::float AS revenue,
             COALESCE(SUM(p.amount - s.cost) FILTER (WHERE b.status='completed'),0)::float AS profit,
             (SELECT ROUND(AVG(r.rating)::numeric,2)::float FROM reviews r JOIN bookings bb ON bb.id=r.booking_id WHERE bb.service_id=s.id) AS rating
           FROM services s LEFT JOIN bookings b ON b.service_id=s.id ${fd.sql}
           LEFT JOIN payments p ON p.booking_id=b.id GROUP BY s.id ORDER BY revenue DESC`, fd.params),
    query(`SELECT u.source AS channel, COUNT(DISTINCT u.id)::int AS customers, COALESCE(SUM(p.amount),0)::float AS revenue
           FROM users u LEFT JOIN bookings b ON b.user_id=u.id ${fd.sql}
           LEFT JOIN payments p ON p.booking_id=b.id WHERE u.role='customer' GROUP BY 1 ORDER BY 3 DESC`, fd.params),
    query(`SELECT channel, SUM(cost)::float AS spend, SUM(leads)::int AS leads, SUM(conversions)::int AS conversions
           FROM marketing_campaigns GROUP BY 1`),
    query(`SELECT p.method, COUNT(*)::int AS count, SUM(p.amount)::float AS amount
           FROM payments p JOIN bookings b ON b.id=p.booking_id WHERE TRUE${f.sql} GROUP BY 1 ORDER BY 3 DESC`, f.params),
    query(`SELECT r.rating, COUNT(*)::int AS count FROM reviews r JOIN bookings b ON b.id=r.booking_id
           WHERE TRUE${f.sql} GROUP BY 1 ORDER BY 1`, f.params),
    query(`SELECT to_char(date_trunc('month', created_at),'YYYY-MM') AS month, COUNT(*)::int AS customers
           FROM users WHERE role='customer' GROUP BY 1 ORDER BY 1`),
    query(`SELECT ROUND(AVG(r.rating)::numeric,2)::float AS avg, COUNT(*)::int AS n
           FROM reviews r JOIN bookings b ON b.id=r.booking_id WHERE TRUE${f.sql}`, f.params),
  ]);

  const k = kpi.rows[0];
  const spendBy = Object.fromEntries(spend.rows.map((r) => [r.channel, r]));
  res.json({
    kpis: {
      ...k,
      profit: round(k.revenue - k.cost),
      margin: k.revenue ? round(((k.revenue - k.cost) / k.revenue) * 100, 1) : 0,
      avgOrder: k.completed ? round(k.revenue / k.completed) : 0,
      completionRate: k.bookings ? round((k.completed / k.bookings) * 100, 1) : 0,
      rating: avgRating.rows[0].avg || 0,
      reviews: avgRating.rows[0].n,
    },
    monthly: monthly.rows.map((m) => ({ ...m, profit: round(m.revenue - m.cost) })),
    byService: byService.rows,
    byChannel: byChannel.rows.map((c) => ({
      ...c,
      spend: spendBy[c.channel]?.spend || 0,
      cpa: spendBy[c.channel]?.conversions ? round(spendBy[c.channel].spend / spendBy[c.channel].conversions) : null,
    })),
    paymentMethods: methods.rows,
    ratings: [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: ratings.rows.find((x) => x.rating === r)?.count || 0 })),
    newCustomers: newCustomers.rows,
  });
}));

// ---------- 2. PREDICTIVE: what will happen? ----------
analyticsRouter.get('/predictive', wrap(async (req, res) => {
  const h = await history();
  if (h.months.length < 3) return res.json({ ready: false, message: 'Need at least 3 months of completed bookings. Run: npm run seed:analytics' });
  const { revenueModel, bookingModel, forecast } = buildForecast(h, 3);

  // 3-month moving average (a simple second model to compare against)
  const ma = h.total.map((_, i) => (i < 2 ? null : round((h.total[i].revenue + h.total[i - 1].revenue + h.total[i - 2].revenue) / 3)));
  const { rows: services } = await query('SELECT id,name FROM services ORDER BY id');
  const serviceTrends = services
    .map((s) => {
      const series = h.perService[s.id] || h.months.map(() => 0);
      const recent = series.slice(-6);
      const m = linreg(recent);
      const mean = recent.reduce((a, b) => a + b, 0) / (recent.length || 1);
      return {
        id: s.id, name: s.name,
        avgBookings: round(mean, 1),
        nextMonth: Math.max(0, round(m.intercept + m.slope * recent.length, 1)),
        growthPct: mean ? round((m.slope / mean) * 100, 1) : 0,
        trend: m.slope > 0.05 ? 'rising' : m.slope < -0.05 ? 'falling' : 'flat',
      };
    })
    .sort((a, b) => b.growthPct - a.growthPct);

  res.json({
    ready: true,
    history: h.total.map((t, i) => ({ month: t.month, revenue: round(t.revenue), bookings: t.bookings, ma3: ma[i] })),
    forecast,
    model: {
      type: 'Simple linear regression (least squares) on monthly revenue and bookings',
      revenueSlope: round(revenueModel.slope), revenueR2: round(revenueModel.r2, 3),
      bookingSlope: round(bookingModel.slope, 2), bookingR2: round(bookingModel.r2, 3),
      months: h.months.length,
    },
    serviceTrends,
  });
}));

// ---------- 3. PRESCRIPTIVE: what should we do? ----------
analyticsRouter.get('/prescriptive', wrap(async (req, res) => {
  const h = await history();
  if (h.months.length < 3) return res.json({ ready: false, message: 'Need at least 3 months of completed bookings. Run: npm run seed:analytics' });
  const { forecast } = buildForecast(h, 3);

  // --- marketing channels (last 12 months) ---
  const [mk, value, svcRows] = await Promise.all([
    query(`SELECT channel, SUM(cost)::float AS spend, SUM(leads)::int AS leads, SUM(conversions)::int AS conversions
           FROM marketing_campaigns WHERE month >= date_trunc('month', now()) - interval '12 months' GROUP BY 1`),
    query(`SELECT u.source AS channel, COUNT(DISTINCT u.id)::int AS customers, COALESCE(SUM(p.amount),0)::float AS revenue
           FROM users u LEFT JOIN bookings b ON b.user_id=u.id LEFT JOIN payments p ON p.booking_id=b.id
           WHERE u.role='customer' GROUP BY 1`),
    query(`SELECT s.id, s.name, s.price::float AS price, s.cost::float AS cost,
             COUNT(b.id) FILTER (WHERE b.status='completed')::int AS bookings,
             (SELECT ROUND(AVG(r.rating)::numeric,2)::float FROM reviews r JOIN bookings bb ON bb.id=r.booking_id WHERE bb.service_id=s.id) AS rating
           FROM services s LEFT JOIN bookings b ON b.service_id=s.id AND b.scheduled_at >= now() - interval '12 months'
           WHERE s.active GROUP BY s.id ORDER BY s.id`),
  ]);
  const valueBy = Object.fromEntries(value.rows.map((r) => [r.channel, r]));
  const channels = mk.rows
    .filter((c) => c.spend > 0 && c.conversions > 0)
    .map((c) => {
      const v = valueBy[c.channel];
      const ltv = v?.customers ? v.revenue / v.customers : 0; // revenue per acquired customer
      const cpa = c.spend / c.conversions;
      return { channel: c.channel, spend: round(c.spend), conversions: c.conversions, cpa: round(cpa), ltv: round(ltv), returnPerPeso: round(ltv / cpa, 2) };
    });
  const totalSpend = channels.reduce((a, c) => a + c.spend, 0);
  const budget = num(req.query.budget, round(totalSpend / 12));
  const nCh = Math.max(channels.length, 1);
  const capPct = Math.min(100, Math.max(100 / nCh, num(req.query.cap, 40)));
  const cap = (capPct / 100) * budget;

  // Greedy optimisation: fund the channel with the best return per peso first, up to the cap.
  // Every channel keeps a 10% floor so no channel is switched off completely.
  const floor = Math.min(0.1 * budget, cap);
  let remaining = Math.max(0, budget - floor * channels.length);
  const allocation = {};
  [...channels].sort((a, b) => b.returnPerPeso - a.returnPerPeso).forEach((c) => {
    const extra = Math.min(cap - floor, remaining);
    allocation[c.channel] = floor + extra; remaining -= extra;
  });
  const marketing = channels.map((c) => {
    const current = totalSpend ? (c.spend / totalSpend) * budget : 0;
    const rec = allocation[c.channel] || 0;
    return {
      ...c,
      currentBudget: round(current), recommendedBudget: round(rec),
      currentCustomers: round(current / c.cpa, 1), recommendedCustomers: round(rec / c.cpa, 1),
      action: rec > current * 1.1 ? 'Increase' : rec < current * 0.9 ? 'Reduce' : 'Keep',
    };
  }).sort((a, b) => b.returnPerPeso - a.returnPerPeso);
  const curCust = marketing.reduce((a, c) => a + c.currentCustomers, 0);
  const recCust = marketing.reduce((a, c) => a + c.recommendedCustomers, 0);
  const curRev = marketing.reduce((a, c) => a + c.currentCustomers * c.ltv, 0);
  const recRev = marketing.reduce((a, c) => a + c.recommendedCustomers * c.ltv, 0);

  // --- which services to promote ---
  const trend = {};
  for (const s of svcRows.rows) {
    const recent = (h.perService[s.id] || []).slice(-6);
    const m = linreg(recent);
    const mean = recent.reduce((a, b) => a + b, 0) / (recent.length || 1);
    trend[s.id] = mean ? (m.slope / mean) * 100 : 0;
  }
  const services = svcRows.rows.map((s) => {
    const profitPer = s.price - s.cost;
    const growth = round(trend[s.id], 1);
    const score = profitPer * Math.max(0.2, 1 + growth / 100) * ((s.rating || 4) / 5);
    return { id: s.id, name: s.name, price: s.price, profitPerBooking: round(profitPer), marginPct: round((profitPer / s.price) * 100, 1), growthPct: growth, rating: s.rating, bookings: s.bookings, score: round(score) };
  }).sort((a, b) => b.score - a.score).map((s, i, arr) => ({
    ...s,
    action: i < 2 ? 'Promote' : s.rating && s.rating < 4 ? 'Improve quality' : s.marginPct < 35 ? 'Review pricing' : 'Maintain',
    rank: i + 1,
    isLast: i === arr.length - 1,
  }));

  // --- staffing ---
  const jobsPerCleaner = Math.max(1, num(req.query.jobs, 20));
  const lastThree = h.total.slice(-3);
  const avgRecent = lastThree.reduce((a, t) => a + t.bookings, 0) / lastThree.length;
  const currentStaff = Math.ceil(avgRecent / jobsPerCleaner);
  const staffing = forecast.map((f) => ({ month: f.month, bookings: f.bookings, cleaners: Math.ceil(f.bookings / jobsPerCleaner), change: Math.ceil(f.bookings / jobsPerCleaner) - currentStaff }));

  // --- price what-if (assumed price elasticity of demand = -0.8) ---
  const priceChange = num(req.query.price, 0);
  const elasticity = -0.8;
  const revPer = lastThree.reduce((a, t) => a + t.revenue, 0) / (lastThree.reduce((a, t) => a + t.bookings, 0) || 1);
  const costPer = lastThree.reduce((a, t) => a + t.cost, 0) / (lastThree.reduce((a, t) => a + t.bookings, 0) || 1);
  const newBookings = avgRecent * Math.max(0, 1 + (elasticity * priceChange) / 100);
  const pricing = {
    priceChange, elasticity,
    baseBookings: round(avgRecent, 1), newBookings: round(newBookings, 1),
    baseRevenue: round(avgRecent * revPer), newRevenue: round(newBookings * revPer * (1 + priceChange / 100)),
    baseProfit: round(avgRecent * (revPer - costPer)), newProfit: round(newBookings * (revPer * (1 + priceChange / 100) - costPer)),
  };

  // --- plain-language recommendations ---
  const best = marketing[0], worst = marketing[marketing.length - 1];
  const promote = services.filter((s) => s.action === 'Promote').map((s) => s.name);
  const weak = services.filter((s) => s.action === 'Improve quality');
  const recommendations = [];
  if (best) recommendations.push(`Put the most marketing money into ${best.channel}: each ₱1 spent returns about ₱${best.returnPerPeso} in customer revenue (cost per new customer ₱${best.cpa}).`);
  if (worst && worst !== best) recommendations.push(`Cut back on ${worst.channel}: it is the weakest channel at ₱${worst.cpa} per new customer and ₱${worst.returnPerPeso} return per ₱1.`);
  recommendations.push(`Reallocating the ₱${round(budget).toLocaleString()} monthly budget as recommended is expected to bring about ${round(recCust, 1)} new customers per month instead of ${round(curCust, 1)} (${curCust ? round(((recCust - curCust) / curCust) * 100) : 0}% more).`);
  if (promote.length) recommendations.push(`Promote ${promote.join(' and ')}: they give the best mix of profit per job, growing demand and customer rating.`);
  weak.forEach((s) => recommendations.push(`${s.name} is rated ${s.rating}/5. Retrain the team or improve supplies before promoting it.`));
  const peak = staffing.reduce((a, b) => (b.cleaners > a.cleaners ? b : a), staffing[0]);
  recommendations.push(`Plan for ${peak.cleaners} cleaners in ${peak.month} (about ${peak.bookings} jobs). Current need is ${currentStaff}, so ${peak.change > 0 ? `hire ${peak.change} more` : 'no new hires are needed'}.`);

  res.json({
    ready: true,
    params: { budget, capPct, jobsPerCleaner, priceChange },
    marketing: { channels: marketing, totals: { currentCustomers: round(curCust, 1), recommendedCustomers: round(recCust, 1), currentRevenue: round(curRev), recommendedRevenue: round(recRev) } },
    services, staffing: { currentStaff, months: staffing }, pricing, recommendations,
  });
}));
