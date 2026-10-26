import { QueryClient } from '@tanstack/react-query';

/** Shared so live events (e.g. new vault activity) can refresh cached chain data. */
export const queryClient = new QueryClient();
