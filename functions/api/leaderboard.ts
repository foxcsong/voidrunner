
// functions/api/leaderboard.ts
export const onRequest = async (context: any) => {
    const { request, env } = context;

    if (request.method === 'GET') {
        const records = await env.DB.prepare(`
      SELECT users.username, clear_records.clear_time_seconds, clear_records.monster_kills, clear_records.created_at
      FROM clear_records
      JOIN users ON users.id = clear_records.user_id
      ORDER BY clear_time_seconds ASC
      LIMIT 20
    `).all();

        return new Response(JSON.stringify(records.results), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (request.method === 'POST') {
        const { userId, clearTime, monsterKills, extraStats } = await request.json();

        if (!userId || clearTime === undefined) {
            return new Response('Missing data', { status: 400 });
        }

        await env.DB.prepare(`
      INSERT INTO clear_records (user_id, clear_time_seconds, monster_kills, extra_stats)
      VALUES (?, ?, ?, ?)
    `).bind(userId, clearTime, monsterKills || 0, JSON.stringify(extraStats || {})).run();

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response('Method Not Allowed', { status: 405 });
};
