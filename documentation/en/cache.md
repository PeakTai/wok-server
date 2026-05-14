# Cache

The cache component provides simple in-memory caching with a random eviction strategy and support for expiration times.

## Environment Variables

| Environment Variable          | Description                                                                 |
| :---------------------------- | :-------------------------------------------------------------------------- |
| CACHE_DEFAULT_EXPIRE_IN_SECONDS | Default expiration time in seconds. Value: 1-3600, default 60             |
| CACHE_STAT_TASK_ENABLED         | Whether to enable statistics task. When enabled, cache statistics are printed at specified intervals for observation |
| CACHE_STAT_INTERVAL             | Statistics task execution interval in seconds. Value: 1-86400              |
| CACHE_CLEANING_INTERVAL         | Expired data cleaning interval in seconds. Value: 1-3600, default 60      |
| CACHE_MAX_ELEMENTS              | Maximum number of elements. Value: 1-NUM.MAX_VALUE, default 1024         |

After enabling cache statistics, statistics will be output to the log at the specified interval.

```
[2023/09/27 11:31:35.690][INFO]Cache statistics,
time window: 2023/09/27 11:31:35.442 - now, hit: 4/4, capacity: 120/100
```

The example above shows statistics including hit rate and capacity usage. In the example, capacity is exceeded, which is normal because the cleaning task hasn't run yet. Statistics are time-windowed and only count within the current cycle.

## Performance Considerations

CACHE_CLEANING_INTERVAL controls the cache cleaning task cycle. If the project has a lot of cached content, this should be set smaller to clean up invalid data promptly.

Excessive cached data affects GC because the garbage collector cannot reclaim cached objects, but the marking and memory compaction work is still costly. In addition to more frequent cleaning, cache records should also have shorter expiration times when possible.

To reduce overhead, the cache component uses a random eviction strategy and does not support configurable eviction strategies.

If large amounts of data need to be cached without affecting GC, consider alternative solutions such as off-heap memory (Buffer) or external cache services (Redis, etc.). In-memory caching is only suitable for caching small amounts of short-term data.

## Examples

You can get the global cache object through the getCache function and use its methods to work with the cache.

```ts
// Get cache object
const cache = getCache()

// Use default expiration time
cache.put('abc', 123)
let value = cache.get('abc') // 123

// Specify expiration time (third parameter, in seconds)
cache.put('d', 2233, 1)
// Remove cache entry
cache.remove('d')
```

The cache object has a computeIfAbsent method that allows you to specify a function to generate cache content. If no cached data exists, it generates and caches it; otherwise, it returns the cached data directly.

```ts
const user = await cache.computeIfAbsent(`get-user-${userId}`, findUserById(userId))
```