'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-xl p-8 text-center" role="alert">
      <p className="label">Something went wrong</p>
      <h1 className="mt-1 text-3xl font-semibold">That did not load</h1>
      <p className="mt-2 text-muted">It is usually a brief connection problem. Nothing you saved has been lost.</p>
      <button className="btn btn-primary mt-6" onClick={reset}>Try again</button>
    </div>
  );
}
