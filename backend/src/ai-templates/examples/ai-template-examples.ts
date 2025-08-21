/**
 * AI Template Service Usage Examples
 * 
 * This file demonstrates how to use the AI Template Service
 * for generating and customizing email templates.
 */

import { AITemplateService } from '../ai-template.service';
import { SubscriptionService } from '../../billing/subscription.service';
import { AITemplateRequest, TemplateCustomization } from '../ai-template.types';

// Initialize services
const subscriptionService = new SubscriptionService();
const aiTemplateService = new AITemplateService(subscriptionService);

/**
 * Example 1: Basic Template Generation
 */
export async function generateWelcomeTemplate() {
  console.log('🤖 Generating welcome email template...');
  
  const request: AITemplateRequest = {
    tenantId: 'tenant_example_123',
    prompt: 'Create a warm welcome email for new customers who just signed up for our SaaS platform',
    templateType: 'welcome',
    tone: 'friendly',
    brandName: 'TechFlow',
    industry: 'SaaS',
    targetAudience: 'Small business owners and entrepreneurs',
    callToAction: 'Complete your profile setup',
    additionalContext: 'We offer project management and team collaboration tools'
  };

  try {
    const result = await aiTemplateService.generateTemplate(request);
    
    console.log('✅ Template generated successfully!');
    console.log(`📧 Template Name: ${result.template.name}`);
    console.log(`📝 Subject: ${result.template.subject}`);
    console.log(`🔢 Variables found: ${result.template.variables.map(v => v.name).join(', ')}`);
    console.log(`⏱️  Generation time: ${result.generationMetadata.generationTime}ms`);
    console.log(`🎯 Tokens used: ${result.generationMetadata.tokensUsed}`);
    
    return result.template;
  } catch (error) {
    console.error('❌ Template generation failed:', error);
    throw error;
  }
}

/**
 * Example 2: Promotional Email Template
 */
export async function generatePromotionalTemplate() {
  console.log('🎯 Generating promotional email template...');
  
  const request: AITemplateRequest = {
    tenantId: 'tenant_example_123',
    prompt: 'Create a promotional email for our Black Friday sale with 50% off all premium features',
    templateType: 'promotional',
    tone: 'persuasive',
    brandName: 'TechFlow',
    industry: 'SaaS',
    targetAudience: 'Existing free tier users',
    callToAction: 'Upgrade now and save 50%',
    additionalContext: 'Limited time offer, sale ends November 30th'
  };

  try {
    const result = await aiTemplateService.generateTemplate(request);
    
    console.log('✅ Promotional template generated!');
    console.log(`📧 Template: ${result.template.name}`);
    console.log(`📝 Subject: ${result.template.subject}`);
    
    return result.template;
  } catch (error) {
    console.error('❌ Promotional template generation failed:', error);
    throw error;
  }
}

/**
 * Example 3: Newsletter Template
 */
export async function generateNewsletterTemplate() {
  console.log('📰 Generating newsletter template...');
  
  const request: AITemplateRequest = {
    tenantId: 'tenant_example_123',
    prompt: 'Create a monthly newsletter template with company updates, feature releases, and industry insights',
    templateType: 'newsletter',
    tone: 'professional',
    brandName: 'TechFlow',
    industry: 'SaaS',
    targetAudience: 'All subscribers',
    callToAction: 'Read our latest blog posts',
    additionalContext: 'Include sections for product updates, customer spotlights, and upcoming events'
  };

  try {
    const result = await aiTemplateService.generateTemplate(request);
    
    console.log('✅ Newsletter template generated!');
    console.log(`📧 Template: ${result.template.name}`);
    
    return result.template;
  } catch (error) {
    console.error('❌ Newsletter template generation failed:', error);
    throw error;
  }
}

/**
 * Example 4: Template Customization
 */
export async function customizeTemplate(templateId: string) {
  console.log('🎨 Customizing template...');
  
  const customization: TemplateCustomization = {
    templateId,
    tenantId: 'tenant_example_123',
    modifications: {
      subject: 'Welcome to TechFlow - Let\'s Get Started! 🚀',
      styling: {
        primaryColor: '#007bff',
        secondaryColor: '#6c757d',
        fontFamily: 'Arial, Helvetica, sans-serif',
        customCss: `
          .header { 
            background: linear-gradient(135deg, #007bff, #0056b3); 
            padding: 20px;
            text-align: center;
          }
          .cta-button {
            background: #28a745;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            display: inline-block;
            font-weight: bold;
          }
        `
      }
    }
  };

  try {
    const customizedTemplate = await aiTemplateService.customizeTemplate(customization);
    
    console.log('✅ Template customized successfully!');
    console.log(`📧 New Template: ${customizedTemplate.name}`);
    console.log(`📝 Updated Subject: ${customizedTemplate.subject}`);
    
    return customizedTemplate;
  } catch (error) {
    console.error('❌ Template customization failed:', error);
    throw error;
  }
}

/**
 * Example 5: Check Quota and Usage
 */
export async function checkQuotaAndUsage(tenantId: string) {
  console.log('📊 Checking template quota and usage...');
  
  try {
    // Check if user can generate templates
    const canGenerate = await aiTemplateService.validateTemplateQuota(tenantId);
    console.log(`✅ Can generate templates: ${canGenerate}`);
    
    // Get current usage
    const usage = await aiTemplateService.getTemplateUsage(tenantId);
    console.log(`📈 Daily usage: ${usage.dailyUsage}/${usage.limits.dailyLimit}`);
    console.log(`📈 Monthly usage: ${usage.monthlyUsage}/${usage.limits.monthlyLimit}`);
    console.log(`🎯 Subscription tier: ${usage.tier}`);
    console.log(`♾️  Unlimited access: ${usage.limits.hasUnlimitedAccess}`);
    
    // Get usage statistics
    const stats = await aiTemplateService.getUsageStats(tenantId);
    console.log(`📊 Usage history: ${stats.history.length} entries`);
    
    return { canGenerate, usage, stats };
  } catch (error) {
    console.error('❌ Failed to check quota:', error);
    throw error;
  }
}

/**
 * Example 6: Get Template Suggestions
 */
export async function getTemplateSuggestions(industry?: string) {
  console.log('💡 Getting template suggestions...');
  
  try {
    const suggestions = await aiTemplateService.getTemplateSuggestions(industry);
    
    console.log(`✅ Found ${suggestions.length} template suggestions:`);
    suggestions.forEach((suggestion, index) => {
      console.log(`${index + 1}. ${suggestion.title} (${suggestion.type})`);
      console.log(`   📝 ${suggestion.description}`);
      console.log(`   💬 Sample: "${suggestion.samplePrompt}"`);
      console.log('');
    });
    
    return suggestions;
  } catch (error) {
    console.error('❌ Failed to get suggestions:', error);
    throw error;
  }
}

/**
 * Example 7: Get Available Template Types
 */
export async function getAvailableTypes() {
  console.log('📋 Getting available template types...');
  
  try {
    const types = await aiTemplateService.getAvailableTemplateTypes();
    
    console.log(`✅ Available template types: ${types.join(', ')}`);
    
    return types;
  } catch (error) {
    console.error('❌ Failed to get template types:', error);
    throw error;
  }
}

/**
 * Example 8: Complete Workflow
 */
export async function completeWorkflowExample() {
  console.log('🔄 Running complete AI template workflow...');
  
  const tenantId = 'tenant_workflow_example';
  
  try {
    // Step 1: Check quota
    console.log('\n--- Step 1: Check Quota ---');
    await checkQuotaAndUsage(tenantId);
    
    // Step 2: Get suggestions
    console.log('\n--- Step 2: Get Suggestions ---');
    await getTemplateSuggestions('healthcare');
    
    // Step 3: Generate template
    console.log('\n--- Step 3: Generate Template ---');
    const template = await generateWelcomeTemplate();
    
    // Step 4: Customize template
    console.log('\n--- Step 4: Customize Template ---');
    const customizedTemplate = await customizeTemplate(template.id);
    
    // Step 5: Check updated usage
    console.log('\n--- Step 5: Check Updated Usage ---');
    await checkQuotaAndUsage(tenantId);
    
    console.log('\n✅ Complete workflow finished successfully!');
    
    return {
      originalTemplate: template,
      customizedTemplate,
      success: true
    };
    
  } catch (error) {
    console.error('\n❌ Workflow failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Example 9: Batch Template Generation
 */
export async function batchTemplateGeneration() {
  console.log('📦 Generating multiple templates...');
  
  const tenantId = 'tenant_batch_example';
  const templates = [];
  
  const requests: AITemplateRequest[] = [
    {
      tenantId,
      prompt: 'Create an onboarding email for new users',
      templateType: 'welcome',
      tone: 'friendly',
      brandName: 'MyApp'
    },
    {
      tenantId,
      prompt: 'Create a password reset email',
      templateType: 'transactional',
      tone: 'professional',
      brandName: 'MyApp'
    },
    {
      tenantId,
      prompt: 'Create an abandoned cart reminder',
      templateType: 'promotional',
      tone: 'persuasive',
      brandName: 'MyApp'
    }
  ];

  try {
    for (const [index, request] of requests.entries()) {
      console.log(`\n🔄 Generating template ${index + 1}/${requests.length}...`);
      
      // Check quota before each generation
      const canGenerate = await aiTemplateService.validateTemplateQuota(tenantId);
      if (!canGenerate) {
        console.log(`⚠️  Quota exceeded, stopping at template ${index + 1}`);
        break;
      }
      
      const result = await aiTemplateService.generateTemplate(request);
      templates.push(result.template);
      
      console.log(`✅ Generated: ${result.template.name}`);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n✅ Batch generation complete! Generated ${templates.length} templates.`);
    return templates;
    
  } catch (error) {
    console.error('❌ Batch generation failed:', error);
    throw error;
  }
}

// Export all examples for easy testing
export const examples = {
  generateWelcomeTemplate,
  generatePromotionalTemplate,
  generateNewsletterTemplate,
  customizeTemplate,
  checkQuotaAndUsage,
  getTemplateSuggestions,
  getAvailableTypes,
  completeWorkflowExample,
  batchTemplateGeneration
};

// If running this file directly, run the complete workflow
if (require.main === module) {
  completeWorkflowExample()
    .then(result => {
      console.log('\n🎉 Example execution completed:', result.success ? 'SUCCESS' : 'FAILED');
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('\n💥 Example execution failed:', error);
      process.exit(1);
    });
}