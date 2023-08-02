import { retry } from '../src';

type Response = {
  statusCode: number;
  message: string;
  data?: {
    name: string;
    age: number;
    address: string
  },
  error?: {
    statusCode: number;
    message: string
  }
}

// retryable async function
function retryable<T>(payload: T) {
  return function exec(): Promise<T> {
    return new Promise(resolve => {
      resolve(payload);
    })
  }
}

describe('::test::', () => {
  jest.useFakeTimers();
  jest.spyOn(global, 'setTimeout');

  describe('testing retry function for success', () => {

    test('should not retry if first attempt was successful', () => {
      let _retryCount = -1

      function predicate(response: Response, retryCount: number): boolean {
        _retryCount = retryCount
        return (response.statusCode == 200)
      }

      const userPayload = {
        statusCode: 200,
        message: 'request completed successully.',
        data: {
          name: 'meeky',
          age: 150,
          address: 'earth'
        }
      }

      retry(retryable<Response>(userPayload), predicate).then(result => {
        expect(_retryCount).toEqual(0)
        expect(result.statusCode).toEqual(200)
      })
    })

    test('should stop retrying when databse connects on third try', () => {
      type DatabasePayload = { message: string }

      let _retryCount = -1
      const databaseConnectionPayload = {
        message: 'database connection failed.'
      }

      function predicate(response: DatabasePayload, retryCount: number) {
        _retryCount = retryCount
        // simulate database connection failure and success after sometime
        if (_retryCount == 3) {
          databaseConnectionPayload.message = 'database connected successfully.'
        }

        return (response.message.includes('successfully'))
      }

      retry(retryable<DatabasePayload>(databaseConnectionPayload), predicate, { maxRetries: 5 }).then(result => {
        expect(_retryCount).toEqual(3)
        expect(result.message).toEqual('database connected successfully.')
      })
    }, 5000)

    test('should not backoff exponentially if backoff retry is disabled', () => {

      let _retryCount = -1

      function predicate(response: Response, retryCount: number): boolean {
        _retryCount = retryCount
        return (response.statusCode == 200)
      }

      const userPayload = {
        statusCode: 401,
        message: 'request completed successully.',
        error: {
          statusCode: 401,
          message: 'Unauthorized request',
        }
      }

      retry(retryable<Response>(userPayload), predicate, { backoff: false, maxRetries: 5 }).then(result => {
        expect(_retryCount).toEqual(5)
        expect(result.statusCode).toEqual(401)
      })
    })
  })

  describe('testing retry function for error', () => {
    test('should abort retry if service is unavailable or other unresolved server error', async () => {
      const ERROR_CODES = [503, 508]
      const serviceUnavailable = {
        statusCode: 503,
        message: 'Service unavailable.',
        error: {
          statusCode: 503,
          message: 'Service unavailable.'
        }
      }

      let _retryCount = -1
      function predicate(response: Response, retryCount: number): boolean {
        _retryCount = retryCount
        return (ERROR_CODES.indexOf(response.statusCode) > -1)
      }

      const result = await retry<Response>(retryable(serviceUnavailable), predicate, { backoff: false, maxRetries: 5 })

      expect(_retryCount).toEqual(0)
      expect(setTimeout).toHaveBeenCalledTimes(2)
      expect(result.statusCode).toEqual(503)
    })
  })
})
