export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center bg-void">
      <div className="signal-bars" aria-hidden="true">
        <span className="h-6" />
        <span className="h-10" />
        <span className="h-14" />
        <span className="h-8" />
        <span className="h-5" />
      </div>
    </div>
  );
}
