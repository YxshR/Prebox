import { Pool } from 'pg';
import { EmailEvent, EmailEventType, EmailJob } from './types';
import { DomainService } from '../domains/domain.service';

export interface DeliverabilityMetrics {
  deliveryRate: number;
  bounceRate: number;
  complaintRate: number;
  openRate: number;
  clickRate: number;
  spamRate: number;
  unsubscribeRate: number;
  reputationScore: number;
  authenticationScore: number;
}

export interface SpamScoreResult {
  score: number; // 0-100, lower is better
  factors: SpamFactor[];
  recommendations: string[];
  isLikelySpam: boolean;
}

export interface SpamFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface AuthenticationResult {
  spf: AuthenticationCheck;
  dkim: AuthenticationCheck;
  dmarc: AuthenticationCheck;
  overallScore: number;
  isValid: boolean;
}

export interface AuthenticationCheck {
  isValid: boolean;
  score: number;
  details: string;
  recommendations?: string[];
}

export interface ReputationMetrics {
  senderScore: number;
  domainScore: number;
  ipScore: number;
  overallScore: number;
  factors: ReputationFactor[];
  trend: 'improving' | 'stable' | 'declining';
}

export interface ReputationFactor {
  name: string;
  impact: number;
  status: 'good' | 'warning' | 'critical';
  description: string;
}

export interface DeliverabilityAlert {
  id: string;
  tenantId: string;
  type: DeliverabilityAlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metrics: Record<string, any>;
  recommendations: string[];
  isResolved: boolean;
  createdAt: Date;
  resolvedAt?: Date;
}

export enum DeliverabilityAlertType {
  HIGH_BOUNCE_RATE = 'high_bounce_rate',
  HIGH_COMPLAINT_RATE = 'high_complaint_rate',
  LOW_DELIVERY_RATE = 'low_delivery_rate',
  AUTHENTICATION_FAILURE = 'authentication_failure',
  REPUTATION_DECLINE = 'reputation_decline',
  SPAM_CONTENT_DETECTED = 'spam_content_detected',
  BLACKLIST_DETECTION = 'blacklist_detection'
}

export class DeliverabilityMonitoringService {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly thresholds = {
    deliveryRate: { warning: 95, critical: 90 },
    bounceRate: { warning: 5, critical: 10 },
    complaintRate: { warning: 0.1, critical: 0.5 },
    spamScore: { warning: 50, critical: 70 },
    reputationScore: { warning: 70, critical: 50 }
  };

  constructor(
    private db: Pool,
    private domainService: DomainService
  ) {}

  /**
   * Start automated deliverability monitoring
   */
  startMonitoring(intervalMinutes: number = 30): void {
    if (this.monitoringInterval) {
      console.log('Deliverability monitoring is already running');
      return;
    }

    console.log(`Starting deliverability monitoring with ${intervalMinutes} minute intervals`);
    
    // Run initial check
    this.runMonitoringCycle().catch(error => {
      console.error('Error in initial deliverability monitoring cycle:', error);
    });

    // Schedule recurring checks
    this.monitoringInterval = setInterval(() => {
      this.runMonitoringCycle().catch(error => {
        console.error('Error in deliverability monitoring cycle:', error);
      });
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop automated deliverability monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('Deliverability monitoring stopped');
    }
  }

  /**
   * Run a complete monitoring cycle for all tenants
   */
  async runMonitoringCycle(): Promise<void> {
    try {
      console.log('Starting deliverability monitoring cycle...');
      
      const activeTenants = await this.getActiveTenants();
      console.log(`Found ${activeTenants.length} active tenants to monitor`);

      for (const tenant of activeTenants) {
        try {
          await this.monitorTenantDeliverability(tenant.id);
        } catch (error) {
          console.error(`Error monitoring tenant ${tenant.id}:`, error);
        }
      }

      console.log('Deliverability monitoring cycle completed');
    } catch (error) {
      console.error('Error in deliverability monitoring cycle:', error);
    }
  }

  /**
   * Monitor deliverability for a specific tenant
   */
  async monitorTenantDeliverability(tenantId: string): Promise<void> {
    try {
      // Get current metrics
      const metrics = await this.getDeliverabilityMetrics(tenantId);
      
      // Check for issues and create alerts
      await this.checkDeliveryRate(tenantId, metrics);
      await this.checkBounceRate(tenantId, metrics);
      await this.checkComplaintRate(tenantId, metrics);
      await this.checkReputationScore(tenantId, metrics);
      
      // Update tenant's deliverability score
      await this.updateTenantDeliverabilityScore(tenantId, metrics);
      
    } catch (error) {
      console.error(`Error monitoring deliverability for tenant ${tenantId}:`, error);
    }
  }

  /**
   * Validate email authentication for a domain
   */
  async validateEmailAuthentication(domain: string): Promise<AuthenticationResult> {
    try {
      const spfResult = await this.checkSPF(domain);
      const dkimResult = await this.checkDKIM(domain);
      const dmarcResult = await this.checkDMARC(domain);
      
      const overallScore = Math.round(
        (spfResult.score * 0.3 + dkimResult.score * 0.4 + dmarcResult.score * 0.3)
      );
      
      return {
        spf: spfResult,
        dkim: dkimResult,
        dmarc: dmarcResult,
        overallScore,
        isValid: overallScore >= 70
      };
    } catch (error) {
      console.error(`Error validating authentication for domain ${domain}:`, error);
      throw error;
    }
  }

  /**
   * Analyze email content for spam indicators
   */
  async analyzeSpamScore(emailContent: {
    subject: string;
    htmlContent: string;
    textContent?: string;
    fromEmail: string;
    fromName?: string;
  }): Promise<SpamScoreResult> {
    try {
      const factors: SpamFactor[] = [];
      let totalScore = 0;

      // Check subject line
      const subjectFactors = this.analyzeSubject(emailContent.subject);
      factors.push(...subjectFactors);

      // Check content
      const contentFactors = this.analyzeContent(emailContent.htmlContent, emailContent.textContent);
      factors.push(...contentFactors);

      // Check sender information
      const senderFactors = this.analyzeSender(emailContent.fromEmail, emailContent.fromName);
      factors.push(...senderFactors);

      // Calculate weighted score
      totalScore = factors.reduce((sum, factor) => sum + (factor.score * factor.weight), 0);
      const normalizedScore = Math.min(100, Math.max(0, totalScore));

      const recommendations = this.generateSpamRecommendations(factors);

      return {
        score: normalizedScore,
        factors,
        recommendations,
        isLikelySpam: normalizedScore > this.thresholds.spamScore.warning
      };
    } catch (error) {
      console.error('Error analyzing spam score:', error);
      throw error;
    }
  }

  /**
   * Monitor sender reputation
   */
  async monitorSenderReputation(tenantId: string): Promise<ReputationMetrics> {
    try {
      const metrics = await this.getDeliverabilityMetrics(tenantId);
      const historicalData = await this.getHistoricalMetrics(tenantId, 30); // 30 days
      
      // Calculate reputation scores
      const senderScore = this.calculateSenderScore(metrics);
      const domainScore = await this.getDomainReputationScore(tenantId);
      const ipScore = await this.getIPReputationScore(tenantId);
      
      const overallScore = Math.round(
        (senderScore * 0.4 + domainScore * 0.4 + ipScore * 0.2)
      );

      // Determine trend
      const trend = this.calculateReputationTrend(historicalData);
      
      // Identify reputation factors
      const factors = this.identifyReputationFactors(metrics, overallScore);

      return {
        senderScore,
        domainScore,
        ipScore,
        overallScore,
        factors,
        trend
      };
    } catch (error) {
      console.error(`Error monitoring sender reputation for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Optimize delivery rates based on current metrics
   */
  async optimizeDeliveryRates(tenantId: string): Promise<{
    currentMetrics: DeliverabilityMetrics;
    recommendations: string[];
    optimizationActions: string[];
    estimatedImprovement: number;
  }> {
    try {
      const metrics = await this.getDeliverabilityMetrics(tenantId);
      const authResult = await this.validateTenantAuthentication(tenantId);
      const reputationMetrics = await this.monitorSenderReputation(tenantId);
      
      const recommendations: string[] = [];
      const optimizationActions: string[] = [];
      
      // Analyze delivery rate issues
      if (metrics.deliveryRate < this.thresholds.deliveryRate.warning) {
        recommendations.push('Improve email authentication setup');
        recommendations.push('Review content for spam indicators');
        recommendations.push('Clean email lists to remove invalid addresses');
        
        if (!authResult.isValid) {
          optimizationActions.push('Fix SPF, DKIM, and DMARC records');
        }
        
        if (metrics.bounceRate > this.thresholds.bounceRate.warning) {
          optimizationActions.push('Implement list hygiene practices');
        }
      }
      
      // Reputation-based recommendations
      if (reputationMetrics.overallScore < this.thresholds.reputationScore.warning) {
        recommendations.push('Gradually increase sending volume');
        recommendations.push('Focus on engaged subscribers');
        recommendations.push('Implement double opt-in for new subscribers');
      }
      
      // Estimate potential improvement
      const estimatedImprovement = this.calculateEstimatedImprovement(
        metrics, 
        authResult, 
        reputationMetrics
      );
      
      return {
        currentMetrics: metrics,
        recommendations,
        optimizationActions,
        estimatedImprovement
      };
    } catch (error) {
      console.error(`Error optimizing delivery rates for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get comprehensive deliverability metrics for a tenant
   */
  async getDeliverabilityMetrics(tenantId: string, days: number = 7): Promise<DeliverabilityMetrics> {
    const query = `
      SELECT 
        COUNT(*) as total_emails,
        COUNT(CASE WHEN event_type = 'sent' THEN 1 END) as sent,
        COUNT(CASE WHEN event_type = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN event_type = 'bounced' THEN 1 END) as bounced,
        COUNT(CASE WHEN event_type = 'complained' THEN 1 END) as complained,
        COUNT(CASE WHEN event_type = 'opened' THEN 1 END) as opened,
        COUNT(CASE WHEN event_type = 'clicked' THEN 1 END) as clicked,
        COUNT(CASE WHEN event_type = 'unsubscribed' THEN 1 END) as unsubscribed
      FROM email_events 
      WHERE tenant_id = $1 
        AND timestamp >= NOW() - INTERVAL '${days} days'
    `;

    try {
      const result = await this.db.query(query, [tenantId]);
      const row = result.rows[0];
      
      const totalEmails = parseInt(row.total_emails) || 1;
      const sent = parseInt(row.sent) || 0;
      const delivered = parseInt(row.delivered) || 0;
      const bounced = parseInt(row.bounced) || 0;
      const complained = parseInt(row.complained) || 0;
      const opened = parseInt(row.opened) || 0;
      const clicked = parseInt(row.clicked) || 0;
      const unsubscribed = parseInt(row.unsubscribed) || 0;

      // Calculate rates
      const deliveryRate = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
      const bounceRate = sent > 0 ? Math.round((bounced / sent) * 100) : 0;
      const complaintRate = sent > 0 ? Number(((complained / sent) * 100).toFixed(2)) : 0;
      const openRate = delivered > 0 ? Math.round((opened / delivered) * 100) : 0;
      const clickRate = delivered > 0 ? Math.round((clicked / delivered) * 100) : 0;
      const unsubscribeRate = delivered > 0 ? Number(((unsubscribed / delivered) * 100).toFixed(2)) : 0;

      // Calculate spam rate (approximation based on complaints and bounces)
      const spamRate = sent > 0 ? Number((((complained + bounced * 0.3) / sent) * 100).toFixed(2)) : 0;

      // Calculate reputation score based on metrics
      const reputationScore = this.calculateReputationScore({
        deliveryRate,
        bounceRate,
        complaintRate,
        openRate,
        clickRate,
        unsubscribeRate
      });

      // Get authentication score
      const authenticationScore = await this.getTenantAuthenticationScore(tenantId);

      return {
        deliveryRate,
        bounceRate,
        complaintRate,
        openRate,
        clickRate,
        spamRate,
        unsubscribeRate,
        reputationScore,
        authenticationScore
      };
    } catch (error) {
      console.error('Error getting deliverability metrics:', error);
      throw error;
    }
  }

  // Private helper methods

  private async checkSPF(domain: string): Promise<AuthenticationCheck> {
    // In a real implementation, this would query DNS records
    // For now, we'll simulate the check
    try {
      // Simulate DNS lookup for SPF record
      const hasSpf = Math.random() > 0.3; // 70% chance of having SPF
      const isValid = hasSpf && Math.random() > 0.2; // 80% chance of being valid if present
      
      return {
        isValid,
        score: isValid ? 100 : (hasSpf ? 50 : 0),
        details: isValid ? 'SPF record is properly configured' : 
                hasSpf ? 'SPF record found but has issues' : 'No SPF record found',
        recommendations: isValid ? [] : [
          'Add SPF record to DNS',
          'Include your email service provider in SPF record',
          'Use ~all or -all mechanism for strict policy'
        ]
      };
    } catch (error) {
      return {
        isValid: false,
        score: 0,
        details: 'Error checking SPF record',
        recommendations: ['Verify DNS configuration', 'Contact DNS provider']
      };
    }
  }

  private async checkDKIM(domain: string): Promise<AuthenticationCheck> {
    // Simulate DKIM check
    try {
      const hasDkim = Math.random() > 0.4; // 60% chance of having DKIM
      const isValid = hasDkim && Math.random() > 0.15; // 85% chance of being valid if present
      
      return {
        isValid,
        score: isValid ? 100 : (hasDkim ? 60 : 0),
        details: isValid ? 'DKIM signature is properly configured' : 
                hasDkim ? 'DKIM record found but signature validation failed' : 'No DKIM record found',
        recommendations: isValid ? [] : [
          'Configure DKIM signing for your domain',
          'Ensure DKIM private key is properly configured',
          'Verify DKIM public key in DNS'
        ]
      };
    } catch (error) {
      return {
        isValid: false,
        score: 0,
        details: 'Error checking DKIM record',
        recommendations: ['Verify DKIM configuration', 'Check email service provider settings']
      };
    }
  }

  private async checkDMARC(domain: string): Promise<AuthenticationCheck> {
    // Simulate DMARC check
    try {
      const hasDmarc = Math.random() > 0.5; // 50% chance of having DMARC
      const isValid = hasDmarc && Math.random() > 0.25; // 75% chance of being valid if present
      
      return {
        isValid,
        score: isValid ? 100 : (hasDmarc ? 40 : 0),
        details: isValid ? 'DMARC policy is properly configured' : 
                hasDmarc ? 'DMARC record found but policy needs adjustment' : 'No DMARC record found',
        recommendations: isValid ? [] : [
          'Add DMARC record to DNS',
          'Start with p=none policy for monitoring',
          'Gradually move to p=quarantine then p=reject',
          'Set up DMARC reporting'
        ]
      };
    } catch (error) {
      return {
        isValid: false,
        score: 0,
        details: 'Error checking DMARC record',
        recommendations: ['Verify DMARC configuration', 'Check DNS settings']
      };
    }
  }

  private analyzeSubject(subject: string): SpamFactor[] {
    const factors: SpamFactor[] = [];
    
    // Check for excessive capitalization
    const capsRatio = (subject.match(/[A-Z]/g) || []).length / subject.length;
    if (capsRatio > 0.5) {
      factors.push({
        name: 'Excessive Capitalization',
        score: 15,
        weight: 1.2,
        description: 'Subject line has too many capital letters',
        severity: 'medium'
      });
    }
    
    // Check for spam keywords
    const spamKeywords = ['FREE', 'URGENT', 'ACT NOW', 'LIMITED TIME', 'GUARANTEED', 'WINNER'];
    const foundKeywords = spamKeywords.filter(keyword => 
      subject.toUpperCase().includes(keyword)
    );
    
    if (foundKeywords.length > 0) {
      factors.push({
        name: 'Spam Keywords',
        score: foundKeywords.length * 10,
        weight: 1.5,
        description: `Contains spam keywords: ${foundKeywords.join(', ')}`,
        severity: foundKeywords.length > 2 ? 'high' : 'medium'
      });
    }
    
    // Check for excessive punctuation
    const punctuationCount = (subject.match(/[!?]{2,}/g) || []).length;
    if (punctuationCount > 0) {
      factors.push({
        name: 'Excessive Punctuation',
        score: punctuationCount * 5,
        weight: 1.0,
        description: 'Subject line has excessive punctuation marks',
        severity: 'low'
      });
    }
    
    return factors;
  }

  private analyzeContent(htmlContent: string, textContent?: string): SpamFactor[] {
    const factors: SpamFactor[] = [];
    const content = textContent || htmlContent.replace(/<[^>]*>/g, '');
    
    // Check content length
    if (content.length < 50) {
      factors.push({
        name: 'Very Short Content',
        score: 10,
        weight: 1.0,
        description: 'Email content is very short',
        severity: 'low'
      });
    }
    
    // Check for excessive links
    const linkCount = (htmlContent.match(/<a\s+[^>]*href/gi) || []).length;
    const linkRatio = linkCount / Math.max(content.length / 100, 1);
    
    if (linkRatio > 3) {
      factors.push({
        name: 'Excessive Links',
        score: Math.min(20, linkRatio * 3),
        weight: 1.3,
        description: 'Too many links relative to content length',
        severity: 'medium'
      });
    }
    
    // Check for image-only content
    const imageCount = (htmlContent.match(/<img/gi) || []).length;
    if (imageCount > 0 && content.length < 100) {
      factors.push({
        name: 'Image-Heavy Content',
        score: 15,
        weight: 1.2,
        description: 'Email is mostly images with little text',
        severity: 'medium'
      });
    }
    
    return factors;
  }

  private analyzeSender(fromEmail: string, fromName?: string): SpamFactor[] {
    const factors: SpamFactor[] = [];
    
    // Check for suspicious sender patterns
    if (fromEmail.includes('noreply') || fromEmail.includes('no-reply')) {
      factors.push({
        name: 'No-Reply Sender',
        score: 5,
        weight: 0.8,
        description: 'Using no-reply email address',
        severity: 'low'
      });
    }
    
    // Check for mismatched sender name and email domain
    if (fromName && fromEmail) {
      const emailDomain = fromEmail.split('@')[1];
      const nameWords = fromName.toLowerCase().split(' ');
      const domainParts = emailDomain.toLowerCase().split('.');
      
      const hasMatch = nameWords.some(word => 
        domainParts.some(part => part.includes(word) || word.includes(part))
      );
      
      if (!hasMatch && fromName.length > 3) {
        factors.push({
          name: 'Sender Mismatch',
          score: 8,
          weight: 1.1,
          description: 'Sender name does not match email domain',
          severity: 'low'
        });
      }
    }
    
    return factors;
  }

  private generateSpamRecommendations(factors: SpamFactor[]): string[] {
    const recommendations: string[] = [];
    
    if (factors.some(f => f.name === 'Excessive Capitalization')) {
      recommendations.push('Use normal capitalization in subject lines');
    }
    
    if (factors.some(f => f.name === 'Spam Keywords')) {
      recommendations.push('Avoid using promotional keywords in subject lines');
    }
    
    if (factors.some(f => f.name === 'Excessive Links')) {
      recommendations.push('Reduce the number of links in your email content');
    }
    
    if (factors.some(f => f.name === 'Image-Heavy Content')) {
      recommendations.push('Include more text content alongside images');
    }
    
    if (factors.some(f => f.name === 'Very Short Content')) {
      recommendations.push('Provide more substantial email content');
    }
    
    return recommendations;
  }

  private calculateReputationScore(metrics: {
    deliveryRate: number;
    bounceRate: number;
    complaintRate: number;
    openRate: number;
    clickRate: number;
    unsubscribeRate: number;
  }): number {
    let score = 100;
    
    // Penalize high bounce rate
    if (metrics.bounceRate > 5) {
      score -= (metrics.bounceRate - 5) * 2;
    }
    
    // Penalize high complaint rate
    if (metrics.complaintRate > 0.1) {
      score -= (metrics.complaintRate - 0.1) * 50;
    }
    
    // Penalize low delivery rate
    if (metrics.deliveryRate < 95) {
      score -= (95 - metrics.deliveryRate) * 1.5;
    }
    
    // Reward good engagement
    if (metrics.openRate > 20) {
      score += Math.min(10, (metrics.openRate - 20) * 0.2);
    }
    
    if (metrics.clickRate > 2) {
      score += Math.min(5, (metrics.clickRate - 2) * 0.5);
    }
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private async getTenantAuthenticationScore(tenantId: string): Promise<number> {
    try {
      // Get tenant's domains and check their authentication
      const domains = await this.getTenantDomains(tenantId);
      
      if (domains.length === 0) {
        return 50; // Default score for shared domains
      }
      
      let totalScore = 0;
      for (const domain of domains) {
        const authResult = await this.validateEmailAuthentication(domain.domain);
        totalScore += authResult.overallScore;
      }
      
      return Math.round(totalScore / domains.length);
    } catch (error) {
      console.error('Error getting tenant authentication score:', error);
      return 50; // Default score on error
    }
  }

  private async getTenantDomains(tenantId: string): Promise<Array<{ id: string; domain: string }>> {
    const query = 'SELECT id, domain FROM domains WHERE tenant_id = $1 AND status = $2';
    const result = await this.db.query(query, [tenantId, 'verified']);
    return result.rows;
  }

  private async validateTenantAuthentication(tenantId: string): Promise<AuthenticationResult> {
    const domains = await this.getTenantDomains(tenantId);
    
    if (domains.length === 0) {
      // Return default result for tenants using shared domains
      return {
        spf: { isValid: true, score: 80, details: 'Using shared domain SPF' },
        dkim: { isValid: true, score: 80, details: 'Using shared domain DKIM' },
        dmarc: { isValid: true, score: 70, details: 'Using shared domain DMARC' },
        overallScore: 77,
        isValid: true
      };
    }
    
    // For tenants with custom domains, check the first domain
    return this.validateEmailAuthentication(domains[0].domain);
  }

  private calculateSenderScore(metrics: DeliverabilityMetrics): number {
    let score = 100;
    
    // Factor in delivery metrics
    score = score * (metrics.deliveryRate / 100);
    score = score * (1 - metrics.bounceRate / 100);
    score = score * (1 - metrics.complaintRate / 10); // Complaint rate is typically much lower
    
    // Factor in engagement
    if (metrics.openRate > 0) {
      score = score * (1 + Math.min(0.2, metrics.openRate / 100));
    }
    
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  private async getDomainReputationScore(tenantId: string): Promise<number> {
    try {
      const domains = await this.getTenantDomains(tenantId);
      
      if (domains.length === 0) {
        return 75; // Default score for shared domains
      }
      
      // For simplicity, return the authentication score as domain reputation
      // In a real implementation, this would check external reputation services
      return this.getTenantAuthenticationScore(tenantId);
    } catch (error) {
      console.error('Error getting domain reputation score:', error);
      return 75;
    }
  }

  private async getIPReputationScore(tenantId: string): Promise<number> {
    // In a real implementation, this would check IP reputation with external services
    // For now, we'll return a simulated score based on recent activity
    try {
      const recentMetrics = await this.getDeliverabilityMetrics(tenantId, 1); // Last 24 hours
      
      let score = 85; // Base IP score
      
      if (recentMetrics.bounceRate > 10) {
        score -= 20;
      } else if (recentMetrics.bounceRate > 5) {
        score -= 10;
      }
      
      if (recentMetrics.complaintRate > 0.5) {
        score -= 25;
      } else if (recentMetrics.complaintRate > 0.1) {
        score -= 10;
      }
      
      return Math.max(0, Math.min(100, score));
    } catch (error) {
      console.error('Error getting IP reputation score:', error);
      return 85;
    }
  }

  private calculateReputationTrend(historicalData: DeliverabilityMetrics[]): 'improving' | 'stable' | 'declining' {
    if (historicalData.length < 2) {
      return 'stable';
    }
    
    const recent = historicalData.slice(-7); // Last 7 data points
    const older = historicalData.slice(0, 7); // First 7 data points
    
    const recentAvg = recent.reduce((sum, m) => sum + m.reputationScore, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.reputationScore, 0) / older.length;
    
    const difference = recentAvg - olderAvg;
    
    if (difference > 5) return 'improving';
    if (difference < -5) return 'declining';
    return 'stable';
  }

  private identifyReputationFactors(metrics: DeliverabilityMetrics, overallScore: number): ReputationFactor[] {
    const factors: ReputationFactor[] = [];
    
    // Delivery rate factor
    factors.push({
      name: 'Delivery Rate',
      impact: metrics.deliveryRate >= 95 ? 10 : (95 - metrics.deliveryRate) * -2,
      status: metrics.deliveryRate >= 95 ? 'good' : metrics.deliveryRate >= 90 ? 'warning' : 'critical',
      description: `${metrics.deliveryRate}% of emails are being delivered`
    });
    
    // Bounce rate factor
    factors.push({
      name: 'Bounce Rate',
      impact: metrics.bounceRate <= 5 ? 5 : (metrics.bounceRate - 5) * -3,
      status: metrics.bounceRate <= 5 ? 'good' : metrics.bounceRate <= 10 ? 'warning' : 'critical',
      description: `${metrics.bounceRate}% bounce rate`
    });
    
    // Complaint rate factor
    factors.push({
      name: 'Complaint Rate',
      impact: metrics.complaintRate <= 0.1 ? 5 : (metrics.complaintRate - 0.1) * -20,
      status: metrics.complaintRate <= 0.1 ? 'good' : metrics.complaintRate <= 0.5 ? 'warning' : 'critical',
      description: `${metrics.complaintRate}% complaint rate`
    });
    
    // Engagement factor
    const engagementScore = (metrics.openRate + metrics.clickRate) / 2;
    factors.push({
      name: 'Engagement',
      impact: engagementScore > 15 ? 8 : engagementScore > 10 ? 3 : -2,
      status: engagementScore > 15 ? 'good' : engagementScore > 10 ? 'warning' : 'critical',
      description: `${engagementScore.toFixed(1)}% average engagement rate`
    });
    
    return factors;
  }

  private calculateEstimatedImprovement(
    metrics: DeliverabilityMetrics,
    authResult: AuthenticationResult,
    reputationMetrics: ReputationMetrics
  ): number {
    let improvement = 0;
    
    // Authentication improvements
    if (!authResult.isValid) {
      improvement += (100 - authResult.overallScore) * 0.3;
    }
    
    // Reputation improvements
    if (reputationMetrics.overallScore < 80) {
      improvement += (80 - reputationMetrics.overallScore) * 0.2;
    }
    
    // Delivery rate improvements
    if (metrics.deliveryRate < 95) {
      improvement += (95 - metrics.deliveryRate) * 0.5;
    }
    
    return Math.min(25, Math.round(improvement)); // Cap at 25% improvement
  }

  private async getActiveTenants(): Promise<Array<{ id: string }>> {
    const query = `
      SELECT DISTINCT tenant_id as id 
      FROM email_events 
      WHERE timestamp >= NOW() - INTERVAL '7 days'
    `;
    
    const result = await this.db.query(query);
    return result.rows;
  }

  private async getHistoricalMetrics(tenantId: string, days: number): Promise<DeliverabilityMetrics[]> {
    // This would typically fetch daily aggregated metrics
    // For now, we'll return a simplified version
    const metrics: DeliverabilityMetrics[] = [];
    
    for (let i = days; i > 0; i--) {
      try {
        const dayMetrics = await this.getDeliverabilityMetrics(tenantId, 1);
        metrics.push(dayMetrics);
      } catch (error) {
        // Skip days with errors
        continue;
      }
    }
    
    return metrics;
  }

  private async checkDeliveryRate(tenantId: string, metrics: DeliverabilityMetrics): Promise<void> {
    if (metrics.deliveryRate < this.thresholds.deliveryRate.critical) {
      await this.createDeliverabilityAlert(
        tenantId,
        DeliverabilityAlertType.LOW_DELIVERY_RATE,
        'critical',
        `Critical: Delivery rate is ${metrics.deliveryRate}%`,
        { deliveryRate: metrics.deliveryRate },
        [
          'Check email authentication (SPF, DKIM, DMARC)',
          'Review content for spam indicators',
          'Clean email lists to remove invalid addresses',
          'Contact support for assistance'
        ]
      );
    } else if (metrics.deliveryRate < this.thresholds.deliveryRate.warning) {
      await this.createDeliverabilityAlert(
        tenantId,
        DeliverabilityAlertType.LOW_DELIVERY_RATE,
        'medium',
        `Warning: Delivery rate is ${metrics.deliveryRate}%`,
        { deliveryRate: metrics.deliveryRate },
        [
          'Monitor delivery rates closely',
          'Review recent campaign content',
          'Verify email list quality'
        ]
      );
    }
  }

  private async checkBounceRate(tenantId: string, metrics: DeliverabilityMetrics): Promise<void> {
    if (metrics.bounceRate > this.thresholds.bounceRate.critical) {
      await this.createDeliverabilityAlert(
        tenantId,
        DeliverabilityAlertType.HIGH_BOUNCE_RATE,
        'critical',
        `Critical: Bounce rate is ${metrics.bounceRate}%`,
        { bounceRate: metrics.bounceRate },
        [
          'Immediately clean email lists',
          'Implement email validation',
          'Remove hard bounces from future campaigns',
          'Review data collection practices'
        ]
      );
    } else if (metrics.bounceRate > this.thresholds.bounceRate.warning) {
      await this.createDeliverabilityAlert(
        tenantId,
        DeliverabilityAlertType.HIGH_BOUNCE_RATE,
        'medium',
        `Warning: Bounce rate is ${metrics.bounceRate}%`,
        { bounceRate: metrics.bounceRate },
        [
          'Review and clean email lists',
          'Implement email validation for new subscribers',
          'Monitor bounce rates daily'
        ]
      );
    }
  }

  private async checkComplaintRate(tenantId: string, metrics: DeliverabilityMetrics): Promise<void> {
    if (metrics.complaintRate > this.thresholds.complaintRate.critical) {
      await this.createDeliverabilityAlert(
        tenantId,
        DeliverabilityAlertType.HIGH_COMPLAINT_RATE,
        'critical',
        `Critical: Complaint rate is ${metrics.complaintRate}%`,
        { complaintRate: metrics.complaintRate },
        [
          'Immediately review email content and practices',
          'Ensure clear unsubscribe options',
          'Review subscriber consent and opt-in processes',
          'Consider pausing campaigns until resolved'
        ]
      );
    } else if (metrics.complaintRate > this.thresholds.complaintRate.warning) {
      await this.createDeliverabilityAlert(
        tenantId,
        DeliverabilityAlertType.HIGH_COMPLAINT_RATE,
        'medium',
        `Warning: Complaint rate is ${metrics.complaintRate}%`,
        { complaintRate: metrics.complaintRate },
        [
          'Review email content for relevance',
          'Ensure clear sender identification',
          'Make unsubscribe process easier',
          'Segment lists for better targeting'
        ]
      );
    }
  }

  private async checkReputationScore(tenantId: string, metrics: DeliverabilityMetrics): Promise<void> {
    if (metrics.reputationScore < this.thresholds.reputationScore.critical) {
      await this.createDeliverabilityAlert(
        tenantId,
        DeliverabilityAlertType.REPUTATION_DECLINE,
        'critical',
        `Critical: Sender reputation score is ${metrics.reputationScore}`,
        { reputationScore: metrics.reputationScore },
        [
          'Immediately review all email practices',
          'Reduce sending volume temporarily',
          'Focus on highly engaged subscribers only',
          'Contact support for reputation recovery plan'
        ]
      );
    } else if (metrics.reputationScore < this.thresholds.reputationScore.warning) {
      await this.createDeliverabilityAlert(
        tenantId,
        DeliverabilityAlertType.REPUTATION_DECLINE,
        'medium',
        `Warning: Sender reputation declining (${metrics.reputationScore})`,
        { reputationScore: metrics.reputationScore },
        [
          'Monitor reputation closely',
          'Review recent campaign performance',
          'Implement list hygiene practices',
          'Focus on engagement quality'
        ]
      );
    }
  }

  private async createDeliverabilityAlert(
    tenantId: string,
    type: DeliverabilityAlertType,
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    metrics: Record<string, any>,
    recommendations: string[]
  ): Promise<void> {
    const query = `
      INSERT INTO deliverability_alerts (
        tenant_id, type, severity, message, metrics, recommendations, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `;
    
    try {
      await this.db.query(query, [
        tenantId,
        type,
        severity,
        message,
        JSON.stringify(metrics),
        JSON.stringify(recommendations)
      ]);
    } catch (error) {
      console.error('Error creating deliverability alert:', error);
    }
  }

  private async updateTenantDeliverabilityScore(
    tenantId: string,
    metrics: DeliverabilityMetrics
  ): Promise<void> {
    const query = `
      INSERT INTO tenant_deliverability_scores (
        tenant_id, delivery_rate, bounce_rate, complaint_rate, 
        reputation_score, authentication_score, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (tenant_id) DO UPDATE SET
        delivery_rate = EXCLUDED.delivery_rate,
        bounce_rate = EXCLUDED.bounce_rate,
        complaint_rate = EXCLUDED.complaint_rate,
        reputation_score = EXCLUDED.reputation_score,
        authentication_score = EXCLUDED.authentication_score,
        updated_at = EXCLUDED.updated_at
    `;
    
    try {
      await this.db.query(query, [
        tenantId,
        metrics.deliveryRate,
        metrics.bounceRate,
        metrics.complaintRate,
        metrics.reputationScore,
        metrics.authenticationScore
      ]);
    } catch (error) {
      console.error('Error updating tenant deliverability score:', error);
    }
  }
}