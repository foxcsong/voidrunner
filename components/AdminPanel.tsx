
import React, { useState, useEffect } from 'react';
import { cloudflare } from '../services/cloudflare';

interface AdminPanelProps {
    onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
    const [secret, setSecret] = useState('');
    const [isAuth, setIsAuth] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const checkSecret = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await cloudflare.adminListUsers(secret);
            setUsers(data);
            setIsAuth(true);
        } catch (err: any) {
            setError('密钥验证失败或无权限');
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await cloudflare.adminListUsers(secret, search);
            setUsers(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (userId: number, username: string) => {
        if (!window.confirm(`确认彻底抹除探险员 [${username}] 及其所有平行时空数据（存档/战绩）吗？`)) return;
        try {
            await cloudflare.adminDeleteUser(secret, userId);
            fetchUsers();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleReset = async (userId: number, username: string) => {
        if (!window.confirm(`确认将 [${username}] 的安全密钥强制重置为 123456 吗？`)) return;
        try {
            const res = await cloudflare.adminResetPassword(secret, userId, username);
            alert(res.message);
        } catch (err: any) {
            alert(err.message);
        }
    };

    if (!isAuth) {
        return (
            <div className="fixed inset-0 bg-black/95 z-[2000] flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-zinc-950 border border-red-900/30 p-10 rounded-3xl relative shadow-[0_0_50px_rgba(153,27,27,0.1)]">
                    <button onClick={onClose} className="absolute top-6 right-6 text-zinc-600 hover:text-white transition-colors">✕</button>
                    <h2 className="text-xl font-black text-red-600 mb-8 tracking-[.3em] uppercase text-center italic">虚空管理协议 // ACCESS_REQUIRED</h2>
                    {error && <div className="bg-red-950/20 border border-red-900/50 text-red-500 p-4 rounded-xl mb-6 text-[10px] font-bold uppercase tracking-widest">{error}</div>}
                    <div className="space-y-6">
                        <div>
                            <label className="block text-[10px] uppercase font-black text-zinc-600 mb-2 tracking-widest">管理员密钥 (ADMIN_SECRET)</label>
                            <input
                                type="password"
                                className="w-full bg-black border border-zinc-800 text-white p-4 rounded-xl focus:border-red-600 outline-none transition-all font-mono"
                                value={secret}
                                onChange={e => setSecret(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && checkSecret()}
                            />
                        </div>
                        <button
                            onClick={checkSecret}
                            disabled={loading}
                            className="w-full bg-red-600 text-white font-black uppercase py-4 rounded-xl hover:bg-red-500 transition-all disabled:opacity-50 active:scale-95"
                        >
                            {loading ? '身份校验中...' : '建立管理连接'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/98 z-[2000] flex flex-col p-8 font-mono overflow-hidden">
            <div className="max-w-4xl mx-auto w-full flex flex-col h-full">
                <div className="flex justify-between items-end mb-10 border-b border-zinc-800 pb-6">
                    <div>
                        <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">虚空终端管理 // MASTER_CONTROL</h2>
                        <div className="text-[10px] text-zinc-600 mt-1 tracking-widest uppercase">底层用户数据库实时访问脉冲</div>
                    </div>
                    <button onClick={onClose} className="px-6 py-2 border border-zinc-800 text-zinc-500 hover:text-white hover:border-white transition-all text-xs uppercase font-bold">断开连接</button>
                </div>

                <div className="flex gap-4 mb-8">
                    <input
                        type="text"
                        placeholder="通过探险员代号模糊搜索..."
                        className="flex-1 bg-zinc-900 border border-zinc-800 text-white px-6 py-4 rounded-xl outline-none focus:border-cyan-600 transition-all"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && fetchUsers()}
                    />
                    <button onClick={fetchUsers} className="px-8 bg-white text-black font-black uppercase rounded-xl hover:bg-cyan-500 hover:text-white transition-all">执行搜索</button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                    {users.length === 0 && <div className="text-center py-20 text-zinc-700 uppercase font-bold tracking-widest italic text-xs">没有检测到匹配的意识特征</div>}
                    {users.map(u => (
                        <div key={u.id} className="flex justify-between items-center p-6 bg-zinc-900/30 border border-zinc-900 hover:border-zinc-700 transition-all rounded-2xl group">
                            <div>
                                <div className="text-white font-black text-lg tracking-tight mb-1">{u.username} <span className="text-[10px] text-zinc-700 ml-2">#ID_{u.id}</span></div>
                                <div className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">首次记录时间: {new Date(u.created_at).toLocaleString()}</div>
                            </div>
                            <div className="flex gap-3 scale-95 origin-right group-hover:scale-100 transition-transform">
                                <button
                                    onClick={() => handleReset(u.id, u.username)}
                                    className="px-4 py-2 border border-yellow-900/50 text-yellow-600 hover:bg-yellow-600 hover:text-white rounded-lg text-[10px] font-black uppercase transition-all"
                                >
                                    重置密码 (123456)
                                </button>
                                <button
                                    onClick={() => handleDelete(u.id, u.username)}
                                    className="px-4 py-2 border border-red-900/50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg text-[10px] font-black uppercase transition-all"
                                >
                                    彻底抹除
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
