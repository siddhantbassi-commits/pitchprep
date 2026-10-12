import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-xl p-8 text-center">
      <p className="label">Not found</p>
      <h1 className="mt-1 text-3xl font-semibold">We could not find that page</h1>
      <p className="mt-2 text-muted">The link may be mistyped, or the brief may have been deleted or belong to someone else.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primary">Research an investor</Link>
        <Link href="/briefs" className="btn">Your briefs</Link>
      </div>
    </div>
  );
}
