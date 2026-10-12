export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="max-w-3xl">
      <div className="h-4 w-28 rounded bg-line pulse" />
      <div className="mt-3 h-10 w-2/3 rounded bg-line pulse" />
      <div className="mt-6 h-40 rounded-2xl bg-line pulse" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
