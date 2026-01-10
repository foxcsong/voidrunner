
import React from 'react';
import * as Types from '../types';

interface GameManualProps {
    onClose: () => void;
}

export const GameManual: React.FC<GameManualProps> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/95 z-[1000] flex flex-col p-8 overflow-y-auto animate-fade-in font-mono border-4 border-zinc-900 m-4 rounded-3xl shadow-2xl custom-scrollbar">
            <div className="max-w-3xl mx-auto w-full space-y-12 py-10">
                <header className="border-b border-zinc-800 pb-6">
                    <h2 className="text-4xl font-black tracking-tighter text-white uppercase italic">虚空生存档案 // VOID_SURVIVAL_DATA</h2>
                    <p className="text-zinc-500 text-xs tracking-widest mt-2 uppercase">项目代号: THE_INFINITE_VOID | 协议级别: 绝对保密</p>
                </header>

                <section className="space-y-4">
                    <h3 className="text-cyan-400 font-bold tracking-widest uppercase border-l-4 border-cyan-600 pl-4 py-1">操作终端 (Control Terminal)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <h4 className="text-white text-xs font-bold uppercase italic tracking-wider">● 桌面端 (PC)</h4>
                            <ul className="text-zinc-500 text-[11px] space-y-1.5 list-disc pl-4">
                                <li><span className="text-zinc-300">移动：</span> 使用 <span className="text-white border border-zinc-800 bg-zinc-900 px-1 rounded">WASD</span> 或鼠标点击地面。</li>
                                <li><span className="text-zinc-300">奔跑：</span> 按住 <span className="text-white border border-zinc-800 bg-zinc-900 px-1 rounded">Shift</span> 键进入疾跑状态。</li>
                                <li><span className="text-zinc-300">战斗/交互：</span> 鼠标点击目标（补给箱/怪物）。</li>
                            </ul>
                        </div>
                        <div className="space-y-2">
                            <h4 className="text-white text-xs font-bold uppercase italic tracking-wider">● 移动端 (Mobile)</h4>
                            <ul className="text-zinc-500 text-[11px] space-y-1.5 list-disc pl-4">
                                <li><span className="text-zinc-300">基础移动：</span> 触摸屏幕任意位置。</li>
                                <li><span className="text-zinc-300">极限疾跑：</span> <span className="text-yellow-500 font-bold italic">双击屏幕并保持拖拽</span>。</li>
                                <li><span className="text-zinc-300">物资管理：</span> 点击右上角列表图标打开背包。</li>
                            </ul>
                        </div>
                    </div>
                </section>

                <section className="space-y-6">
                    <h3 className="text-red-500 font-bold tracking-widest uppercase border-l-4 border-red-700 pl-4 py-1">生存状态监测 (Physiological Monitoring)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
                                <span className="text-white font-bold text-xs">生命脉冲 (HP)</span>
                            </div>
                            <p className="text-[10px] text-zinc-500 leading-relaxed">
                                代表当前的意识稳定性。受损方式：遭受怪物攻击、极端饥饿或脱水。归零意味着被虚空永久同化。
                            </p>
                        </div>
                        <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-3 h-3 bg-green-500 rounded-full" />
                                <span className="text-white font-bold text-xs">能量储备 (Hunger)</span>
                            </div>
                            <p className="text-[10px] text-zinc-500 leading-relaxed">
                                维持躯体活动的能量。可通过 <span className="text-zinc-300 italic">面包、食物</span> 补充。归零后将开始持续扣除生命。
                            </p>
                        </div>
                        <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                                <span className="text-white font-bold text-xs">体液浓缩 (Thirst)</span>
                            </div>
                            <p className="text-[10px] text-zinc-500 leading-relaxed">
                                神经信号的载体。可通过 <span className="text-zinc-300 italic">饮用水</span> 补充。脱水状态会导致更加剧烈的健康恶化。
                            </p>
                        </div>
                    </div>
                </section>

                <section className="space-y-4 bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800">
                    <h3 className="text-yellow-500 font-bold tracking-widest uppercase flex items-center gap-2 text-sm italic">
                        ⚡ 生存交互逻辑 // INTERACTION_LOGIC
                    </h3>
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <div className="w-1 bg-yellow-600 rounded-full opacity-50" />
                            <p className="text-[11px] text-zinc-400 leading-relaxed">
                                <span className="text-white font-bold">● 疾跑代价：</span> 奔跑模式下，能量(饥饿)与体液(口渴)的下降速度将 <span className="text-yellow-500 font-bold italic">大幅加快</span>。请合理分配体能。
                            </p>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-1 bg-green-600 rounded-full opacity-50" />
                            <p className="text-[11px] text-zinc-400 leading-relaxed">
                                <span className="text-white font-bold">● 超感官回血：</span> 当能量与体液同时保持在 <span className="text-green-500 font-bold italic">85% 以上</span> 时，受损的生命脉冲将获得缓慢的自动恢复。
                            </p>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-1 bg-red-600 rounded-full opacity-50" />
                            <p className="text-[11px] text-zinc-400 leading-relaxed">
                                <span className="text-white font-bold">● 崩溃临界点：</span> 一旦某个数值降至 0，你的生命上限将持续受创。多项数值归零会叠加惩罚。
                            </p>
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <h3 className="text-orange-500 font-bold tracking-widest uppercase border-l-4 border-orange-700 pl-4 py-1">虚空武装 (Void Arsenal)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-zinc-900 to-black p-5 rounded-xl border border-zinc-800 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-5 text-[8px] font-black uppercase">CLOSE_RANGE</div>
                            <h4 className="text-white font-bold text-xs mb-3 flex items-center gap-2">🔪 战术匕首</h4>
                            <p className="text-[10px] text-zinc-500 leading-relaxed mb-3">无声的撕裂者。通过不断打击怪物，虽然有损耗风险，但在缺乏后续补给时是唯一的护身符。</p>
                            <div className="text-[8px] text-zinc-600 uppercase tracking-tighter">特点: 无需弹药 | 攻击快速 | 消耗耐久</div>
                        </div>
                        <div className="bg-gradient-to-br from-zinc-900 to-black p-5 rounded-xl border border-zinc-800 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-5 text-[8px] font-black uppercase">LONG_RANGE</div>
                            <h4 className="text-white font-bold text-xs mb-3 flex items-center gap-2">🔫 虚空手枪</h4>
                            <p className="text-[10px] text-zinc-500 leading-relaxed mb-3">空间扭曲武器。能瞬间蒸发远处的阴影。必须时刻留意“备用弹夹”的库存数量。</p>
                            <div className="text-[8px] text-zinc-600 uppercase tracking-tighter">特点: 射程优秀 | 威力巨大 | 依赖补给</div>
                        </div>
                    </div>
                </section>

                <footer className="pt-10 flex flex-col items-center gap-4">
                    <div className="text-zinc-600 text-[9px] uppercase tracking-widest animate-pulse italic">
                        一旦进入深层虚空，所有通信链路将断开。愿理智引导你的脚步。
                    </div>
                    <button
                        onClick={onClose}
                        className="px-24 py-5 bg-white text-black font-black uppercase tracking-[0.5em] rounded-2xl active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.15)] hover:bg-zinc-200"
                    >
                        建立连接 (Connect)
                    </button>
                </footer>
            </div>
        </div>
    );
};
