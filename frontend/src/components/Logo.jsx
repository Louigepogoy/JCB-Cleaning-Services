// Drawn as SVG so the circle, "JCB" and the small "CLEANING" text always scale together
// and can never spill outside the circle, whatever the size or browser font settings.
export default function Logo({ size = 56 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="JCB Cleaning Services">
      <circle cx="50" cy="50" r="47" fill="#fff" stroke="#3a9bdc" strokeWidth="4" />
      <text x="50" y="53" textAnchor="middle" fontSize="33" fontWeight="800" fill="#12306b" fontFamily="Inter, 'Segoe UI', Arial, sans-serif" letterSpacing="-1">JCB</text>
      <text x="50" y="69" textAnchor="middle" fontSize="9" fontWeight="700" fill="#555" fontFamily="Inter, 'Segoe UI', Arial, sans-serif" textLength="46" lengthAdjust="spacingAndGlyphs">CLEANING</text>
    </svg>
  );
}
