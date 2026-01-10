
// services/cloudflare.ts
import * as Types from '../types';

export const cloudflare = {
    async auth(action: 'register' | 'login', data: any) {
        const res = await fetch(`/api/auth?action=${action}`, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || '认证失败');
        }
        return await res.json();
    },

    async getSave(userId: number) {
        const res = await fetch(`/api/save?userId=${userId}`);
        if (!res.ok) throw new Error('读取存档失败');
        return await res.json();
    },

    async putSave(userId: number, saveData: any) {
        const res = await fetch(`/api/save?userId=${userId}`, {
            method: 'POST',
            body: JSON.stringify({ saveData }),
            headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error('保存存档失败');
        return await res.json();
    },

    async getLeaderboard() {
        const res = await fetch('/api/leaderboard');
        if (!res.ok) throw new Error('获取英雄榜失败');
        return await res.json();
    },

    async submitRecord(data: { userId: number, clearTime: number, monsterKills: number, extraStats?: any }) {
        const res = await fetch('/api/leaderboard', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error('提交记录失败');
        return await res.json();
    },

    // --- ADMIN FUNCTIONS ---
    async adminListUsers(secret: string, search?: string) {
        const res = await fetch(`/api/admin?action=list${search ? `&search=${encodeURIComponent(search)}` : ''}`, {
            headers: { 'Authorization': secret }
        });
        if (!res.ok) throw new Error('获取用户列表失败');
        return await res.json();
    },

    async adminDeleteUser(secret: string, userId: number) {
        const res = await fetch('/api/admin?action=delete', {
            method: 'POST',
            body: JSON.stringify({ userId }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': secret
            }
        });
        if (!res.ok) throw new Error('删除用户失败');
        return await res.json();
    },

    async adminResetPassword(secret: string, userId: number, username: string) {
        const res = await fetch('/api/admin?action=reset_password', {
            method: 'POST',
            body: JSON.stringify({ userId, username }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': secret
            }
        });
        if (!res.ok) throw new Error('重置密码失败');
        return await res.json();
    }
};
