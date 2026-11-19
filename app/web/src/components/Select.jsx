import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/* Custom select: the native popup can't be styled or animated, so this one is a
   real listbox with its own motion. The menu is portalled so panels (which clip
   with overflow: hidden) and the lesson dialog (top layer) never cut it off. */

const ITEM_H = 42;
const MENU_MAX = 292;

const Chevron = ({ open }) => (
  <svg
    className={'select-chevron' + (open ? ' is-flipped' : '')}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const CheckMark = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export default function Select({
  value,
  onChange,
  options = [],
  disabled = false,
  className = '',
  id,
  name,
  ariaLabel,
  placeholder = 'اختار'
}) {
  const uid = useId().replace(/:/g, '');
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const hostRef = useRef(null);
  const closeTimer = useRef(null);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [rect, setRect] = useState(null);
  const [active, setActive] = useState(0);

  const items = options.map((opt) => ({ value: String(opt.value ?? ''), label: String(opt.label ?? '') }));
  const current = String(value ?? '');
  const selectedIndex = items.findIndex((opt) => opt.value === current);
  const selected = selectedIndex >= 0 ? items[selectedIndex] : null;

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return null;
    const box = el.getBoundingClientRect();
    const menuH = Math.min(items.length * ITEM_H + 12, MENU_MAX);
    const spaceBelow = window.innerHeight - box.bottom;
    const above = spaceBelow < menuH + 12 && box.top > menuH + 12;
    const top = above
      ? Math.max(8, box.top - menuH - 8)
      : Math.min(box.bottom + 8, Math.max(8, window.innerHeight - menuH - 8));
    return { top, left: box.left, width: Math.max(box.width, 168), above };
  }, [items.length]);

  const show = () => {
    if (disabled) return;
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    hostRef.current = triggerRef.current?.closest('dialog') || document.body;
    setRect(measure());
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setClosing(false);
    setOpen(true);
  };

  const hide = () => {
    if (!open) return;
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setClosing(false);
      setOpen(false);
    }, 150);
  };

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (triggerRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      hide();
    };
    const onReflow = () => setRect(measure());
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const el = menuRef.current?.querySelector(`[data-idx="${active}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const commit = (opt) => {
    if (!opt) return;
    if (opt.value !== current) onChange?.(opt.value);
    hide();
  };

  const onKeyDown = (event) => {
    if (disabled) return;
    const { key } = event;

    if (!open) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
        event.preventDefault();
        show();
      }
      return;
    }

    if (key === 'Escape') { event.preventDefault(); hide(); return; }
    if (key === 'Tab') { hide(); return; }
    if (key === 'ArrowDown') { event.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); return; }
    if (key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(i - 1, 0)); return; }
    if (key === 'Home') { event.preventDefault(); setActive(0); return; }
    if (key === 'End') { event.preventDefault(); setActive(items.length - 1); return; }
    if (key === 'Enter' || key === ' ') { event.preventDefault(); commit(items[active]); return; }

    /* type-ahead, RTL-aware: jump to the next option starting with the letter */
    if (key.length === 1) {
      const from = active + 1;
      const hit = [...items.slice(from), ...items.slice(0, from)]
        .find((opt) => opt.label.trim().startsWith(key));
      if (hit) setActive(items.indexOf(hit));
    }
  };

  const listId = `select-${uid}`;

  return (
    <div className={`select ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        className={'select-trigger' + (open ? ' is-open' : '') + (!selected ? ' is-empty' : '')}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? hide() : show())}
        onKeyDown={onKeyDown}
      >
        <span className="select-value">{selected ? selected.label : placeholder}</span>
        <Chevron open={open} />
      </button>
      {name ? <input type="hidden" name={name} value={current} /> : null}

      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={listId}
              role="listbox"
              aria-label={ariaLabel}
              className={'select-menu' + (closing ? ' is-closing' : '') + (rect?.above ? ' drop-up' : '')}
              style={{ top: rect?.top ?? 0, left: rect?.left ?? 0, width: rect?.width }}
            >
              {items.map((opt, i) => (
                <div
                  key={opt.value + '-' + i}
                  id={`${listId}-${i}`}
                  data-idx={i}
                  role="option"
                  aria-selected={opt.value === current}
                  className={
                    'select-option' +
                    (i === active ? ' is-active' : '') +
                    (opt.value === current ? ' is-selected' : '')
                  }
                  style={{ '--i': Math.min(i, 8) }}
                  onPointerDown={(event) => event.preventDefault()}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => commit(opt)}
                >
                  <span>{opt.label}</span>
                  {opt.value === current ? <CheckMark /> : null}
                </div>
              ))}
            </div>,
            hostRef.current || document.body
          )
        : null}
    </div>
  );
}
