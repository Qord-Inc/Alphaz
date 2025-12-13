import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/embeddings/organization/[userId]/[orgId]/context
 * 
 * Frontend proxy that calls the backend embeddings API
 * Backend URL: http://localhost:5000/api/embeddings/organization/:userId/:orgId/context
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string; orgId: string }> }
) {
  try {
    const { userId, orgId } = await params;

    console.log(`\n🌐 [EMBEDDINGS API PROXY] Frontend → Backend`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Org ID: ${orgId}`);

    const backendUrl = `http://localhost:5000/api/embeddings/organization/${userId}/${orgId}/context`;
    console.log(`   Backend URL: ${backendUrl}`);

    // Call the backend API
    console.log(`📡 [CALLING BACKEND] Starting request...`);
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`📬 [BACKEND RESPONSE] Status: ${response.status}`);

    if (!response.ok) {
      console.error(`❌ [BACKEND ERROR] Status: ${response.status}`);
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || `Backend error: ${response.status}` },
        { status: response.status }
      );
    }

    // Parse response
    const data = await response.json();

    console.log(`✅ [BACKEND SUCCESS]`);
    console.log(`   Embeddings count: ${data.embeddings?.length || 0}`);
    console.log(`   Top posts count: ${data.topPosts?.length || 0}`);

    if (data.embeddings && Array.isArray(data.embeddings)) {
      const contentTypes: { [key: string]: number } = {};
      data.embeddings.forEach((e: any) => {
        contentTypes[e.content_type] = (contentTypes[e.content_type] || 0) + 1;
      });
      console.log(`   Embedding types:`, contentTypes);
    }

    console.log(`\n📤 [RETURNING TO FRONTEND]`);
    console.log(`   Response size: ${JSON.stringify(data).length} bytes`);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`\n❌ [EMBEDDINGS API ERROR]`);
    console.error(`   Error: ${error.message}`);

    // Check if it's a connection error (backend not running)
    if (error.message.includes('ECONNREFUSED') || error.message.includes('Failed to fetch')) {
      console.error(`   💡 TIP: Is the backend running on port 5000?`);
      console.error(`   💡 TIP: Run: npm start (in alphaz-backend folder)`);
    }

    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch embeddings from backend',
        details:
          process.env.NODE_ENV === 'development'
            ? error.message
            : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
