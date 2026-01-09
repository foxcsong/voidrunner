
import React from 'react';
import * as Types from '../types';

const ITEM_ICONS: Record<Types.ItemType, string> = {
    [Types.ItemType.FOOD]: '🍞',
    [Types.ItemType.WATER]: '💧',
    [Types.ItemType.FLASHLIGHT]: '🔦',
    [Types.ItemType.KNIFE]: '🔪',
    [Types.ItemType.GUN]: '🔫',
    [Types.ItemType.AMMO]: '🔋',
    [Types.ItemType.BATTERY]: '🪫',
    [Types.ItemType.KEY]: '🔑',
};

interface GameManualProps {
    onClose: () => void;
}

export const GameManual: React.FC<GameManualProps> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/95 z-[1000] flex flex-col p-8 overflow-y-auto animate-fade-in font-mono border-4 border-zinc-900 m-4 rounded-3xl shadow-2xl">
            <div className="max-w-3xl mx-auto w-full space-y-12 py-10">
                <header className="border-b border-zinc-800 pb-6">
                    <h2 className="text-4xl font-black tracking-tighter text-white uppercase italic">任务简报 // MISSION_DEBRIEF</h2>
                    <p className="text-zinc-500 text-xs tracking-widest mt-2 uppercase">项目代号: THE_INFINITE_VOID | 权限级别: 极密</p>
                </header>

                <section className="space-y-4">
                    <h3 className="text-cyan-400 font-bold tracking-widest uppercase border-l-4 border-cyan-600 pl-4 py-1">背景剧情 (Background Plot)</h3>
                    <p className="text-zinc-400 leading-relaxed text-sm">
                        2099年，世界线坍缩，物质世界开始向“虚空”（The Void）坠落。你作为一名致力于破解维度裂缝的科学学者，在一次由于计算失误引发的实验室爆炸中，被卷入了这道无法逃脱的迷宫。
                    </p>
                    <p className="text-zinc-400 leading-relaxed text-sm">
                        这不再是你熟悉的实验室，而是虚空折叠出的绝望迷廊。这里的物理规则已经扭曲，时间失去了意义，唯有恐惧在阴影中蠕动。
                    </p>
                </section>

                <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h3 className="text-yellow-500 font-bold tracking-widest uppercase border-l-4 border-yellow-700 pl-4 py-1">操作说明 (Instructions)</h3>
                        <ul className="text-zinc-400 text-xs space-y-3">
                            <li><span className="text-white font-bold">● 移动 (Move)：</span> 鼠标点击或触摸地面。PC端可用 <span className="bg-zinc-800 px-1 border border-zinc-700">WASD</span>，<span className="bg-zinc-800 px-1 border border-zinc-700">Shift</span> 疾跑。</li>
                            <li><span className="text-white font-bold">● 互动 (Interact)：</span> 靠近并点击补给箱、怪物或关口。</li>
                            <li><span className="text-white font-bold">● 背包 (Inventory)：</span> 点击左侧汉堡图标打开。点击物品使用或装备（装备后点击底部栏位可使用）。</li>
                        </ul>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-red-500 font-bold tracking-widest uppercase border-l-4 border-red-700 pl-4 py-1">生存法则 (Survival)</h3>
                        <ul className="text-zinc-400 text-xs space-y-3">
                            <li><span className="text-white font-bold">● 生命 (HP)：</span> 触碰怪物或极度饥饿/脱水时扣除。归零即死亡。</li>
                            <li><span className="text-white font-bold">● 资源 (Resource)：</span> 需时刻关注饥饿(绿)与口渴(蓝)。下降至零将迅速损耗生命。</li>
                            <li><span className="text-white font-bold">● 自动回血：</span> 饥饿与口渴均保持在 <span className="text-green-500">85% 以上</span>时，受损的生命将自动恢复。</li>
                        </ul>
                    </div>
                </section>

                <section className="bg-zinc-900/40 p-6 rounded-2xl border border-zinc-800">
                    <h3 className="text-cyan-500 font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
                        <span>通关目标:</span>
                        <span className="text-xl">🔑 x 2</span>
                    </h3>
                    <p className="text-zinc-500 text-[10px] leading-relaxed">
                        你必须收集 <span className="text-white">2 把虚空钥匙</span> 才能解锁出口处的能量门。钥匙隐藏在迷宫的随机补给箱中，或由强大的守护怪物持有。祝你好运，愿理智与你同在。
                    </p>
                </section>

                <footer className="pt-6 flex justify-center">
                    <button
                        onClick={onClose}
                        className="px-20 py-4 bg-white text-black font-black uppercase tracking-[0.4em] rounded-xl active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                    >
                        接受任务 (Accept)
                    </button>
                </footer>
            </div>
        </div>
    );
};
