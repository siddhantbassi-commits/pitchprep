'use client';

export default function SearchButton() {
  return (
    <button className="hidden lg:inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-muted hover:text-ink" onClick={() => window.dispatchEvent(new Event('pp:palette'))} aria-label="Open search and jump">
      Search <kbd className="rounded border border-line px-1">⌘K</kbd>
    </button>
  );
}
