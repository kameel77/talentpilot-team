import { NextResponse } from 'next/server';

// GET /api/debug/env — check env var values (temporary debug endpoint)
export async function GET() {
    const apiUrl = process.env.TALENTPILOT_API_URL || 'NOT SET';
    const apiKey = process.env.TALENTPILOT_API_KEY || 'NOT SET';

    return NextResponse.json({
        TALENTPILOT_API_URL: apiUrl,
        TALENTPILOT_API_URL_stripped: apiUrl.replace(/^["']|["']$/g, ''),
        TALENTPILOT_API_KEY_set: apiKey !== 'NOT SET',
        TALENTPILOT_API_KEY_length: apiKey.length,
        DATABASE_URL_set: !!process.env.DATABASE_URL,
    });
}
