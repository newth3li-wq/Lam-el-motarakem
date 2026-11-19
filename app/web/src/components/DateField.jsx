import { formatDay } from '../lib/format';

/* Native date input keeps the browser picker and the real value, but the
   visible text is the Arabic date — the field itself renders mm/dd/yyyy in the
   browser's locale, which looks foreign in an RTL Arabic page. */
export default function DateField({ value, onChange, min, id, placeholder = 'اختار التاريخ', ariaLabel }) {
  return (
    <div className="date-field">
      <input
        id={id}
        type="date"
        className="date-native"
        value={value}
        min={min}
        onChange={(event) => onChange?.(event.target.value)}
        aria-label={ariaLabel}
      />
      <span className={'date-display' + (value ? '' : ' is-empty')} aria-hidden="true">
        {value ? formatDay(value, { day: 'numeric', month: 'long', year: 'numeric' }) : placeholder}
      </span>
      <svg
        className="date-icon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M8 3v4M16 3v4M3 10h18" />
      </svg>
    </div>
  );
}
