/**
 * Efficient caching strategies for media assets and API responses
 * Implements requirement 2.3 for optimized loading times
 */

// Cache configuration
export interface CacheConfig {
  maxAge: number; // in milliseconds
  maxSize: number; // maximum number of entries
  staleWhileRevalidate?: boolean;
}

// Cache entry structure
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  etag?: string;
}

/**
 * In-memory cache with LRU eviction
 */
export class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder = new Map<string, number>();
  private accessCounter = 0;
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  set(key: string, data: T, etag?: string): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + this.config.maxAge,
      etag,
    };

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, entry);
    this.accessOrder.set(key, ++this.accessCounter);
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    
    // Check if entry is expired
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return null;
    }

    // Update access order
    this.accessOrder.set(key, ++this.accessCounter);
    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    this.accessOrder.delete(key);
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestAccess = Infinity;

    for (const [key, accessTime] of this.accessOrder) {
      if (accessTime < oldestAccess) {
        oldestAccess = accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
    }
  }

  // Get cache statistics
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: this.accessCounter > 0 ? this.cache.size / this.accessCounter : 0,
    };
  }
}

/**
 * Browser storage cache (localStorage/sessionStorage)
 */
export class BrowserStorageCache<T> {
  private storage: Storage;
  private prefix: string;
  private config: CacheConfig;

  constructor(
    storage: Storage,
    prefix: string,
    config: CacheConfig
  ) {
    this.storage = storage;
    this.prefix = prefix;
    this.config = config;
  }

  set(key: string, data: T): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.config.maxAge,
      };

      this.storage.setItem(
        `${this.prefix}:${key}`,
        JSON.stringify(entry)
      );
    } catch (error) {
      // Handle storage quota exceeded
      console.warn('Storage cache set failed:', error);
      this.cleanup();
    }
  }

  get(key: string): T | null {
    try {
      const item = this.storage.getItem(`${this.prefix}:${key}`);
      if (!item) return null;

      const entry: CacheEntry<T> = JSON.parse(item);
      const now = Date.now();

      if (now > entry.expiresAt) {
        this.storage.removeItem(`${this.prefix}:${key}`);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.warn('Storage cache get failed:', error);
      return null;
    }
  }

  delete(key: string): void {
    this.storage.removeItem(`${this.prefix}:${key}`);
  }

  clear(): void {
    const keys = Object.keys(this.storage);
    keys.forEach(key => {
      if (key.startsWith(`${this.prefix}:`)) {
        this.storage.removeItem(key);
      }
    });
  }

  private cleanup(): void {
    const keys = Object.keys(this.storage);
    const entries: Array<{ key: string; timestamp: number }> = [];

    keys.forEach(key => {
      if (key.startsWith(`${this.prefix}:`)) {
        try {
          const item = this.storage.getItem(key);
          if (item) {
            const entry = JSON.parse(item);
            entries.push({ key, timestamp: entry.timestamp });
          }
        } catch (error) {
          // Remove corrupted entries
          this.storage.removeItem(key);
        }
      }
    });

    // Sort by timestamp and remove oldest entries
    entries.sort((a, b) => a.timestamp - b.timestamp);
    const toRemove = Math.ceil(entries.length * 0.3); // Remove 30% of entries

    for (let i = 0; i < toRemove; i++) {
      this.storage.removeItem(entries[i].key);
    }
  }
}

/**
 * API response cache with stale-while-revalidate support
 */
export class ApiCache {
  private memoryCache: MemoryCache<any>;
  private storageCache: BrowserStorageCache<any> | null = null;

  constructor() {
    this.memoryCache = new MemoryCache({
      maxAge: 5 * 60 * 1000, // 5 minutes
      maxSize: 100,
      staleWhileRevalidate: true,
    });

    if (typeof window !== 'undefined') {
      this.storageCache = new BrowserStorageCache(
        localStorage,
        'api-cache',
        {
          maxAge: 30 * 60 * 1000, // 30 minutes
          maxSize: 50,
        }
      );
    }
  }

  async get<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: { useStorage?: boolean; maxAge?: number } = {}
  ): Promise<T> {
    // Try memory cache first
    let cached = this.memoryCache.get(key);
    if (cached) return cached;

    // Try storage cache if enabled
    if (options.useStorage && this.storageCache) {
      cached = this.storageCache.get(key);
      if (cached) {
        // Also store in memory cache for faster access
        this.memoryCache.set(key, cached);
        return cached;
      }
    }

    // Fetch fresh data
    const data = await fetchFn();
    
    // Cache the result
    this.memoryCache.set(key, data);
    if (options.useStorage && this.storageCache) {
      this.storageCache.set(key, data);
    }

    return data;
  }

  invalidate(key: string): void {
    this.memoryCache.delete(key);
    if (this.storageCache) {
      this.storageCache.delete(key);
    }
  }

  clear(): void {
    this.memoryCache.clear();
    if (this.storageCache) {
      this.storageCache.clear();
    }
  }
}

/**
 * Media asset cache for images and videos
 */
export class MediaCache {
  private cache = new Map<string, Blob>();
  private loadingPromises = new Map<string, Promise<Blob>>();
  private maxSize: number;

  constructor(maxSize = 50 * 1024 * 1024) { // 50MB default
    this.maxSize = maxSize;
  }

  async get(url: string): Promise<Blob | null> {
    // Return cached blob if available
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }

    // Return existing loading promise if in progress
    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }

    // Start loading the media
    const loadingPromise = this.loadMedia(url);
    this.loadingPromises.set(url, loadingPromise);

    try {
      const blob = await loadingPromise;
      this.cache.set(url, blob);
      this.loadingPromises.delete(url);
      
      // Check cache size and evict if necessary
      this.evictIfNeeded();
      
      return blob;
    } catch (error) {
      this.loadingPromises.delete(url);
      throw error;
    }
  }

  private async loadMedia(url: string): Promise<Blob> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load media: ${response.statusText}`);
    }
    return response.blob();
  }

  private evictIfNeeded(): void {
    let totalSize = 0;
    for (const blob of this.cache.values()) {
      totalSize += blob.size;
    }

    if (totalSize > this.maxSize) {
      // Simple FIFO eviction - remove oldest entries
      const entries = Array.from(this.cache.entries());
      const toRemove = Math.ceil(entries.length * 0.3);
      
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }

  clear(): void {
    this.cache.clear();
    this.loadingPromises.clear();
  }

  getStats() {
    let totalSize = 0;
    for (const blob of this.cache.values()) {
      totalSize += blob.size;
    }

    return {
      entries: this.cache.size,
      totalSize,
      maxSize: this.maxSize,
      utilization: totalSize / this.maxSize,
    };
  }
}

/**
 * Cache manager for coordinating different cache types
 */
export class CacheManager {
  private static instance: CacheManager;
  
  public apiCache: ApiCache;
  public mediaCache: MediaCache;

  private constructor() {
    this.apiCache = new ApiCache();
    this.mediaCache = new MediaCache();
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  clearAll(): void {
    this.apiCache.clear();
    this.mediaCache.clear();
  }

  getStats() {
    return {
      api: 'API cache active',
      media: this.mediaCache.getStats(),
    };
  }
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance();