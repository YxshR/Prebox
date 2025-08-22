import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Access token required'
      }
    }, { status: 401 });
  }

  // Mock user data - in a real app, you'd validate the token and get user from database
  return NextResponse.json({
    success: true,
    data: {
      user: {
        id: 1,
        email: 'demo@example.com',
        name: 'Demo User',
        subscriptionTier: 'free',
        emailVerified: true,
        phoneVerified: false
      }
    }
  });
}