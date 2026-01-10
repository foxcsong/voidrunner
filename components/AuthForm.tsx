
import React, { useState } from 'react';
import { cloudflare } from '../services/cloudflare';

interface AuthFormProps {
    onLoginSuccess: (user: any) => void;
    onCancel: () => void;
}

export const AuthForm: React.FC<AuthFormProps> = ({ onLoginSuccess, onCancel }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
    const [msg, setMsg] = useState('');

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMsg('');

        try {
            const data = await cloudflare.auth(mode === 'LOGIN' ? 'login' : 'register', {
                username,
                password
            });

            if (mode === 'LOGIN') {
                localStorage.setItem('void_user', JSON.stringify(data.user));
                onLoginSuccess(data.user);
            } else {
                setMsg('虚空档案创建成功！请直接登录。');
                setMode('LOGIN');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 p-10 rounded-3xl relative shadow-2xl">
                <button onClick={onCancel} className="absolute top-6 right-6 text-zinc-600 hover:text-white transition-colors text-xl">✕</button>

                <h2 className="text-2xl font-black text-white mb-8 tracking-[0.2em] text-center uppercase italic border-b border-zinc-900 pb-4">
                    {mode === 'LOGIN' ? '虚空终端登录' : '创建生存档案'}
                </h2>

                {error && <div className="bg-red-950/40 border border-red-900/50 text-red-500 p-4 rounded-xl mb-6 text-xs font-bold uppercase tracking-widest">{error}</div>}
                {msg && <div className="bg-green-950/40 border border-green-900/50 text-green-500 p-4 rounded-xl mb-6 text-xs font-bold uppercase tracking-widest">{msg}</div>}

                <form onSubmit={handleAuth} className="space-y-6">
                    <div>
                        <label className="block text-[10px] uppercase font-black text-zinc-600 mb-2 tracking-widest">探险员代号 (Username)</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-black border border-zinc-800 text-white p-4 rounded-xl focus:border-cyan-600 outline-none transition-all font-mono"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] uppercase font-black text-zinc-600 mb-2 tracking-widest">安全密钥 (Password)</label>
                        <input
                            type="password"
                            required
                            minLength={4}
                            className="w-full bg-black border border-zinc-800 text-white p-4 rounded-xl focus:border-cyan-600 outline-none transition-all font-mono"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-white text-black font-black uppercase py-4 rounded-xl hover:bg-cyan-500 hover:text-white transition-all disabled:opacity-50 active:scale-95 shadow-lg"
                    >
                        {loading ? '正在连接...' : (mode === 'LOGIN' ? '初始化链接' : '生成新档案')}
                    </button>
                </form>

                <div className="mt-8 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                    {mode === 'LOGIN' ? (
                        <p>首次检测到意识波? <button onClick={() => setMode('SIGNUP')} className="text-cyan-500 hover:text-white underline underline-offset-8">登记新身份</button></p>
                    ) : (
                        <p>已有已知波长? <button onClick={() => setMode('LOGIN')} className="text-cyan-500 hover:text-white underline underline-offset-8">返回协议</button></p>
                    )}
                </div>
            </div>
        </div>
    );
};
