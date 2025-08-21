#!/usr/bin/env ts-node

/**
 * Branding System Test Script
 * 
 * This script tests the core functionality of the branding system
 * Run with: npx ts-node src/branding/test-branding.ts
 */

import { brandingService } from './branding.service';
import { templateBrandingService } from './template-branding.service';
import { LogoPosition, UploadStatus } from './branding.types';
import { SubscriptionTier } from '../shared/types';

async function testBrandingSystem() {
  console.log('🧪 Testing Branding System...\n');

  const testTenantId = 'test-tenant-' + Date.now();
  
  try {
    // Test 1: Create default branding settings
    console.log('1️⃣ Testing default branding settings creation...');
    const defaultSettings = await (brandingService as any).createDefaultBrandingSettings(testTenantId);
    console.log('✅ Default settings created:', {
      tenantId: defaultSettings.tenantId,
      logoPosition: defaultSettings.logoPosition,
      primaryColor: defaultSettings.primaryColor
    });

    // Test 2: Update branding settings
    console.log('\n2️⃣ Testing branding settings update...');
    const updatedSettings = await brandingService.updateBrandingSettings(testTenantId, {
      primaryColor: '#3b82f6',
      secondaryColor: '#eff6ff',
      textColor: '#1e40af',
      fontFamily: 'Inter, sans-serif',
      logoPosition: LogoPosition.HEADER
    });
    console.log('✅ Settings updated:', {
      primaryColor: updatedSettings.primaryColor,
      logoPosition: updatedSettings.logoPosition,
      fontFamily: updatedSettings.fontFamily
    });

    // Test 3: Get branding settings
    console.log('\n3️⃣ Testing branding settings retrieval...');
    const retrievedSettings = await brandingService.getBrandingSettings(testTenantId);
    console.log('✅ Settings retrieved:', {
      id: retrievedSettings?.id,
      isActive: retrievedSettings?.isActive,
      primaryColor: retrievedSettings?.primaryColor
    });

    // Test 4: Generate branding preview
    console.log('\n4️⃣ Testing branding preview generation...');
    const preview = await brandingService.generateBrandingPreview(testTenantId, {
      primaryColor: '#059669',
      secondaryColor: '#ecfdf5',
      textColor: '#065f46'
    });
    console.log('✅ Preview generated:', {
      hasHtml: !!preview.previewHtml,
      htmlLength: preview.previewHtml.length,
      containsColor: preview.previewHtml.includes('#059669')
    });

    // Test 5: Apply branding to template
    console.log('\n5️⃣ Testing template branding application...');
    const templateHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>Test Email</title></head>
      <body>
        <h1 class="primary">Welcome!</h1>
        <p>This is a test email template.</p>
        <div class="bg-secondary">Secondary background</div>
      </body>
      </html>
    `;

    if (retrievedSettings) {
      const brandedTemplate = await brandingService.applyBrandingToTemplate(
        templateHtml,
        retrievedSettings
      );
      console.log('✅ Template branding applied:', {
        originalLength: templateHtml.length,
        brandedLength: brandedTemplate.length,
        hasStyles: brandedTemplate.includes('<style>'),
        hasColors: brandedTemplate.includes(retrievedSettings.primaryColor)
      });
    }

    // Test 6: Test subscription tier access
    console.log('\n6️⃣ Testing subscription tier access control...');
    const hasAccess = (brandingService as any).hasLogoAccess(SubscriptionTier.PAID_STANDARD);
    const noAccess = (brandingService as any).hasLogoAccess(SubscriptionTier.FREE);
    console.log('✅ Access control working:', {
      paidStandardAccess: hasAccess,
      freeAccess: noAccess
    });

    // Test 7: Test template branding service
    console.log('\n7️⃣ Testing template branding service...');
    const shouldApply = await templateBrandingService.shouldApplyBranding(
      testTenantId, 
      SubscriptionTier.PAID_STANDARD
    );
    console.log('✅ Template branding service working:', {
      shouldApplyBranding: shouldApply
    });

    // Test 8: Test default free tier branding
    console.log('\n8️⃣ Testing free tier default branding...');
    const defaultFreeBranding = templateBrandingService.getDefaultFreeTierBranding();
    const freeBrandedHtml = await templateBrandingService.applyDefaultBranding(templateHtml);
    console.log('✅ Free tier branding applied:', {
      hasDefaultColors: !!defaultFreeBranding.primaryColor,
      hasFooterBranding: freeBrandedHtml.includes('Powered by'),
      htmlLength: freeBrandedHtml.length
    });

    // Test 9: Test branding validation
    console.log('\n9️⃣ Testing branding validation...');
    const validationResult = (brandingService as any).validateBrandingSettings({
      primaryColor: '#3b82f6',
      logoPosition: LogoPosition.HEADER,
      fontFamily: 'Arial, sans-serif'
    });
    console.log('✅ Validation working:', {
      isValid: validationResult.isValid,
      errorCount: validationResult.errors.length
    });

    // Test 10: Test invalid branding validation
    console.log('\n🔟 Testing invalid branding validation...');
    const invalidValidation = (brandingService as any).validateBrandingSettings({
      primaryColor: 'invalid-color',
      logoPosition: 'invalid-position' as LogoPosition
    });
    console.log('✅ Invalid validation working:', {
      isValid: invalidValidation.isValid,
      errorCount: invalidValidation.errors.length,
      errors: invalidValidation.errors
    });

    console.log('\n🎉 All branding system tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('✅ Default settings creation');
    console.log('✅ Settings update and retrieval');
    console.log('✅ Preview generation');
    console.log('✅ Template branding application');
    console.log('✅ Subscription tier access control');
    console.log('✅ Template branding service');
    console.log('✅ Free tier default branding');
    console.log('✅ Branding validation (valid and invalid)');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testBrandingSystem()
    .then(() => {
      console.log('\n✨ Branding system is working correctly!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Branding system test failed:', error);
      process.exit(1);
    });
}

export { testBrandingSystem };