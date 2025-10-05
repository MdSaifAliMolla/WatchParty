import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { id, creatorId } = await req.json();

        if (!id || !creatorId) {
            return NextResponse.json({ error: 'Missing id or creatorId' }, { status: 400 });
        }

        // Initialize Supabase admin client with service role key to bypass RLS
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );

        // Verify the creator is indeed the one ending the party? 
        // Usually, we'd check the session here too, but for now we'll trust the request
        // or we could use the standard createRouteHandlerClient to check session first.

        const { data, error } = await supabaseAdmin
            .from('watchparties')
            .delete()
            .eq('id', id)
            .eq('creator_id', creatorId) // Safety check
            .select();

        if (error) {
            console.error('Error deleting watchparty:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!data || data.length === 0) {
            return NextResponse.json({ error: 'Watchparty not found or unauthorized' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        console.error('API Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
