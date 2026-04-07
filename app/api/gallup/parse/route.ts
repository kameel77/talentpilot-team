import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorized } from '@/lib/auth';

export async function POST(req: NextRequest) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();

    // Strip quotes from env vars (Coolify may wrap values in quotes)
    const TALENTPILOT_API_URL = (process.env.TALENTPILOT_API_URL || '').replace(/^["']|["']$/g, '');
    const TALENTPILOT_API_KEY = (process.env.TALENTPILOT_API_KEY || '').replace(/^["']|["']$/g, '');

    if (!TALENTPILOT_API_URL || !TALENTPILOT_API_KEY) {
        return NextResponse.json(
            { error: 'TalentPilot API not configured' },
            { status: 500 }
        );
    }

    // Get the uploaded file from form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
        return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }

    try {
        // Relay PDF to TalentPilot API
        const apiFormData = new FormData();
        apiFormData.append('file', file);

        const apiUrl = `${TALENTPILOT_API_URL.replace(/\/$/, '')}/api/external/v1/gallup/parse?language=pl%2Ben`;
        console.log('[Gallup Parse Only] Calling TalentPilot API:', apiUrl);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'X-API-Key': TALENTPILOT_API_KEY },
            body: apiFormData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Gallup Parse Only] API error:', response.status, errorText);
            return NextResponse.json(
                { error: `TalentPilot API error: ${response.status}`, detail: errorText, url: apiUrl },
                { status: response.status }
            );
        }

        const data = await response.json();
        
        return NextResponse.json({
            person: data.person,
            talents: data.talents || [],
            language: data.language
        });
    } catch (error) {
        console.error('Gallup parse error:', error);
        return NextResponse.json(
            { error: 'Failed to process Gallup report' },
            { status: 500 }
        );
    }
}
