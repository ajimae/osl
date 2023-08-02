# @ajimae/retry

## Overview
A simple, easy-to-use and zero-dependency javascript async retry package.

## Getting Started
```bash
$ yarn add @ajimae/retry
```
or using npm
```bash
$ npm install @ajimae/retry
```

## Usage
Basic usage example

```ts
// import the package
import { retry } from '@ajimae/retry';

// create the retry wrapper
function retryFn() {
  return new Promise((resolve) => {
    // simulate a network call that takes 1.5 seconds
    setTimeout(() => {
      resolve({
        statusCode: 200,
        message: 'success',
        data: {
          name: 'meeky',
          age: 150
        }
      })
    }, 1500);
  });
};

// create a predicate function
function predicate(response, retryCount) {
  /**
   * access the retry count using the `retryCount` param
   * once the condition or conditions specified in this
   * predicate function is met, the retry exits
   */
  return (response.statusCode == 200);
}

(async function main() {
  const result = await retry(exec, predicate, { maxRetries: 5 })
})

```

### Package API

**Retry function**

The package exposes a `retry` function which is a simple function that takes in three (3) arguments and returns a generic promise.

```ts
// exposed retry function
function retry<T>(
  fn: () => Promise<T>,
  predicate: (response: T, retryCount: number, ...args: Array<unknown>) => boolean,
  retryPolicy?: Partial<RetryPolicy>
): Promise<T>;
```

**The retry function arguments**

**execute**
- A function (usually an (anonymous) async function) that returns a promise-like value.
```ts
async function execute(): Promise<T> {
  return T
}
```

**predicate**
- A predicate (function) takes in the response (the result from the `execute` function) as the first argument, a `retryCount` as the second argument and returns a boolean.

```ts
function predicate(response: T, retryCount: number, ...args: Array<unknown>): boolean {
  return true | false
}
```

**retryPolicy**
- An object that defines how the retry should be performed.

```ts
import { RetryPolicy } from '@ajimae/retry'

const retryPolicy: Omit<RetryPolicy, 'retryCount'> = {
  maxRetries: number;
  backoff: boolean;
  retryDelay: number;
  maxDelay: number;
}
```
**Note:**
The package also exposes the typescript type `RetryPolicy`

```ts
import { retry, RetryPolicy } from '@ajimae/retry'
```

## Author
Chukwuemeka Ajima - [@ajimae](https://github.com/ajimae)

## License
This project is licensed under the **MIT License**.

See [LICENSE](https://github.com/ajimae/osl/blob/HEAD/LICENSE) for more information.
