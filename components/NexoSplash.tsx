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
              <stop stopColor="#195BFF" />
              <stop offset="0.5" stopColor="#0FA9FF" />
              <stop offset="1" stopColor="#54F1FF" />
            </linearGradient>
            <linearGradient id="kyvorix-splash-ring" x1="37" y1="200" x2="204" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#184EFF" />
              <stop offset="1" stopColor="#4EE9FF" />
            </linearGradient>
          </defs>

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
            stroke="#B5FAFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </main>
  );
}
