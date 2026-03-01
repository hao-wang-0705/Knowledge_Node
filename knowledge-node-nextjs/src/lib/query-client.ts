import { QueryClient } from '@tanstack/react-query';

let queryClientSingleton: QueryClient | null = null;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 1,
      },
    },
  });
}

export function getQueryClient() {
  if (!queryClientSingleton) {
    queryClientSingleton = createQueryClient();
  }
  return queryClientSingleton;
}

export function clearGlobalQueryCache() {
  if (queryClientSingleton) {
    queryClientSingleton.clear();
  }
}
