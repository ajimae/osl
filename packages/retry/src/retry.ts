export type RetryPolicy = {
  maxRetries: number;
  backoff: boolean;
  retryDelay: number;
  maxDelay: number;
};

export function calcRetryDelay({
  retryCount,
  retryDelay,
  // maxRetries,
  backoff,
  maxDelay,
}: RetryPolicy & { retryCount: number }): number {
  if (backoff) {
    return retryCount !== 0
      ? Math.min(
        Math.round((Math.random() + 1) * retryDelay * 2 ** retryCount),
        maxDelay,
      )
      : retryDelay;
  }

  return retryDelay;
}

function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve): void => {
    setTimeout(resolve, ms);
  });
}

const retryPolicy_: RetryPolicy = {
  maxDelay: Infinity,
  maxRetries: 3,
  backoff: true,
  retryDelay: 200, // 200 ms
};

export default async function retry<T>(
  fn: () => Promise<T>,
  predicate: (
    response: T,
    retryCount: number,
  ) => boolean,
  retryPolicy?: Partial<RetryPolicy>,
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    try {
      let retryCount = 0;
      let response = await fn();

      // first attempt
      if (predicate(response, retryCount)) {
        return resolve(response);
      }

      const options: RetryPolicy = Object.assign({}, retryPolicy_, retryPolicy);

      // should we wait before starting the retry?
      while (retryCount < options.maxRetries) {
        ++retryCount;
        response = await fn();

        if (predicate(response, retryCount)) {
          return resolve(response);
        }

        // sleep
        await delay(
          calcRetryDelay({
            ...options,
            retryCount,
          }),
        );
      }

      /**
       * at the end of the day
       * resolve unresolved response
       */
      resolve(response);
    } catch (err) {
      reject(err);
    }
  });
}
