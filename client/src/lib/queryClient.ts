import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const res = await fetch(queryKey[0] as string, {
          credentials: "include",
        });

        if (!res.ok) {
          const errorText = await res.text();
          // Try to parse as JSON first
          try {
            const errorJson = JSON.parse(errorText);
            throw new Error(errorJson.message || `${res.status}: ${res.statusText}`);
          } catch (e) {
            // If not JSON, use text content but clean up any HTML
            const cleanText = errorText.replace(/<[^>]*>/g, '');
            throw new Error(`${res.status}: ${cleanText.slice(0, 200)}`);
          }
        }

        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return res.json();
        } else {
          throw new Error('Expected JSON response but received: ' + contentType);
        }
      },
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    }
  },
});
