import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      mode: 'FRONTEND_API',
      message: 'API is working from Next.js'
    }
  });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      mode: 'FRONTEND_API'
    }
  });
}