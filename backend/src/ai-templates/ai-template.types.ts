import { EmailTemplate, TemplateVariable, SubscriptionTier } from '../shared/types';

export interface AITemplateRequest {
  tenantId: string;
  prompt: string;
  templateType?: 'promotional' | 'transactional' | 'newsletter' | 'welcome' | 'custom';
  tone?: 'professional' | 'casual' | 'friendly' | 'formal' | 'persuasive';
  industry?: string;
  targetAudience?: string;
  callToAction?: string;
  brandName?: string;
  additionalContext?: string;
}

export interface AITemplateResponse {
  template: EmailTemplate;
  generationMetadata: {
    model: string;
    tokensUsed: number;
    generationTime: number;
    prompt: string;
  };
}

export interface TemplateUsage {
  tenantId: string;
  dailyUsage: number;
  monthlyUsage: number;
  lastUsedAt: Date;
  tier: SubscriptionTier;
  limits: TemplateUsageLimits;
}

export interface TemplateUsageLimits {
  dailyLimit: number;
  monthlyLimit: number;
  hasUnlimitedAccess: boolean;
}

export interface AIProvider {
  name: string;
  generateTemplate(request: AITemplateRequest): Promise<{
    subject: string;
    htmlContent: string;
    textContent: string;
    variables: TemplateVariable[];
  }>;
}

export interface TemplateCustomization {
  templateId: string;
  tenantId: string;
  modifications: {
    subject?: string;
    htmlContent?: string;
    textContent?: string;
    variables?: TemplateVariable[];
    styling?: {
      primaryColor?: string;
      secondaryColor?: string;
      fontFamily?: string;
      customCss?: string;
    };
  };
}

export interface TemplateGenerationJob {
  id: string;
  tenantId: string;
  request: AITemplateRequest;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: AITemplateResponse;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export enum AIModelProvider {
  OPENAI = 'openai',
  OPENROUTER = 'openrouter',
  CLAUDE = 'claude'
}

export interface AIModelConfig {
  provider: AIModelProvider;
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}