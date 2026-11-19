import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// بعد `vite build --outDir=../..` الموقع بيطلع في جذر الريبو (اللي GitHub Pages
// بيخدم منه). الملف ده بيكمّل الحاجات اللي Pages محتاجها:
//   404.html — نسخة من index.html، عشان أي رابط داخلي (زي /app/planner) يفتح
//              التطبيق بدل صفحة 404 بتاعة GitHub.
//   .nojekyll — يمنع Jekyll من معالجة الملفات (وبيتجاهل أي مجلد بيبدأ بـ _).

const here = fileURLToPath(new URL('.', import.meta.url));
const root = path.resolve(here, '../../..');
const index = path.join(root, 'index.html');

if (!fs.existsSync(index)) {
  console.error('post-pages: ملقاش index.html في جذر الريبو — اتأكد إن vite build اشتغل بـ --outDir=../..');
  process.exit(1);
}

fs.copyFileSync(index, path.join(root, '404.html'));
fs.writeFileSync(path.join(root, '.nojekyll'), '');

// `public/_redirects` بتاعة Netlify؛ مش ليها لازمة في جذر Pages
const redirects = path.join(root, '_redirects');
if (fs.existsSync(redirects)) fs.rmSync(redirects);

console.log('post-pages: 404.html + .nojekyll جاهزين في جذر الريبو');
