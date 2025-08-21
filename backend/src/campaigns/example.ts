/**
 * Campaign Management System Example
 * 
 * This example demonstrates how to use the campaign management system
 * to create templates, campaigns, and send bulk emails with tracking.
 */

import { CampaignService } from './campaign.service';
import { EmailService } from '../emails/email.service';
import { EmailEventType } from '../emails/types';

async function campaignExample() {
  // Initialize services
  const emailService = new EmailService();
  const campaignService = new CampaignService(emailService);

  console.log('🚀 Starting Campaign Management Example\n');

  try {
    // 1. Create an email template
    console.log('📝 Creating email template...');
    const template = await campaignService.createTemplate({
      tenantId: 'example-tenant',
      name: 'Product Launch Email',
      subject: 'Introducing {{productName}} - {{firstName}}!',
      htmlContent: `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Hi {{firstName}}!</h1>
            <p>We're excited to introduce our latest product:</p>
            <h2 style="color: #007bff;">{{productName}}</h2>
            <p>{{productDescription}}</p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Special Launch Offer</h3>
              <p style="font-size: 24px; color: #28a745; font-weight: bold;">{{price}}</p>
              <p style="color: #666;">Limited time offer - expires {{expiryDate}}</p>
            </div>
            <a href="{{ctaLink}}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              Learn More
            </a>
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              Best regards,<br>
              The {{companyName}} Team
            </p>
          </body>
        </html>
      `,
      variables: [
        { name: 'firstName', type: 'text', required: true },
        { name: 'productName', type: 'text', required: true },
        { name: 'productDescription', type: 'text', required: true },
        { name: 'price', type: 'text', required: true },
        { name: 'expiryDate', type: 'text', required: true },
        { name: 'ctaLink', type: 'text', required: true },
        { name: 'companyName', type: 'text', required: true }
      ]
    });

    console.log(`✅ Template created: ${template.name} (ID: ${template.id})`);
    console.log(`   Variables detected: ${template.variables.map(v => v.name).join(', ')}\n`);

    // 2. Create a campaign
    console.log('📋 Creating campaign...');
    const campaign = await campaignService.createCampaign({
      tenantId: 'example-tenant',
      name: 'SuperWidget Pro Launch Campaign',
      templateId: template.id,
      listIds: ['customers-list', 'prospects-list']
    });

    console.log(`✅ Campaign created: ${campaign.name} (ID: ${campaign.id})`);
    console.log(`   Status: ${campaign.status}\n`);

    // 3. Send the campaign to a list of contacts
    console.log('📧 Sending campaign...');
    const sendResult = await campaignService.sendCampaign({
      campaignId: campaign.id,
      contacts: [
        {
          email: 'alice@example.com',
          firstName: 'Alice',
          lastName: 'Johnson',
          customFields: { segment: 'premium', company: 'Tech Corp' }
        },
        {
          email: 'bob@example.com',
          firstName: 'Bob',
          lastName: 'Smith',
          customFields: { segment: 'standard', company: 'Design Studio' }
        },
        {
          email: 'carol@example.com',
          firstName: 'Carol',
          lastName: 'Davis',
          customFields: { segment: 'premium', company: 'Marketing Inc' }
        }
      ],
      variables: {
        productName: 'SuperWidget Pro',
        productDescription: 'The ultimate productivity tool for modern teams. Streamline your workflow with advanced automation and real-time collaboration features.',
        price: '$99.99 (50% off)',
        expiryDate: 'December 31, 2024',
        ctaLink: 'https://example.com/superwidget-pro',
        companyName: 'TechSolutions Inc'
      }
    });

    console.log(`✅ Campaign sent successfully!`);
    console.log(`   Total emails: ${sendResult.totalJobs}`);
    console.log(`   Job IDs: ${sendResult.jobIds.join(', ')}\n`);

    // 4. Simulate some delivery events (in real scenario, these come from webhooks)
    console.log('📊 Simulating delivery events...');
    
    // Simulate delivery events
    const deliveryTracker = (campaignService as any).deliveryTracker;
    
    await deliveryTracker.simulateWebhookEvent(
      'msg_001', EmailEventType.DELIVERED, 'alice@example.com', 'example-tenant', campaign.id
    );
    await deliveryTracker.simulateWebhookEvent(
      'msg_002', EmailEventType.DELIVERED, 'bob@example.com', 'example-tenant', campaign.id
    );
    await deliveryTracker.simulateWebhookEvent(
      'msg_003', EmailEventType.BOUNCED, 'carol@example.com', 'example-tenant', campaign.id
    );

    // Simulate engagement events
    await deliveryTracker.simulateWebhookEvent(
      'msg_001', EmailEventType.OPENED, 'alice@example.com', 'example-tenant', campaign.id
    );
    await deliveryTracker.simulateWebhookEvent(
      'msg_001', EmailEventType.CLICKED, 'alice@example.com', 'example-tenant', campaign.id
    );
    await deliveryTracker.simulateWebhookEvent(
      'msg_002', EmailEventType.OPENED, 'bob@example.com', 'example-tenant', campaign.id
    );

    console.log('✅ Delivery events simulated\n');

    // 5. Get campaign metrics
    console.log('📈 Retrieving campaign metrics...');
    const metrics = await campaignService.getCampaignMetrics(campaign.id, 'example-tenant');
    
    if (metrics) {
      console.log('Campaign Performance:');
      console.log(`   Total Recipients: ${metrics.totalRecipients}`);
      console.log(`   Delivered: ${metrics.delivered}`);
      console.log(`   Bounced: ${metrics.bounced}`);
      console.log(`   Opened: ${metrics.opened}`);
      console.log(`   Clicked: ${metrics.clicked}`);
      console.log(`   Unsubscribed: ${metrics.unsubscribed}`);
      console.log(`   Complained: ${metrics.complained}`);
      
      if (metrics.delivered > 0) {
        const openRate = (metrics.opened / metrics.delivered * 100).toFixed(1);
        const clickRate = (metrics.clicked / metrics.delivered * 100).toFixed(1);
        console.log(`   Open Rate: ${openRate}%`);
        console.log(`   Click Rate: ${clickRate}%`);
      }
    }

    console.log('\n');

    // 6. Get queue statistics
    console.log('⚙️ Queue Statistics:');
    const queueStats = await campaignService.getQueueStats();
    console.log(`   Waiting: ${queueStats.waiting}`);
    console.log(`   Active: ${queueStats.active}`);
    console.log(`   Completed: ${queueStats.completed}`);
    console.log(`   Failed: ${queueStats.failed}`);
    console.log(`   Delayed: ${queueStats.delayed}\n`);

    // 7. List all templates and campaigns
    console.log('📚 All Templates:');
    const allTemplates = await campaignService.listTemplates('example-tenant');
    allTemplates.forEach(t => {
      console.log(`   - ${t.name} (${t.variables.length} variables)`);
    });

    console.log('\n📋 All Campaigns:');
    const allCampaigns = await campaignService.listCampaigns('example-tenant');
    allCampaigns.forEach(c => {
      console.log(`   - ${c.name} (Status: ${c.status})`);
    });

    console.log('\n🎉 Campaign management example completed successfully!');

  } catch (error) {
    console.error('❌ Error in campaign example:', error);
  }
}

// Export for use in other files or testing
export { campaignExample };

// Run the example if this file is executed directly
if (require.main === module) {
  campaignExample().catch(console.error);
}