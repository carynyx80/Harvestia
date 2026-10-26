'use client';
import { useEffect } from 'react';
import { startSync } from '@/lib/sync';

/** Connects the farm to the server and keeps it running on the client. */
export function FarmRuntime() {
  useEffect(() => startSync(), []);
  return null;
}
