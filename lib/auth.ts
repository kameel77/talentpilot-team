import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'talent-navigator-dev-secret-change-me';

export interface AuthUser {
    id: string;
    email: string;
}

export function verifyAuth(req: NextRequest): AuthUser | null {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.substring(7);
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
        return decoded;
    } catch {
        return null;
    }
}

export function requireAuth(req: NextRequest): AuthUser {
    const user = verifyAuth(req);
    if (!user) {
        throw new Error('Unauthorized');
    }
    return user;
}

export function unauthorized() {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
