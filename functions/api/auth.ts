
// functions/api/auth.ts
export const onRequest = async (context: any) => {
    const { request, env } = context;
    const url = new URL(request.url);
    const action = url.searchParams.get('action'); // 'register' or 'login'

    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const { username, password } = await request.json();

    if (!username || !password) {
        return new Response(JSON.stringify({ error: 'Missing username or password' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        // 1. Password Hashing (Simple PBKDF2 with Web Crypto)
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);
        const salt = encoder.encode(username + "void_salt"); // Simple salt based on username

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

        if (action === 'register') {
            // SENSITIVE WORD FILTERING & CHINESE SUPPORT
            const sWords = ['管理员', 'admin', 'system', '系统', '官方', 'official', '敏感词1', '敏感词2']; // 可扩展
            const hasSensitiveRaw = sWords.some(w => username.toLowerCase().includes(w.toLowerCase()));

            if (hasSensitiveRaw) {
                return new Response(JSON.stringify({ error: '用户名包含违禁词汇' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Username length and character check (Allows Chinese, Alphanumeric, Underscore)
            const nameRegex = /^[\u4e00-\u9fa5a-zA-Z0-9_]{2,12}$/;
            if (!nameRegex.test(username)) {
                return new Response(JSON.stringify({ error: '用户名需为2-12位中文、字母或数字' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            try {
                await env.DB.prepare(
                    "INSERT INTO users (username, password_hash) VALUES (?, ?)"
                ).bind(username, passwordHash).run();

                return new Response(JSON.stringify({ success: true, message: '注册成功' }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (e: any) {
                if (e.message.includes('UNIQUE constraint')) {
                    return new Response(JSON.stringify({ error: '用户名已存在' }), { status: 409 });
                }
                throw e;
            }
        } else if (action === 'login') {
            const user: any = await env.DB.prepare(
                "SELECT id, username, password_hash FROM users WHERE username = ?"
            ).bind(username).first();

            if (!user || user.password_hash !== passwordHash) {
                return new Response(JSON.stringify({ error: '用户名或密码错误' }), { status: 401 });
            }

            return new Response(JSON.stringify({
                success: true,
                user: { id: user.id, username: user.username }
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response('Invalid Action', { status: 400 });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
