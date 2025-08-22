import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      mode: 'FRONTEND_HEALTH',
      message: 'Health check from Next.js frontend'
    }
  });
}