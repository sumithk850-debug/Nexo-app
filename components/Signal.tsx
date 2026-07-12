export function Signal({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const heights =
    size === "lg"
      ? ["h-6", "h-10", "h-14", "h-8", "h-5"]
      : size === "sm"
      ? ["h-2", "h-3", "h-4", "h-3", "h-2"]
      : ["h-3", "h-5", "h-7", "h-4", "h-3"];

  return (
    <span className="signal-bars" aria-hidden="true">
      {heights.map((h, i) => (
        <span key={i} className={h} />
      ))}
    </span>
  );
}
