/* Small inline icon set — one visual language: 24px grid, 1.75 stroke, round caps. */
function Svg({ size = 20, children, className = '', ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Home = (p) => <Svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V20h13V9.5" /><path d="M9.5 20v-5.5h5V20" /></Svg>;
export const Layers = (p) => <Svg {...p}><path d="M12 3 3 7.8l9 4.8 9-4.8L12 3Z" /><path d="m3 12.2 9 4.8 9-4.8" /><path d="m3 16.6 9 4.8 9-4.8" /></Svg>;
export const Calendar = (p) => <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /><path d="M8 14h2M14 14h2M8 17.5h2M14 17.5h2" /></Svg>;
export const Chart = (p) => <Svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>;
export const Book = (p) => <Svg {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5V5.5Z" /><path d="M4 21.5A2.5 2.5 0 0 1 6.5 19H20" /><path d="M8 7h8M8 10.5h6" /></Svg>;
export const Bell = (p) => <Svg {...p}><path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7Z" /><path d="M10.3 20a2 2 0 0 0 3.4 0" /></Svg>;
export const User = (p) => <Svg {...p}><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></Svg>;
export const Logout = (p) => <Svg {...p}><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" /><path d="M15 8l4 4-4 4" /><path d="M19 12H9" /></Svg>;
export const Menu = (p) => <Svg {...p}><path d="M4 7h16M4 12h16M4 17h10" /></Svg>;
export const PanelClose = (p) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /><path d="m16 9-3 3 3 3" /></Svg>;
export const Close = (p) => <Svg {...p}><path d="m6 6 12 12M18 6 6 18" /></Svg>;
export const ChevronRight = (p) => <Svg {...p}><path d="m9 5 7 7-7 7" /></Svg>;
export const ChevronLeft = (p) => <Svg {...p}><path d="m15 5-7 7 7 7" /></Svg>;
export const ArrowLeft = (p) => <Svg {...p}><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></Svg>;
export const ArrowRight = (p) => <Svg {...p}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></Svg>;
export const ArrowUpRight = (p) => <Svg {...p}><path d="M7 17 17 7" /><path d="M8 7h9v9" /></Svg>;
export const Clock = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></Svg>;
export const Check = (p) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7" /></Svg>;
export const CheckCircle = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m8 12.5 3 3 5-6" /></Svg>;
export const Alert = (p) => <Svg {...p}><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5" /><path d="M12 17.2h.01" /></Svg>;
export const Info = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 7.8h.01" /></Svg>;
export const Sparkles = (p) => <Svg {...p}><path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z" /><path d="M18.5 16.5 19.2 19l2.5.7-2.5.7-.7 2.5-.7-2.5-2.5-.7 2.5-.7.7-2.5Z" /></Svg>;
export const Plus = (p) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const Search = (p) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></Svg>;
export const Settings = (p) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.7 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.7h.08A1.7 1.7 0 0 0 10.1 3.14V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.3 9v.08a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" /></Svg>;
export const Lock = (p) => <Svg {...p}><rect x="4.5" y="10" width="15" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Svg>;
export const Mail = (p) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></Svg>;
export const Shield = (p) => <Svg {...p}><path d="M12 3 20 6v6c0 4.5-3.2 7.6-8 9-4.8-1.4-8-4.5-8-9V6l8-3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></Svg>;
export const Target = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /></Svg>;
export const Flame = (p) => <Svg {...p}><path d="M12 3s5 4.5 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 1.5 0 2-1.5 2-3 0-1.5-1-3-1-4.5Z" /></Svg>;
export const Refresh = (p) => <Svg {...p}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></Svg>;
export const Inbox = (p) => <Svg {...p}><path d="M4 6h16v12H4z" /><path d="M4 13h4l2 3h4l2-3h4" /></Svg>;
export const Compass = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></Svg>;
export const Graduation = (p) => <Svg {...p}><path d="M2.5 9 12 4.5 21.5 9 12 13.5 2.5 9Z" /><path d="M6 11v4.5c0 1.5 2.7 3 6 3s6-1.5 6-3V11" /><path d="M21.5 9v5" /></Svg>;
export const Timer = (p) => <Svg {...p}><circle cx="12" cy="13" r="8" /><path d="M12 13V9M9 2h6M12 2v3" /></Svg>;
export const ListChecks = (p) => <Svg {...p}><path d="M4 6h2v2H4zM9 7h11M4 11h2v2H4zM9 12h11M4 16h2v2H4zM9 17h11" /></Svg>;
export const External = (p) => <Svg {...p}><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></Svg>;
export const Sun = (p) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>;
export const Moon = (p) => <Svg {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></Svg>;
