export const Skel = ({ w = '100%', h = 14, r = 6, style }) => (
  <span className="skel" style={{ width: w, height: h, borderRadius: r, ...style }} />
);

export function SkeletonStats({ count = 4 }) {
  return (
    <div className="stats">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}><Skel w="50%" h={28} style={{ marginBottom: 10 }} /><Skel w="70%" h={12} /></div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 4, cols = 5 }) {
  return (
    <div className="skel-table" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skel-row">
          {Array.from({ length: cols }).map((_, j) => <Skel key={j} h={16} />)}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 6 }) {
  return (
    <div className="svc-grid" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="svc">
          <Skel w="70%" h={18} /><Skel h={12} /><Skel w="80%" h={12} /><Skel w={60} h={28} r={6} />
        </div>
      ))}
    </div>
  );
}
