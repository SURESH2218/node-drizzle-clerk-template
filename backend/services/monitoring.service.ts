import { performance } from "perf_hooks";
import * as redisService from "./redis.service";

// Constants for monitoring
const SLOW_QUERY_THRESHOLD = 500; // ms
const HIGH_MEMORY_THRESHOLD = 0.8; // 80% of max memory
const METRICS_EXPIRY = 60 * 60 * 24; // 24 hours

interface PerformanceMetrics {
  feedGenerationTime: number;
  cacheHitRate: number;
  averageResponseTime: number;
  errorRate: number;
}

// In-memory metrics storage
let metricsStore = new Map<string, number[]>();

// Helper function to get average metric
const getAverageMetric = (operation: string): number => {
  const metrics = metricsStore.get(operation);
  if (!metrics || metrics.length === 0) return 0;
  return metrics.reduce((a, b) => a + b, 0) / metrics.length;
};

// Helper function to calculate error rate
const calculateErrorRate = async (): Promise<number> => {
  const [errors, total] = await Promise.all([
    redisService.getMetric("error_total"),
    redisService.getMetric("requests_total"),
  ]);
  return total > 0 ? errors / total : 0;
};

// Helper function to persist metrics
const persistMetrics = async (
  operation: string,
  duration: number
): Promise<void> => {
  await redisService.storeMetric(
    `metrics:${operation}`,
    duration,
    METRICS_EXPIRY
  );
};

// Track operation timing
export const trackOperation = async (
  operation: string,
  startTime: number
): Promise<void> => {
  const duration = performance.now() - startTime;

  if (!metricsStore.has(operation)) {
    metricsStore.set(operation, []);
  }
  metricsStore.get(operation)!.push(duration);

  // Log slow operations
  if (duration > SLOW_QUERY_THRESHOLD) {
    console.warn(`Slow operation detected: ${operation} took ${duration}ms`);
  }

  // Store metrics in Redis for persistence
  await persistMetrics(operation, duration);
};

// Track cache performance
export const trackCacheHit = async (hit: boolean): Promise<void> => {
  const key = hit ? "cache_hits" : "cache_misses";
  await redisService.incrMetric(key);
};

// Track error rates
export const trackError = async (type: string): Promise<void> => {
  await redisService.incrMetric(`error_${type}`);
};

// Get current performance metrics
export const getMetrics = async (): Promise<PerformanceMetrics> => {
  const [hits, misses] = await Promise.all([
    redisService.getMetric("cache_hits"),
    redisService.getMetric("cache_misses"),
  ]);

  const totalRequests = hits + misses;
  const cacheHitRate = totalRequests > 0 ? hits / totalRequests : 0;

  return {
    feedGenerationTime: getAverageMetric("feed_generation"),
    cacheHitRate,
    averageResponseTime: getAverageMetric("response_time"),
    errorRate: await calculateErrorRate(),
  };
};

// Clear old metrics
export const cleanup = async (): Promise<void> => {
  metricsStore.clear();
  await redisService.cleanupMetrics();
};

// Middleware for tracking request performance
export const trackRequestPerformance = async (
  operation: string,
  callback: () => Promise<any>
): Promise<any> => {
  const startTime = performance.now();
  try {
    const result = await callback();
    await trackOperation(operation, startTime);
    return result;
  } catch (error) {
    await trackError(operation);
    throw error;
  }
};

// Health check function
export const checkSystemHealth = async (): Promise<{
  healthy: boolean;
  metrics: PerformanceMetrics;
}> => {
  try {
    const metrics = await getMetrics();
    const redisHealthy = await redisService.ping();

    const healthy =
      redisHealthy &&
      metrics.errorRate < 0.05 && // Less than 5% error rate
      metrics.cacheHitRate > 0.7; // More than 70% cache hit rate

    return { healthy, metrics };
  } catch (error) {
    console.error("Health check failed:", error);
    return {
      healthy: false,
      metrics: {
        feedGenerationTime: 0,
        cacheHitRate: 0,
        averageResponseTime: 0,
        errorRate: 1,
      },
    };
  }
};
