import OpenAI from 'openai';
import { AIProvider, AITemplateRequest, AIModelConfig, AIModelProvider } from '../ai-template.types';
import { TemplateVariable } from '../../shared/types';

export class OpenAIProvider implements AIProvider {
  public readonly name = 'OpenAI';
  private client: OpenAI;
  private config: AIModelConfig;

  constructor(apiKey: string, config?: Partial<AIModelConfig>) {
    this.client = new OpenAI({
      apiKey: apiKey
    });

    this.config = {
      provider: AIModelProvider.OPENAI,
      model: config?.model || 'gpt-4',
      maxTokens: config?.maxTokens || 2000,
      temperature: config?.temperature || 0.7,
      systemPrompt: config?.systemPrompt || this.getDefaultSystemPrompt()
    };
  }

  async generateTemplate(request: AITemplateRequest): Promise<{
    subject: string;
    htmlContent: string;
    textContent: string;
    variables: TemplateVariable[];
  }> {
    const prompt = this.buildPrompt(request);

    try {
      const completion = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: this.config.systemPrompt
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        response_format: { type: 'json_object' }
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      const parsedResponse = JSON.parse(response);
      
      return {
        subject: parsedResponse.subject,
        htmlContent: parsedResponse.htmlContent,
        textContent: parsedResponse.textContent || this.extractTextFromHtml(parsedResponse.htmlContent),
        variables: this.extractVariables(parsedResponse.htmlContent, parsedResponse.subject)
      };

    } catch (error) {
      console.error('OpenAI template generation failed:', error);
      throw new Error(`AI template generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildPrompt(request: AITemplateRequest): string {
    const {
      prompt,
      templateType = 'custom',
      tone = 'professional',
      industry,
      targetAudience,
      callToAction,
      brandName,
      additionalContext
    } = request;

    let fullPrompt = `Generate an email template with the following requirements:

Primary Request: ${prompt}

Template Details:
- Type: ${templateType}
- Tone: ${tone}`;

    if (brandName) {
      fullPrompt += `\n- Brand Name: ${brandName}`;
    }

    if (industry) {
      fullPrompt += `\n- Industry: ${industry}`;
    }

    if (targetAudience) {
      fullPrompt += `\n- Target Audience: ${targetAudience}`;
    }

    if (callToAction) {
      fullPrompt += `\n- Call to Action: ${callToAction}`;
    }

    if (additionalContext) {
      fullPrompt += `\n- Additional Context: ${additionalContext}`;
    }

    fullPrompt += `

Please include template variables using {{variableName}} syntax where appropriate (e.g., {{firstName}}, {{companyName}}, {{productName}}).

The response should be a JSON object with the following structure:
{
  "subject": "Email subject line with variables if needed",
  "htmlContent": "Complete HTML email template with proper structure, styling, and variables",
  "textContent": "Plain text version of the email content"
}

Make sure the HTML is responsive, professional, and includes proper email-safe CSS styling.`;

    return fullPrompt;
  }

  private getDefaultSystemPrompt(): string {
    return `You are an expert email marketing template generator. Your task is to create professional, engaging, and effective email templates based on user requirements.

Guidelines:
1. Always create responsive HTML templates that work across email clients
2. Use inline CSS for styling to ensure compatibility
3. Include appropriate template variables using {{variableName}} syntax
4. Make the content engaging and relevant to the specified audience
5. Ensure the call-to-action is clear and prominent
6. Follow email marketing best practices for deliverability
7. Create both HTML and plain text versions
8. Use professional formatting and structure
9. Include proper email headers and footers
10. Ensure the tone matches the specified requirements

Always respond with valid JSON containing subject, htmlContent, and textContent fields.`;
  }

  private extractVariables(htmlContent: string, subject: string): TemplateVariable[] {
    const variablePattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
    const variables = new Set<string>();
    
    // Extract from HTML content
    let match;
    while ((match = variablePattern.exec(htmlContent)) !== null) {
      variables.add(match[1]);
    }
    
    // Extract from subject
    variablePattern.lastIndex = 0;
    while ((match = variablePattern.exec(subject)) !== null) {
      variables.add(match[1]);
    }
    
    return Array.from(variables).map(name => ({
      name,
      type: 'text' as const,
      required: this.isRequiredVariable(name)
    }));
  }

  private isRequiredVariable(variableName: string): boolean {
    // Common required variables
    const requiredVars = ['firstName', 'lastName', 'email', 'companyName'];
    return requiredVars.includes(variableName);
  }

  private extractTextFromHtml(htmlContent: string): string {
    return htmlContent
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
}