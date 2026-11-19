import { Bell, Book, Calendar, Chart, Home, Layers, User } from './components/Icons';

/* Same order and naming as the original site: a flat list, no group titles. */
export const NAV_ITEMS = [
  { to: '/app', label: 'الرئيسية', icon: Home, end: true },
  { to: '/app/subjects', label: 'المواد والمنهج', icon: Book },
  { to: '/app/planner', label: 'مخطط المذاكرة', icon: Calendar },
  { to: '/app/backlog', label: 'إنقاذ المتراكم', icon: Layers },
  { to: '/app/progress', label: 'تقدمي', icon: Chart },
  { to: '/app/notifications', label: 'الإشعارات', icon: Bell },
  { to: '/app/profile', label: 'ملفي الشخصي', icon: User }
];

export const NAV_GROUPS = [{ label: '', items: NAV_ITEMS }];

export const PAGE_META = {
  '/app': { title: 'الرئيسية', sub: 'خطة النهاردة' },
  '/app/backlog': { title: 'إنقاذ المتراكم', sub: 'الدروس اللي مستنية' },
  '/app/planner': { title: 'مخطط المذاكرة', sub: 'توزيع الأيام' },
  '/app/progress': { title: 'تقدمي', sub: 'أرقامك الحقيقية' },
  '/app/subjects': { title: 'المواد والمنهج', sub: 'الفهرس الرسمي' },
  '/app/notifications': { title: 'الإشعارات', sub: 'آخر التحديثات' },
  '/app/profile': { title: 'ملفي الشخصي', sub: 'بياناتك وحسابك' }
};

export function metaFor(path) {
  if (PAGE_META[path]) return PAGE_META[path];
  const found = Object.keys(PAGE_META)
    .filter((p) => p !== '/app' && path.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];
  return (found && PAGE_META[found]) || { title: 'لم المتراكم', sub: '' };
}

export function isActive(path, item) {
  if (item.end) return path === item.to;
  return path === item.to || path.startsWith(item.to + '/');
}
