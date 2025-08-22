import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Mock dashboard data
  return NextResponse.json({
    success: true,
    data: {
      stats: {
        totalEmails: 1250,
        emailsSent: 1180,
        openRate: 24.5,
        clickRate: 3.2,
        bounceRate: 2.1
      },
      recentCampaigns: [
        {
          id: 1,
          name: 'Welcome Series',
          status: 'active',
          sent: 450,
          opens: 112,
          clicks: 18,
          createdAt: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: 2,
          name: 'Product Update',
          status: 'completed',
          sent: 730,
          opens: 175,
          clicks: 23,
          createdAt: new Date(Date.now() - 172800000).toISOString()
        }
      ]
    }
  });
}