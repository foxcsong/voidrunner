
// functions/api/leaderboard.ts
export const onRequest = async (context: any) => {
    const { request, env } = context;

    if (request.method === 'GET') {
        // Fetch raw records and aggregate in JS to handle JSON depth sorting correctly
        const result = await env.DB.prepare(`
            SELECT u.username, r.clear_time_seconds, r.monster_kills, r.extra_stats, r.created_at
            FROM clear_records r
            JOIN users u ON u.id = r.user_id
            ORDER BY r.created_at DESC
            LIMIT 500
        `).all();

        const records = result.results;
        const userBest = new Map();

        records.forEach((r: any) => {
            let stats = {};
            try { stats = JSON.parse(r.extra_stats || '{}'); } catch (e) { }
            const depth = (stats as any).depth || 1;

            // Logic: High Depth > Low Depth. Same Depth: Low Time > High Time
            if (!userBest.has(r.username)) {
                userBest.set(r.username, { ...r, depth });
            } else {
                const current = userBest.get(r.username);
                if (depth > current.depth) {
                    userBest.set(r.username, { ...r, depth });
                } else if (depth === current.depth && r.clear_time_seconds < current.clear_time_seconds) {
                    userBest.set(r.username, { ...r, depth });
                }
            }
        });

        const sortedboard = Array.from(userBest.values())
            .sort((a: any, b: any) => {
                if (b.depth !== a.depth) return b.depth - a.depth;
                return a.clear_time_seconds - b.clear_time_seconds;
            })
            .slice(0, 20);

        return new Response(JSON.stringify(sortedboard), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (request.method === 'POST') {
        const { userId, clearTime, monsterKills, extraStats, depth } = await request.json();

        if (!userId || clearTime === undefined) {
            return new Response('Missing data', { status: 400 });
        }

        // Merge depth into extraStats
        const finalStats = { ...(extraStats || {}), depth: depth || 1 };

        await env.DB.prepare(`
      INSERT INTO clear_records (user_id, clear_time_seconds, monster_kills, extra_stats)
      VALUES (?, ?, ?, ?)
    `).bind(userId, clearTime, monsterKills || 0, JSON.stringify(finalStats)).run();

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response('Method Not Allowed', { status: 405 });
};
