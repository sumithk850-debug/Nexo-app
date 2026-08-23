type SignalSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<SignalSize, string> = {
  sm: "h-5 w-5",
  md: "h-9 w-9",
  lg: "h-16 w-16",
};

/**
 * Shared Nexo identity mark. Replacing this component keeps the splash screen,
 * assistant chat marker, and other Nexo-owned brand locations consistent without
 * altering any surrounding interactions or loading behavior.
 */
export function Signal({ size = "md", className = "" }: { size?: SignalSize; className?: string }) {
  return (
    <img
      src="/nexo-integration-logo.png"
      alt=""
      aria-hidden="true"
      className={`${SIZE_CLASS[size]} shrink-0 object-contain ${className}`}
    />
  );
}
