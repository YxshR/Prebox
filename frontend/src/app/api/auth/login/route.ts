import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Mock authentication - in a real app, you'd validate against a database
    if (email && password) {
      return NextResponse.json({
        success: true,
        data: {
          user: {
            id: 1,
            email: email,
            name: 'Demo User',
            subscriptionTier: 'free'
          },
          token: 'mock-jwt-token-' + Date.now(),
          refreshToken: 'mock-refresh-token-' + Date.now()
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email and password are required'
        }
      }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid request body'
      }
    }, { status: 400 });
  }
}