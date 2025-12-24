/**
 * Custom fetch wrapper with configurable timeout and better error handling
 */
export function createFetchWithTimeout(
  timeoutMs: number = 30000,
  connectTimeoutMs: number = 10000,
): typeof fetch {
  return async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Use node-fetch if available, otherwise use global fetch
      const fetchImpl = typeof fetch !== 'undefined' ? fetch : await import('node-fetch').then((m) => m.default);

      const response = await fetchImpl(url, {
        ...init,
        signal: controller.signal,
        // Add timeout options for better connection handling
        // @ts-expect-error - These are node-fetch specific options
        timeout: connectTimeoutMs,
      } as RequestInit);

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Improve error messages for network issues
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          throw new Error(
            `Request timeout after ${timeoutMs}ms: ${typeof url === 'string' ? url : url.toString()}`,
          );
        }
        if (error.message.includes('EAI_AGAIN') || error.message.includes('getaddrinfo')) {
          throw new Error(
            `DNS resolution failed for ${typeof url === 'string' ? url : url.toString()}. Check network connectivity.`,
          );
        }
        if (error.message.includes('ECONNREFUSED') || error.message.includes('Connect Timeout')) {
          throw new Error(
            `Connection refused or timed out for ${typeof url === 'string' ? url : url.toString()}. The server may be unreachable.`,
          );
        }
      }
      
      throw error;
    }
  };
}

