/* The mark is a geometric ل: one stroke, the tall rise and the baseline that
   turns under it. That is the first letter of «لمّ», it needs no container
   and it keeps its shape at 16px. Used inline everywhere the brand appears,
   and redrawn at 64px in public/favicon.svg. */
export default function BrandMark({ size = 28, className = '', label }) {
  const a11y = label
    ? { role: 'img', 'aria-label': label }
    : { 'aria-hidden': 'true', focusable: 'false' };

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      {...a11y}
    >
      <path
        d="M23.4 4.8v14.7a4.5 4.5 0 0 1-4.5 4.5H6.6"
        stroke="currentColor"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
