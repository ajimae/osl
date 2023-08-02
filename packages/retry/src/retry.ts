export type RetryPolicy = {
  retryCount: number,
  maxRetries: number,
  backoff: boolean,
  retryDelay: number,
  maxDelay: number
}

function calcRetryDelay({
  retryCount,
  retryDelay,
  // maxRetries,
  backoff,
  maxDelay
}: RetryPolicy): number {
  if (backoff) {
    return retryCount !== 0
      ? Math.min(
        Math.round((Math.random() + 1) * retryDelay * 2 ** retryCount),
        maxDelay
      ) : retryDelay;
  }

  return retryDelay
}

function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve): void => {
    setTimeout(resolve, ms)
  })
}

const retryPolicy_: Omit<RetryPolicy, 'retryCount'> = {
  maxDelay: Infinity,
  maxRetries: 3,
  backoff: true,
  retryDelay: 200 // 200 ms
}

export default async function retry<T>(
  fn: () => Promise<T>,
  predicate: (response: T, retryCount: number, ...args: Array<unknown>) => boolean,
  retryPolicy?: Partial<RetryPolicy>
): Promise<T> {

  let retryCount = 0;
  let response = await fn();

  if (predicate(response, retryCount)) {
    return response;
  }

  const options = {
    ...retryPolicy_,
    ...retryPolicy
  };

  // should we wait before starting the retry?
  while (retryCount < options.maxRetries) {
    retryCount++;
    response = await fn();

    if (predicate(response, retryCount)) {
      return response;
    }

    // sleep
    await delay(
      calcRetryDelay({
        ...options,
        retryCount
      })
    );
  }

  return response;
}
