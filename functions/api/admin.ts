
// functions/api/admin.ts
export const onRequest = async (context: any) => {
    const { request, env } = context;
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const authHeader = request.headers.get('Authorization');

    // 1. Basic Secret Check
    if (!env.ADMIN_SECRET || authHeader !== env.ADMIN_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    if (request.method !== 'POST') {
        const { search } = Object.fromEntries(url.searchParams);

        if (action === 'list') {
            const query = search ? `%${search}%` : '%';
            const users = await env.DB.prepare(
                "SELECT id, username, created_at FROM users WHERE username LIKE ? ORDER BY created_at DESC LIMIT 100"
            ).bind(query).all();
            return new Response(JSON.stringify(users.results), { headers: { 'Content-Type': 'application/json' } });
        }

        if (action === 'list_records') {
            // Join with users to show usernames
            const records = await env.DB.prepare(`
                SELECT r.id, r.user_id, u.username, r.clear_time_seconds, r.monster_kills, r.created_at 
                FROM clear_records r 
                JOIN users u ON r.user_id = u.id 
                ORDER BY r.created_at DESC LIMIT 200
            `).all();
            return new Response(JSON.stringify(records.results), { headers: { 'Content-Type': 'application/json' } });
        }

        return new Response('Method Not Allowed', { status: 405 });
    }

    const { userId, username, recordId } = await request.json();

    try {
        if (action === 'delete') {
            await env.DB.batch([
                env.DB.prepare("DELETE FROM game_saves WHERE user_id = ?").bind(userId),
                env.DB.prepare("DELETE FROM clear_records WHERE user_id = ?").bind(userId),
                env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId)
            ]);
            return new Response(JSON.stringify({ success: true, message: '用户已抹除' }));
        }

        if (action === 'delete_record') {
            await env.DB.prepare("DELETE FROM clear_records WHERE id = ?").bind(recordId).run();
            return new Response(JSON.stringify({ success: true, message: '通关记录已删除' }));
        }

        if (action === 'reset_password') {
            // Re-calculate hash for "123456" for this specific username
            const encoder = new TextEncoder();
            const passwordBuffer = encoder.encode("123456");
            const salt = encoder.encode(username + "void_salt");

            const key = await crypto.subtle.importKey(
                "raw",
                passwordBuffer,
                { name: "PBKDF2" },
                false,
                ["deriveBits", "deriveKey"]
            );

            const derivedKeyBuffer = await crypto.subtle.deriveBits(
                {
                    name: "PBKDF2",
                    salt: salt,
                    iterations: 100000,
                    hash: "SHA-256"
                },
                key,
                256
            );

            const passwordHash = btoa(String.fromCharCode(...new Uint8Array(derivedKeyBuffer)));

            await env.DB.prepare(
                "UPDATE users SET password_hash = ? WHERE id = ?"
            ).bind(passwordHash, userId).run();

            return new Response(JSON.stringify({ success: true, message: '密码已重置为 123456' }));
        }

        return new Response('Invalid Action', { status: 400 });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
