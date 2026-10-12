'use client';

import { useEffect, useState } from 'react';
import { loadContacts, type Stored } from './warm';

/** The founder's contacts, read from this browser only. Re-reads when they are loaded or cleared anywhere on the page. */
export function useContacts(): { stored: Stored | null; ready: boolean } {
  const [stored, setStored] = useState<Stored | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const read = () => { setStored(loadContacts()); setReady(true); };
    read();
    window.addEventListener('pp-contacts', read); window.addEventListener('storage', read);
    return () => { window.removeEventListener('pp-contacts', read); window.removeEventListener('storage', read); };
  }, []);
  return { stored, ready };
}
