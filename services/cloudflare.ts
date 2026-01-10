
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
    }
};
