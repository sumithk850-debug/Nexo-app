export function NexoSplash() {
  return (
    <main
      className="kyvorix-splash relative flex min-h-screen items-center justify-center overflow-hidden bg-void px-5"
      role="status"
      aria-label="Loading"
    >
      <div className="kyvorix-splash-grid absolute inset-0" aria-hidden="true" />
      <div className="kyvorix-splash-orb kyvorix-splash-orb-left absolute" aria-hidden="true" />
      <div className="kyvorix-splash-orb kyvorix-splash-orb-right absolute" aria-hidden="true" />

      <div className="kyvorix-splash-mark relative z-10" aria-hidden="true">
        <svg
          className="kyvorix-splash-logo"
          viewBox="0 0 240 240"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="kyvorix-splash-ribbon" x1="44" y1="58" x2="196" y2="182" gradientUnits="userSpaceOnUse">
              <stop stopColor="#2457FF" />
              <stop offset="0.42" stopColor="#087DFF" />
              <stop offset="0.72" stopColor="#11C8FF" />
              <stop offset="1" stopColor="#7AF7FF" />
            </linearGradient>
            <linearGradient id="kyvorix-splash-ring" x1="37" y1="200" x2="204" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#174BFF" />
              <stop offset="0.52" stopColor="#168CFF" />
              <stop offset="1" stopColor="#54EFFF" />
            </linearGradient>
            <filter id="kyvorix-splash-ribbon-glow" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.04 0 0 0 0 0.55 0 0 0 0 1 0 0 0 .62 0" />
            </filter>
            <filter id="kyvorix-splash-ring-glow" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.04 0 0 0 0 0.42 0 0 0 0 1 0 0 0 .48 0" />
            </filter>
          </defs>

          <circle
            className="kyvorix-splash-ring-glow"
            cx="120"
            cy="120"
            r="93"
            stroke="url(#kyvorix-splash-ring)"
            strokeWidth="7"
            strokeLinecap="round"
            filter="url(#kyvorix-splash-ring-glow)"
          />
          <circle
            className="kyvorix-splash-ring"
            cx="120"
            cy="120"
            r="93"
            stroke="url(#kyvorix-splash-ring)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            className="kyvorix-splash-ribbon-glow"
            d="M48 120C70 77 96 77 120 120C144 163 170 163 192 120C170 77 144 77 120 120C96 163 70 163 48 120"
            stroke="url(#kyvorix-splash-ribbon)"
            strokeWidth="24"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#kyvorix-splash-ribbon-glow)"
          />
          <path
            className="kyvorix-splash-ribbon"
            d="M48 120C70 77 96 77 120 120C144 163 170 163 192 120C170 77 144 77 120 120C96 163 70 163 48 120"
            stroke="url(#kyvorix-splash-ribbon)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="kyvorix-splash-ribbon-highlight"
            d="M48 120C70 77 96 77 120 120C144 163 170 163 192 120C170 77 144 77 120 120C96 163 70 163 48 120"
            stroke="#D4FDFF"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </main>
  );
}
