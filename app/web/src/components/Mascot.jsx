/**
 * شخصية «لم المتراكم» — ولد بنظارة ورا كتاب مفتوح.
 *
 * SVG داخلي مش صورة، عشان ياخد لون الخط من `currentColor` ولون الورق من
 * `--mascot-bg` (وبيسقط على `--surface-2`)، يعني بيتظبط مع الثيم والبالِت
 * لوحده من غير نسخة تانية للألوان.
 *
 * mood:
 *  - 'calm' بيرسم/بيكتب وقلمه على الورق
 *  - 'worried' قلمه مركون على الصفحة ووشه قلق
 */

const PAPER = 'var(--mascot-bg, var(--surface-2))';
const LINE = 5.5;

function Book() {
  return (
    <g>
      <g fill={PAPER} stroke="currentColor" strokeWidth={LINE} strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 212C64 200 112 190 148 196V268C112 262 64 268 24 280Z" />
        <path d="M276 212C236 200 188 190 152 196V268C188 262 236 268 276 280Z" />
        <path d="M24 280C64 268 112 262 148 268C184 262 236 268 276 280" />
        <path d="M24 290C64 278 112 272 148 278C184 272 236 278 276 290" />
        <path d="M150 196V268" />
      </g>
      <g fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" opacity=".8">
        <path d="M46 226C66 223 86 222 106 224" />
        <path d="M46 240C66 237 86 236 106 238" />
        <path d="M46 254C66 251 86 250 106 252" />
        <path d="M194 222C214 219 234 220 254 224" />
        <path d="M194 236C214 233 234 234 254 238" />
        <path d="M194 250C210 247 226 248 238 251" />
      </g>
    </g>
  );
}

function Head({ worried }) {
  return (
    <g>
      <g fill="none" stroke="currentColor" strokeWidth={LINE} strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="150" cy="84" rx="40" ry="42" fill={PAPER} />
        <circle cx="133" cy="94" r="14" />
        <circle cx="167" cy="94" r="14" />
        <path d="M147 92H153" />
        <path d="M119 92L109 88" />
        <path d="M181 92L191 88" />
        <path d={worried ? 'M143 118C147 111 153 111 157 118' : 'M143 112C147 117 153 117 157 112'} />
      </g>
      <circle cx="133" cy="96" r="3.8" fill="currentColor" />
      <circle cx="167" cy="96" r="3.8" fill="currentColor" />
      {/* الشعر كتلة واحدة، والغرة بتنزل على أول النضارة */}
      <path d="M108 80C108 34 126 12 150 12C174 12 192 34 192 80C188 86 180 80 172 84C164 88 158 82 150 84C142 86 136 82 128 85C120 88 112 84 108 80Z" fill="currentColor" />
    </g>
  );
}

function Torso() {
  return (
    <g>
      {/* الرقبة مالها خط، فالذقن بينزل على الياقة على طول */}
      <path d="M132 104H168V142H132Z" fill={PAPER} />
      <path
        d="M94 216C90 194 94 170 102 158C109 144 126 132 150 132C174 132 191 144 198 158C206 170 210 194 206 216Z"
        fill={PAPER}
        stroke="currentColor"
        strokeWidth={LINE}
        strokeLinejoin="round"
      />
      {/* ياقة دائرية واسعة + تانية للتضليع */}
      <path d="M126 136C131 154 169 154 174 136" fill="none" stroke="currentColor" strokeWidth={LINE} strokeLinecap="round" />
      <path d="M130 142C135 152 165 152 170 142" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" opacity=".4" />
      {/* خطوط الكتف */}
      <g fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" opacity=".45">
        <path d="M131 152C126 160 123 168 122 176" />
        <path d="M169 152C174 160 177 168 178 176" />
      </g>
      {/* الزرار */}
      <path d="M150 154V220" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="150" cy="170" r="3.2" fill="currentColor" />
      <circle cx="150" cy="184" r="3.2" fill="currentColor" />
      {/* كسرات القماش */}
      <g fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" opacity=".45">
        <path d="M117 178C121 188 123 198 123 208" />
        <path d="M183 178C179 188 177 198 177 208" />
        <path d="M131 208C136 211 143 211 147 208" />
        <path d="M153 208C158 211 164 211 168 208" />
      </g>
    </g>
  );
}

function Hand({ x, y, rotate, pivotX, pivotY, side = 'left' }) {
  const fingers =
    side === 'left'
      ? `M${x + 28} ${y + 6}H${x + 36} M${x + 28} ${y + 13}H${x + 36} M${x + 28} ${y + 20}H${x + 35}`
      : `M${x + 14} ${y + 8}H${x + 5} M${x + 15} ${y + 16}H${x + 4} M${x + 15} ${y + 24}H${x + 6}`;
  return (
    <g transform={`rotate(${rotate} ${pivotX} ${pivotY})`}>
      <rect x={x} y={y} width="38" height="27" rx="11" fill={PAPER} stroke="currentColor" strokeWidth={LINE} />
      <path d={fingers} fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" opacity=".6" />
    </g>
  );
}

export default function Mascot({ mood = 'calm', size = 190, className = '', title }) {
  const worried = mood === 'worried';
  return (
    <svg
      viewBox="0 0 320 300"
      width={size}
      height={Math.round((size * 300) / 320)}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <Torso />
      <Head worried={worried} />
      <Book />
      {worried ? (
        <g>
          {/* قلم مركون على الصفحة */}
          <path d="M104 244L78 232" stroke="var(--accent)" strokeWidth="8.5" strokeLinecap="round" />
          <path d="M68 226L80 224L80 236Z" fill="currentColor" />
          <Hand x={104} y={213} rotate={-10} pivotX={122} pivotY={226} />
          <Hand x={196} y={219} rotate={16} pivotX={214} pivotY={232} side="right" />
          {/* نقطة العرق */}
          <path d="M196 48C196 48 202 58 202 63C202 67 199 69 196 69C193 69 190 67 190 63C190 58 196 48 196 48Z" fill="var(--accent)" />
        </g>
      ) : (
        <g>
          {/* القلم بيمشي في إيده على الورق */}
          <path d="M112 232L86 204" stroke="var(--accent)" strokeWidth="8.5" strokeLinecap="round" />
          <path d="M76 194L88 196L83 208Z" fill="currentColor" />
          <Hand x={104} y={223} rotate={-16} pivotX={122} pivotY={236} />
          <g fill="none" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round">
            <path d="M66 188L60 181" />
            <path d="M62 198L54 196" />
            <path d="M70 178L70 169" />
          </g>
          <Hand x={198} y={220} rotate={20} pivotX={216} pivotY={234} side="right" />
        </g>
      )}
    </svg>
  );
}
