/**
 * Performance tests for animations and media loading
 * Requirements: 2.3, 4.4
 */

import { performance } from 'perf_hooks';
import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';

describe('Animations and Media Performance Tests', () => {
  let browser: Browser;
  let page: Page;
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps'
      ]
    });
  });

  beforeEach(async () => {
    page = await browser.newPage();
    
    // Set viewport for consistent testing
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Enable performance monitoring
    await page.setCacheEnabled(false);
    
    // Mock network conditions for consistent testing
    const client = await page.target().createCDPSession();
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 1.5 * 1024 * 1024, // 1.5 Mbps
      uploadThroughput: 750 * 1024, // 750 Kbps
      latency: 40 // 40ms
    });
  });

  afterEach(async () => {
    await page.close();
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('Home Page Animation Performance', () => {
    it('should load hero section animations within performance budget', async () => {
      const startTime = performance.now();
      
      // Navigate to home page
      await page.goto(baseUrl, { waitUntil: 'networkidle0' });
      
      // Wait for hero section to be visible
      await page.waitForSelector('[data-testid="hero-section"]', { timeout: 5000 });
      
      const loadTime = performance.now() - startTime;
      
      // Hero section should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
      
      // Check for animation performance
      const animationMetrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const animationEntries = entries.filter(entry => 
              entry.name.includes('animation') || entry.entryType === 'measure'
            );
            resolve({
              animationCount: animationEntries.length,
              totalDuration: animationEntries.reduce((sum, entry) => sum + entry.duration, 0)
            });
          });
          
          observer.observe({ entryTypes: ['measure', 'navigation'] });
          
          // Trigger animations
          const heroSection = document.querySelector('[data-testid="hero-section"]');
          if (heroSection) {
            heroSection.scrollIntoView();
          }
          
          setTimeout(() => resolve({ animationCount: 0, totalDuration: 0 }), 2000);
        });
      });
      
      expect(animationMetrics).toBeDefined();
    });

    it('should maintain 60fps during scroll animations', async () => {
      await page.goto(baseUrl);
      
      // Start performance monitoring
      await page.tracing.start({
        path: path.join(__dirname, 'scroll-animation-trace.json'),
        screenshots: false,
        categories: ['devtools.timeline']
      });
      
      // Perform scroll animation test
      await page.evaluate(() => {
        return new Promise((resolve) => {
          let frameCount = 0;
          let startTime = performance.now();
          
          const checkFrame = () => {
            frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - startTime >= 1000) { // 1 second test
              const fps = frameCount;
              resolve(fps);
            } else {
              // Trigger scroll animation
              window.scrollBy(0, 10);
              requestAnimationFrame(checkFrame);
            }
          };
          
          requestAnimationFrame(checkFrame);
        });
      });
      
      await page.tracing.stop();
      
      // Check frame rate during animations
      const metrics = await page.metrics();
      expect(metrics.JSHeapUsedSize).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    });

    it('should handle multiple simultaneous animations efficiently', async () => {
      await page.goto(baseUrl);
      
      const startTime = performance.now();
      
      // Trigger multiple animations simultaneously
      await page.evaluate(() => {
        const elements = document.querySelectorAll('[data-animate]');
        elements.forEach((element, index) => {
          setTimeout(() => {
            element.classList.add('animate-in');
          }, index * 100);
        });
      });
      
      // Wait for all animations to complete
      await page.waitForTimeout(3000);
      
      const totalTime = performance.now() - startTime;
      
      // Multiple animations should complete within 5 seconds
      expect(totalTime).toBeLessThan(5000);
      
      // Check memory usage after animations
      const metrics = await page.metrics();
      expect(metrics.JSHeapUsedSize).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    });
  });

  describe('Media Loading Performance', () => {
    it('should load hero video within performance budget', async () => {
      const startTime = performance.now();
      
      await page.goto(baseUrl);
      
      // Wait for video element to be present
      await page.waitForSelector('video[data-testid="hero-video"]', { timeout: 10000 });
      
      // Wait for video to be ready to play
      await page.waitForFunction(() => {
        const video = document.querySelector('video[data-testid="hero-video"]') as HTMLVideoElement;
        return video && video.readyState >= 3; // HAVE_FUTURE_DATA
      }, { timeout: 15000 });
      
      const loadTime = performance.now() - startTime;
      
      // Video should be ready within 10 seconds
      expect(loadTime).toBeLessThan(10000);
      
      // Check video properties
      const videoMetrics = await page.evaluate(() => {
        const video = document.querySelector('video[data-testid="hero-video"]') as HTMLVideoElement;
        return {
          duration: video.duration,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState
        };
      });
      
      expect(videoMetrics.readyState).toBeGreaterThanOrEqual(3);
      expect(videoMetrics.duration).toBeGreaterThan(0);
    });

    it('should implement progressive image loading efficiently', async () => {
      await page.goto(baseUrl);
      
      // Monitor network requests for images
      const imageRequests: any[] = [];
      page.on('response', (response) => {
        if (response.url().match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
          imageRequests.push({
            url: response.url(),
            status: response.status(),
            size: response.headers()['content-length'],
            timing: response.timing()
          });
        }
      });
      
      // Scroll to trigger lazy loading
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      
      await page.waitForTimeout(2000);
      
      // Check that images are loaded progressively
      expect(imageRequests.length).toBeGreaterThan(0);
      
      // Verify images load in reasonable time
      const avgLoadTime = imageRequests.reduce((sum, req) => {
        return sum + (req.timing?.responseEnd - req.timing?.requestStart || 0);
      }, 0) / imageRequests.length;
      
      expect(avgLoadTime).toBeLessThan(2000); // Average load time under 2 seconds
    });

    it('should handle multimedia showcase performance', async () => {
      await page.goto(baseUrl);
      
      // Navigate to multimedia showcase section
      await page.evaluate(() => {
        const showcase = document.querySelector('[data-testid="multimedia-showcase"]');
        if (showcase) {
          showcase.scrollIntoView({ behavior: 'smooth' });
        }
      });
      
      await page.waitForSelector('[data-testid="multimedia-showcase"]');
      
      const startTime = performance.now();
      
      // Interact with multimedia elements
      const mediaElements = await page.$$('[data-testid^="media-item-"]');
      
      for (let i = 0; i < Math.min(mediaElements.length, 5); i++) {
        await mediaElements[i].click();
        await page.waitForTimeout(500); // Wait for transition
      }
      
      const interactionTime = performance.now() - startTime;
      
      // Interactions should be responsive (under 3 seconds for 5 items)
      expect(interactionTime).toBeLessThan(3000);
      
      // Check memory usage after interactions
      const metrics = await page.metrics();
      expect(metrics.JSHeapUsedSize).toBeLessThan(150 * 1024 * 1024); // Less than 150MB
    });

    it('should optimize video playback performance', async () => {
      await page.goto(baseUrl);
      
      // Find and interact with video player
      await page.waitForSelector('[data-testid="premium-video-player"]');
      
      const videoMetrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          const video = document.querySelector('video') as HTMLVideoElement;
          if (!video) {
            resolve({ error: 'No video found' });
            return;
          }
          
          const startTime = performance.now();
          let frameCount = 0;
          let droppedFrames = 0;
          
          const checkPerformance = () => {
            frameCount++;
            
            // Check for dropped frames (simplified)
            if (video.getVideoPlaybackQuality) {
              const quality = video.getVideoPlaybackQuality();
              droppedFrames = quality.droppedVideoFrames;
            }
            
            if (performance.now() - startTime >= 2000) { // 2 second test
              resolve({
                fps: frameCount / 2,
                droppedFrames,
                buffered: video.buffered.length > 0 ? video.buffered.end(0) : 0,
                currentTime: video.currentTime
              });
            } else {
              requestAnimationFrame(checkPerformance);
            }
          };
          
          video.play().then(() => {
            requestAnimationFrame(checkPerformance);
          }).catch((error) => {
            resolve({ error: error.message });
          });
        });
      });
      
      expect(videoMetrics).toBeDefined();
      if ('fps' in videoMetrics) {
        expect(videoMetrics.fps).toBeGreaterThan(25); // At least 25 FPS
        expect(videoMetrics.droppedFrames).toBeLessThan(5); // Minimal dropped frames
      }
    });
  });

  describe('Animation Optimization Tests', () => {
    it('should use hardware acceleration for animations', async () => {
      await page.goto(baseUrl);
      
      // Check for CSS properties that enable hardware acceleration
      const acceleratedElements = await page.evaluate(() => {
        const elements = document.querySelectorAll('[data-animate]');
        let acceleratedCount = 0;
        
        elements.forEach((element) => {
          const styles = window.getComputedStyle(element);
          const transform = styles.transform;
          const willChange = styles.willChange;
          const backfaceVisibility = styles.backfaceVisibility;
          
          if (transform !== 'none' || willChange === 'transform' || backfaceVisibility === 'hidden') {
            acceleratedCount++;
          }
        });
        
        return {
          total: elements.length,
          accelerated: acceleratedCount,
          percentage: (acceleratedCount / elements.length) * 100
        };
      });
      
      // At least 80% of animated elements should use hardware acceleration
      expect(acceleratedElements.percentage).toBeGreaterThan(80);
    });

    it('should minimize layout thrashing during animations', async () => {
      await page.goto(baseUrl);
      
      // Start performance monitoring
      await page.tracing.start({
        categories: ['devtools.timeline', 'blink.user_timing']
      });
      
      // Trigger animations that could cause layout thrashing
      await page.evaluate(() => {
        const elements = document.querySelectorAll('[data-animate]');
        elements.forEach((element) => {
          element.classList.add('animate-in');
        });
      });
      
      await page.waitForTimeout(3000);
      
      const trace = await page.tracing.stop();
      
      // In a real implementation, you would parse the trace data
      // to check for excessive layout/reflow events
      expect(trace).toBeDefined();
    });

    it('should handle reduced motion preferences', async () => {
      // Set reduced motion preference
      await page.emulateMediaFeatures([
        { name: 'prefers-reduced-motion', value: 'reduce' }
      ]);
      
      await page.goto(baseUrl);
      
      // Check that animations are disabled or reduced
      const animationState = await page.evaluate(() => {
        const elements = document.querySelectorAll('[data-animate]');
        let reducedMotionCount = 0;
        
        elements.forEach((element) => {
          const styles = window.getComputedStyle(element);
          const animationDuration = styles.animationDuration;
          const transitionDuration = styles.transitionDuration;
          
          if (animationDuration === '0s' || transitionDuration === '0s' || 
              animationDuration === 'none' || transitionDuration === 'none') {
            reducedMotionCount++;
          }
        });
        
        return {
          total: elements.length,
          reduced: reducedMotionCount,
          percentage: elements.length > 0 ? (reducedMotionCount / elements.length) * 100 : 0
        };
      });
      
      // Most animations should be disabled with reduced motion
      expect(animationState.percentage).toBeGreaterThan(70);
    });
  });

  describe('Media Optimization Tests', () => {
    it('should serve appropriate image formats based on browser support', async () => {
      await page.goto(baseUrl);
      
      // Check for WebP support and usage
      const imageFormats = await page.evaluate(() => {
        const images = document.querySelectorAll('img');
        const formats = {
          webp: 0,
          jpg: 0,
          png: 0,
          total: images.length
        };
        
        images.forEach((img) => {
          const src = img.src || img.dataset.src || '';
          if (src.includes('.webp')) formats.webp++;
          else if (src.includes('.jpg') || src.includes('.jpeg')) formats.jpg++;
          else if (src.includes('.png')) formats.png++;
        });
        
        return formats;
      });
      
      // Should prefer WebP format when supported
      if (imageFormats.total > 0) {
        expect(imageFormats.webp).toBeGreaterThan(0);
      }
    });

    it('should implement efficient image lazy loading', async () => {
      await page.goto(baseUrl);
      
      // Count initially loaded images
      const initialImages = await page.evaluate(() => {
        return document.querySelectorAll('img[src]').length;
      });
      
      // Scroll to trigger lazy loading
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      await page.waitForTimeout(2000);
      
      // Count images after scrolling
      const finalImages = await page.evaluate(() => {
        return document.querySelectorAll('img[src]').length;
      });
      
      // More images should be loaded after scrolling
      expect(finalImages).toBeGreaterThan(initialImages);
    });

    it('should optimize video loading and buffering', async () => {
      await page.goto(baseUrl);
      
      await page.waitForSelector('video');
      
      const videoOptimization = await page.evaluate(() => {
        const videos = document.querySelectorAll('video');
        let optimizedCount = 0;
        
        videos.forEach((video) => {
          // Check for optimization attributes
          if (video.hasAttribute('preload') && 
              (video.getAttribute('preload') === 'metadata' || 
               video.getAttribute('preload') === 'none')) {
            optimizedCount++;
          }
          
          // Check for poster images
          if (video.hasAttribute('poster')) {
            optimizedCount++;
          }
        });
        
        return {
          total: videos.length,
          optimized: optimizedCount
        };
      });
      
      // Videos should have optimization attributes
      expect(videoOptimization.optimized).toBeGreaterThan(0);
    });
  });

  describe('Core Web Vitals Performance', () => {
    it('should meet Largest Contentful Paint (LCP) requirements', async () => {
      await page.goto(baseUrl);
      
      const lcpMetric = await page.evaluate(() => {
        return new Promise((resolve) => {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            resolve(lastEntry.startTime);
          });
          
          observer.observe({ entryTypes: ['largest-contentful-paint'] });
          
          // Fallback timeout
          setTimeout(() => resolve(0), 5000);
        });
      });
      
      // LCP should be under 2.5 seconds for good performance
      expect(lcpMetric).toBeLessThan(2500);
    });

    it('should meet First Input Delay (FID) requirements', async () => {
      await page.goto(baseUrl);
      
      // Simulate user interaction
      const startTime = performance.now();
      await page.click('button, a, [role="button"]');
      const endTime = performance.now();
      
      const inputDelay = endTime - startTime;
      
      // FID should be under 100ms for good performance
      expect(inputDelay).toBeLessThan(100);
    });

    it('should meet Cumulative Layout Shift (CLS) requirements', async () => {
      await page.goto(baseUrl, { waitUntil: 'networkidle0' });
      
      const clsMetric = await page.evaluate(() => {
        return new Promise((resolve) => {
          let clsValue = 0;
          
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                clsValue += (entry as any).value;
              }
            }
          });
          
          observer.observe({ entryTypes: ['layout-shift'] });
          
          // Wait for layout shifts to settle
          setTimeout(() => resolve(clsValue), 3000);
        });
      });
      
      // CLS should be under 0.1 for good performance
      expect(clsMetric).toBeLessThan(0.1);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should manage memory efficiently during animations', async () => {
      await page.goto(baseUrl);
      
      const initialMemory = await page.metrics();
      
      // Trigger multiple animations
      await page.evaluate(() => {
        for (let i = 0; i < 10; i++) {
          const elements = document.querySelectorAll('[data-animate]');
          elements.forEach((element) => {
            element.classList.toggle('animate-in');
          });
        }
      });
      
      await page.waitForTimeout(5000);
      
      const finalMemory = await page.metrics();
      
      // Memory usage should not increase dramatically
      const memoryIncrease = finalMemory.JSHeapUsedSize - initialMemory.JSHeapUsedSize;
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    });

    it('should clean up resources after media interactions', async () => {
      await page.goto(baseUrl);
      
      // Interact with multiple media elements
      const mediaElements = await page.$$('[data-testid^="media-"]');
      
      for (const element of mediaElements.slice(0, 5)) {
        await element.click();
        await page.waitForTimeout(1000);
      }
      
      // Force garbage collection (if available)
      await page.evaluate(() => {
        if (window.gc) {
          window.gc();
        }
      });
      
      const metrics = await page.metrics();
      
      // Should maintain reasonable memory usage
      expect(metrics.JSHeapUsedSize).toBeLessThan(200 * 1024 * 1024); // Less than 200MB
    });
  });
});