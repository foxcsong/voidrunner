
// functions/api/save.ts
export const onRequest = async (context: any) => {
    const { request, env } = context;
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    if (request.method === 'GET') {
        const save: any = await env.DB.prepare(
            "SELECT save_data FROM game_saves WHERE user_id = ?"
        ).bind(userId).first();

        return new Response(JSON.stringify({ save: save ? JSON.parse(save.save_data) : null }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (request.method === 'POST') {
        const { saveData } = await request.json();
        await env.DB.prepare(
            "INSERT OR REPLACE INTO game_saves (user_id, save_data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
        ).bind(userId, JSON.stringify(saveData)).run();

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response('Method Not Allowed', { status: 405 });
};
