import { retry, calcRetryDelay } from "../src"; // Import the retry function

jest.useFakeTimers();

describe("::test::", () => {
  describe("retry function", () => {
    const successResponse = "Success!";
    const failureResponse = "Fail!";

    let mockFn: jest.Mock;
    let predicateFn: jest.Mock;

    beforeEach(() => {
      mockFn = jest.fn();
      predicateFn = jest.fn();
    });

    it("should resolve on the first successful attempt", async () => {
      mockFn.mockResolvedValue(successResponse);
      predicateFn.mockReturnValue(true);

      const result = await retry(mockFn, predicateFn, { backoff: false });

      expect(result).toBe(successResponse);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(predicateFn).toHaveBeenCalledWith(successResponse, 0);
    });

    it("should retry if the predicate returns false", async () => {
      mockFn
        .mockResolvedValueOnce(failureResponse)
        .mockResolvedValueOnce(successResponse);
      predicateFn
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const result = await retry(mockFn, predicateFn, {
        maxRetries: 2,
        retryDelay: 100,
      });

      expect(result).toBe(successResponse);
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(predicateFn).toHaveBeenCalledWith(failureResponse, 0);
      expect(predicateFn).toHaveBeenCalledWith(successResponse, 1);
    });

    it(
      "should stop retrying after maxRetries and return the last response",
      async () => {
        jest.useRealTimers(); // <-- Switch to real timers for this test case

        mockFn.mockResolvedValue(failureResponse);
        predicateFn.mockReturnValue(false);

        const retryPolicy = {
          maxRetries: 3,
          retryDelay: 100, // Each retry has a 100ms delay
        };

        const result = await retry(mockFn, predicateFn, retryPolicy);

        expect(result).toBe(failureResponse);
        expect(mockFn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
        expect(predicateFn).toHaveBeenCalledTimes(4);

        // After the test completes, switch back to fake timers (if needed for other tests)
        jest.useFakeTimers();
      },
      10000,
    );

    it("should calculate the backoff delay properly", async () => {
      mockFn
        .mockResolvedValueOnce(failureResponse)
        .mockResolvedValueOnce(successResponse);
      predicateFn
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const retryPolicy = {
        maxRetries: 2,
        retryDelay: 100,
        backoff: true,
        maxDelay: 500,
      };

      const retryPromise = retry(mockFn, predicateFn, retryPolicy);

      // Fast-forward time to simulate retry delays
      jest.advanceTimersByTime(100); // First attempt (retryDelay)
      jest.advanceTimersByTime(200); // Second attempt (exponential backoff)

      const result = await retryPromise;
      expect(result).toBe(successResponse);
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("should reject if the function throws an error", async () => {
      const error = new Error("Test Error");
      mockFn.mockRejectedValue(error);

      await expect(retry(mockFn, predicateFn)).rejects.toThrow("Test Error");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should respect maxDelay when backoff is true", async () => {
      mockFn
        .mockResolvedValueOnce(failureResponse)
        .mockResolvedValueOnce(successResponse);
      predicateFn
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const retryPolicy = {
        maxRetries: 2,
        retryDelay: 200,
        backoff: true,
        maxDelay: 300,
      };

      const retryPromise = retry(mockFn, predicateFn, retryPolicy);

      // Simulate retry delays
      jest.advanceTimersByTime(200); // First retry (retryDelay)
      jest.advanceTimersByTime(300); // Second retry (maxDelay limit)

      const result = await retryPromise;
      expect(result).toBe(successResponse);
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe("calcRetryDelay", () => {
    // Test when backoff is enabled and retryCount is greater than 0
    it("should calculate delay with exponential backoff when backoff is enabled", () => {
      const retryCount = 3;
      const retryDelay = 100; // Base delay
      const maxDelay = 1000; // Maximum allowed delay
      const maxRetries = Infinity;

      const result = calcRetryDelay({
        retryCount,
        retryDelay,
        backoff: true,
        maxDelay,
        maxRetries
      });

      // Result should be less than or equal to maxDelay
      expect(result).toBeLessThanOrEqual(maxDelay);
      // Should be greater than the base retry delay (due to backoff)
      expect(result).toBeGreaterThan(retryDelay);
    });

    // Test when backoff is enabled but retryCount is 0
    it("should return retryDelay when retryCount is 0 and backoff is enabled", () => {
      const result = calcRetryDelay({
        retryCount: 0,
        retryDelay: 200,
        backoff: true,
        maxDelay: 1000,
        maxRetries: Infinity
      });

      // No backoff applied, should just return retryDelay
      expect(result).toBe(200);
    });

    // Test when backoff is disabled, regardless of retryCount
    it("should return retryDelay when backoff is disabled", () => {
      const result = calcRetryDelay({
        retryCount: 3, // Any value of retryCount
        retryDelay: 300,
        backoff: false, // No backoff
        maxDelay: 1000,
        maxRetries: Infinity
      });

      // When backoff is disabled, it should always return retryDelay
      expect(result).toBe(300);
    });

    // Test when the calculated delay exceeds maxDelay
    it("should not exceed maxDelay when backoff is enabled", () => {
      const result = calcRetryDelay({
        retryCount: 5, // Higher retryCount for large backoff calculation
        retryDelay: 100,
        backoff: true,
        maxDelay: 500, // Limiting maximum delay
        maxRetries: Infinity
      });

      // Delay should never exceed the maxDelay
      expect(result).toBeLessThanOrEqual(500);
    });

    // Edge case: Check when retryDelay is 0 and backoff is enabled
    it("should return 0 when retryDelay is 0, even if backoff is enabled", () => {
      const result = calcRetryDelay({
        retryCount: 3,
        retryDelay: 0,
        backoff: true,
        maxDelay: 1000,
        maxRetries: Infinity
      });

      // Should return 0 regardless of backoff, since retryDelay is 0
      expect(result).toBe(0);
    });

    // Edge case: Check when retryCount is very high, ensuring it respects maxDelay
    it("should respect maxDelay with large retryCount", () => {
      const result = calcRetryDelay({
        retryCount: 10, // Very high retryCount, leading to a large backoff
        retryDelay: 100,
        backoff: true,
        maxDelay: 500, // Max delay limit
        maxRetries: Infinity
      });

      // Delay should never exceed maxDelay, even with high retryCount
      expect(result).toBeLessThanOrEqual(500);
    });

    // Test with backoff enabled and random factor included in the calculation
    it("should include randomness in the backoff calculation", () => {
      const retryCount = 2;
      const retryDelay = 100;
      const maxDelay = 1000;
      const maxRetries = Infinity

      const result1 = calcRetryDelay({
        retryCount,
        retryDelay,
        backoff: true,
        maxDelay,
        maxRetries
      });

      const result2 = calcRetryDelay({
        retryCount,
        retryDelay,
        backoff: true,
        maxDelay,
        maxRetries
      });

      // There should be some randomness, so the results should not always be the same
      expect(result1).not.toBe(result2);
      // Both results should still follow the bounds of the delay calculation
      expect(result1).toBeGreaterThan(retryDelay);
      expect(result2).toBeGreaterThan(retryDelay);
      expect(result1).toBeLessThanOrEqual(maxDelay);
      expect(result2).toBeLessThanOrEqual(maxDelay);
    });
  });
});
