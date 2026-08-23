type SignalSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<SignalSize, string> = {
  sm: "h-5 w-5",
  md: "h-9 w-9",
  lg: "h-16 w-16",
};

/** Shared, background-free Nexo brand mark for assistant and product-owned UI locations. */
export function Signal({ size = "md", className = "" }: { size?: SignalSize; className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className={`${SIZE_CLASS[size]} shrink-0 overflow-visible ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="nexo-mark-gradient" x1="22" y1="28" x2="100" y2="92" gradientUnits="userSpaceOnUse">
          <stop stopColor="#174FFF" />
          <stop offset="0.52" stopColor="#11A8FF" />
          <stop offset="1" stopColor="#55F1FF" />
        </linearGradient>
      </defs>
      <path
        d="M21 60C33 37 47 37 60 60C73 83 87 83 99 60C87 37 73 37 60 60C47 83 33 83 21 60"
        stroke="url(#nexo-mark-gradient)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 60C33 37 47 37 60 60C73 83 87 83 99 60C87 37 73 37 60 60C47 83 33 83 21 60"
        stroke="#B8FAFF"
        strokeOpacity="0.5"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
