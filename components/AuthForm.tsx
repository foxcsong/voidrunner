
import React, { useState } from 'react';
import { supabase } from '../services/supabase';

interface AuthFormProps {
    onLoginSuccess: () => void;
    onCancel: () => void;
}

export const AuthForm: React.FC<AuthFormProps> = ({ onLoginSuccess, onCancel }) => {
    const [email, setEmail] = useState('');
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
            if (mode === 'LOGIN') {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                onLoginSuccess();
            } else {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                setMsg('注册成功！请检查邮箱确认邮件，或直接登录。');
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
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 p-8 rounded-2xl relative">
                <button onClick={onCancel} className="absolute top-4 right-4 text-zinc-500 hover:text-white">✕</button>

                <h2 className="text-2xl font-bold text-white mb-6 tracking-widest text-center">
                    {mode === 'LOGIN' ? '身份验证' : '新用户注册'}
                </h2>

                {error && <div className="bg-red-900/50 text-red-200 p-3 rounded mb-4 text-sm">{error}</div>}
                {msg && <div className="bg-green-900/50 text-green-200 p-3 rounded mb-4 text-sm">{msg}</div>}

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-xs uppercase text-zinc-500 mb-1">电子邮箱</label>
                        <input
                            type="email"
                            required
                            className="w-full bg-black border border-zinc-700 text-white p-3 rounded focus:border-white outline-none transition-colors"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs uppercase text-zinc-500 mb-1">密码</label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            className="w-full bg-black border border-zinc-700 text-white p-3 rounded focus:border-white outline-none transition-colors"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-white text-black font-bold uppercase py-3 rounded hover:bg-zinc-200 transition-colors disabled:opacity-50"
                    >
                        {loading ? '处理中...' : (mode === 'LOGIN' ? '登 录' : '注 册')}
                    </button>
                </form>

                <div className="mt-6 text-center text-xs text-zinc-500">
                    {mode === 'LOGIN' ? (
                        <p>首次访问? <button onClick={() => setMode('SIGNUP')} className="text-white underline underline-offset-4">创建账号</button></p>
                    ) : (
                        <p>已有账号? <button onClick={() => setMode('LOGIN')} className="text-white underline underline-offset-4">返回登录</button></p>
                    )}
                </div>
            </div>
        </div>
    );
};
