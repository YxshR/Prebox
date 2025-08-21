/**
 * Bundle analysis and optimization utilities
 * Implements requirement 2.3 for reduced load times through bundle optimization
 */

interface BundleStats {
  totalSize: number;
  gzippedSize: number;
  chunks: ChunkInfo[];
  duplicates: DuplicateModule[];
  recommendations: OptimizationRecommendation[];
}

interface ChunkInfo {
  name: string;
  size: number;
  modules: ModuleInfo[];
  isAsync: boolean;
  isEntry: boolean;
}

interface ModuleInfo {
  name: string;
  size: number;
  path: string;
  reasons: string[];
}

interface DuplicateModule {
  name: string;
  chunks: string[];
  totalSize: number;
}

interface OptimizationRecommendation {
  type: 'code-split' | 'tree-shake' | 'compress' | 'lazy-load';
  severity: 'low' | 'medium' | 'high';
  description: string;
  potentialSavings: number; // in KB
  action: string;
}

export class BundleAnalyzer {
  private static instance: BundleAnalyzer;
  private stats: BundleStats | null = null;

  static getInstance(): BundleAnalyzer {
    if (!BundleAnalyzer.instance) {
      BundleAnalyzer.instance = new BundleAnalyzer();
    }
    return BundleAnalyzer.instance;
  }

  /**
   * Analyze current bundle using Resource Timing API
   */
  async analyzeBundleFromResourceTiming(): Promise<BundleStats> {
    if (typeof window === 'undefined' || !('performance' in window)) {
      throw new Error('Performance API not available');
    }

    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const jsResources = resources.filter(resource => 
      resource.name.includes('.js') && 
      (resource.name.includes('_next/static') || resource.name.includes('chunks'))
    );

    const chunks: ChunkInfo[] = jsResources.map(resource => {
      const name = this.extractChunkName(resource.name);
      const size = resource.transferSize || resource.encodedBodySize || 0;
      
      return {
        name,
        size,
        modules: [], // Can't get module info from Resource Timing API
        isAsync: resource.name.includes('chunks/') && !resource.name.includes('main'),
        isEntry: resource.name.includes('main') || resource.name.includes('app'),
      };
    });

    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
    const recommendations = this.generateRecommendations(chunks);

    this.stats = {
      totalSize,
      gzippedSize: totalSize * 0.7, // Estimate gzipped size
      chunks,
      duplicates: [], // Can't detect duplicates from Resource Timing API
      recommendations,
    };

    return this.stats;
  }

  /**
   * Generate optimization recommendations based on bundle analysis
   */
  private generateRecommendations(chunks: ChunkInfo[]): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
    const totalSizeKB = Math.round(totalSize / 1024);

    // Large bundle size recommendation
    if (totalSizeKB > 500) {
      recommendations.push({
        type: 'code-split',
        severity: 'high',
        description: `Total bundle size is ${totalSizeKB}KB, which is quite large`,
        potentialSavings: Math.round(totalSizeKB * 0.3),
        action: 'Implement more aggressive code splitting and lazy loading',
      });
    }

    // Large individual chunks
    chunks.forEach(chunk => {
      const chunkSizeKB = Math.round(chunk.size / 1024);
      if (chunkSizeKB > 200 && !chunk.isEntry) {
        recommendations.push({
          type: 'code-split',
          severity: 'medium',
          description: `Chunk "${chunk.name}" is ${chunkSizeKB}KB`,
          potentialSavings: Math.round(chunkSizeKB * 0.4),
          action: `Split "${chunk.name}" into smaller chunks`,
        });
      }
    });

    // Too many chunks (can hurt performance)
    if (chunks.length > 20) {
      recommendations.push({
        type: 'compress',
        severity: 'medium',
        description: `${chunks.length} chunks detected, which may cause many network requests`,
        potentialSavings: 0,
        action: 'Consider combining some smaller chunks',
      });
    }

    // Synchronous chunks that could be lazy loaded
    const syncChunks = chunks.filter(chunk => !chunk.isAsync && !chunk.isEntry);
    if (syncChunks.length > 3) {
      recommendations.push({
        type: 'lazy-load',
        severity: 'medium',
        description: `${syncChunks.length} synchronous chunks could be lazy loaded`,
        potentialSavings: Math.round(
          syncChunks.reduce((sum, chunk) => sum + chunk.size, 0) / 1024 * 0.5
        ),
        action: 'Convert non-critical chunks to lazy loading',
      });
    }

    return recommendations;
  }

  /**
   * Extract chunk name from resource URL
   */
  private extractChunkName(url: string): string {
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename.split('.')[0] || 'unknown';
  }

  /**
   * Get bundle statistics
   */
  getStats(): BundleStats | null {
    return this.stats;
  }

  /**
   * Get performance impact assessment
   */
  getPerformanceImpact(): {
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    score: number;
    issues: string[];
  } {
    if (!this.stats) {
      return { grade: 'F', score: 0, issues: ['No bundle analysis available'] };
    }

    const { totalSize, recommendations } = this.stats;
    const totalSizeKB = Math.round(totalSize / 1024);
    
    let score = 100;
    const issues: string[] = [];

    // Size penalties
    if (totalSizeKB > 1000) {
      score -= 40;
      issues.push(`Bundle size is very large (${totalSizeKB}KB)`);
    } else if (totalSizeKB > 500) {
      score -= 25;
      issues.push(`Bundle size is large (${totalSizeKB}KB)`);
    } else if (totalSizeKB > 250) {
      score -= 10;
      issues.push(`Bundle size could be optimized (${totalSizeKB}KB)`);
    }

    // Recommendation penalties
    const highSeverityRecs = recommendations.filter(r => r.severity === 'high');
    const mediumSeverityRecs = recommendations.filter(r => r.severity === 'medium');
    
    score -= highSeverityRecs.length * 15;
    score -= mediumSeverityRecs.length * 8;

    if (highSeverityRecs.length > 0) {
      issues.push(`${highSeverityRecs.length} high-priority optimization(s) needed`);
    }
    if (mediumSeverityRecs.length > 0) {
      issues.push(`${mediumSeverityRecs.length} medium-priority optimization(s) available`);
    }

    // Determine grade
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else grade = 'F';

    return { grade, score: Math.max(0, score), issues };
  }

  /**
   * Generate optimization report
   */
  generateReport(): string {
    if (!this.stats) {
      return 'No bundle analysis data available. Run analyzeBundleFromResourceTiming() first.';
    }

    const { totalSize, chunks, recommendations } = this.stats;
    const totalSizeKB = Math.round(totalSize / 1024);
    const impact = this.getPerformanceImpact();

    let report = `
# Bundle Analysis Report

## Summary
- **Total Size**: ${totalSizeKB}KB
- **Number of Chunks**: ${chunks.length}
- **Performance Grade**: ${impact.grade} (${impact.score}/100)

## Chunks Breakdown
${chunks
  .sort((a, b) => b.size - a.size)
  .map(chunk => {
    const sizeKB = Math.round(chunk.size / 1024);
    const type = chunk.isEntry ? 'Entry' : chunk.isAsync ? 'Async' : 'Sync';
    return `- **${chunk.name}**: ${sizeKB}KB (${type})`;
  })
  .join('\n')}

## Optimization Recommendations
${recommendations.length === 0 
  ? 'No specific recommendations - bundle is well optimized!'
  : recommendations
      .sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      })
      .map(rec => `
### ${rec.type.toUpperCase()} - ${rec.severity.toUpperCase()} Priority
- **Issue**: ${rec.description}
- **Potential Savings**: ${rec.potentialSavings}KB
- **Action**: ${rec.action}
      `).join('\n')
}

## Performance Issues
${impact.issues.length === 0 
  ? 'No performance issues detected!'
  : impact.issues.map(issue => `- ${issue}`).join('\n')
}
    `.trim();

    return report;
  }

  /**
   * Monitor bundle size changes over time
   */
  trackBundleSize(): void {
    if (typeof window === 'undefined' || !('localStorage' in window)) {
      return;
    }

    const currentSize = this.stats?.totalSize || 0;
    const currentSizeKB = Math.round(currentSize / 1024);
    
    const history = JSON.parse(localStorage.getItem('bundle-size-history') || '[]');
    const today = new Date().toISOString().split('T')[0];
    
    // Add today's measurement
    history.push({
      date: today,
      size: currentSizeKB,
      timestamp: Date.now(),
    });

    // Keep only last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentHistory = history.filter((entry: any) => entry.timestamp > thirtyDaysAgo);
    
    localStorage.setItem('bundle-size-history', JSON.stringify(recentHistory));

    // Log size changes
    if (recentHistory.length > 1) {
      const previousSize = recentHistory[recentHistory.length - 2].size;
      const change = currentSizeKB - previousSize;
      
      if (Math.abs(change) > 10) { // Only log significant changes
        console.log(
          `Bundle size changed by ${change > 0 ? '+' : ''}${change}KB ` +
          `(${previousSize}KB → ${currentSizeKB}KB)`
        );
      }
    }
  }
}

/**
 * Hook for using bundle analyzer in React components
 */
export function useBundleAnalyzer() {
  const analyzer = BundleAnalyzer.getInstance();

  const analyze = async () => {
    try {
      const stats = await analyzer.analyzeBundleFromResourceTiming();
      analyzer.trackBundleSize();
      return stats;
    } catch (error) {
      console.error('Bundle analysis failed:', error);
      return null;
    }
  };

  const getReport = () => {
    return analyzer.generateReport();
  };

  const getPerformanceImpact = () => {
    return analyzer.getPerformanceImpact();
  };

  return {
    analyze,
    getReport,
    getPerformanceImpact,
    stats: analyzer.getStats(),
  };
}

// Export singleton instance
export const bundleAnalyzer = BundleAnalyzer.getInstance();