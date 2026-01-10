
import { GoogleGenAI } from "@google/genai";

const getApiKey = () => {
  try {
    return (process.env as any).GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY || "";
  } catch {
    return "";
  }
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

export interface AILayout {
  monsters: { x: number, y: number }[];
  chests: {
    x: number,
    y: number,
    items: { type: string, count?: number, durability?: number }[]
  }[];
}

export async function generateLayout(emptyCells: { x: number, y: number }[], deadEnds: { x: number, y: number }[]): Promise<AILayout | null> {
  if (!getApiKey()) return null;

  try {
    const prompt = `你是一个地牢设计大师。根据提供的坐标，决定怪物和宝箱的布局。
    可用空地坐标: ${JSON.stringify(emptyCells.slice(0, 100))} (截断前100个)
    死胡同坐标: ${JSON.stringify(deadEnds)}
    
    要求：
    1. 在死胡同优先放置宝箱，总数约5-8个。
    2. 在空地放置怪物，总数约8-12个，确保难度曲线合理。
    3. 宝箱物品类型仅限: FOOD, WATER, FLASHLIGHT, KNIFE, GUN, AMMO, BATTERY。
    4. 特别注意：整个迷宫只能有一个 GUN，但可以有多个 AMMO。GUN 必须放置在距离起始位置 (1.5, 1.5) 5-10 个单位的宝箱中，以帮助玩家在早期生存，但不能在确切的起始位置。
    5. 严格返回 JSON 格式，不要包含 Markdown 代码块，不要有任何多余文字。
    格式: {"monsters": [{"x": number, "y": number}, ...], "chests": [{"x": number, "y": number, "items": [{"type": "ITEM_TYPE", "count": 12}, ...]}]}`;

    const result = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.1,
      }
    });

    const text = result.text?.replace(/```json|```/g, '').trim();
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("AI Layout Generation Error:", error);
    return null;
  }
}

// 废弃原有的文本回复功能，改为返回固定占位或简单处理
export async function getAtmosphericMessage(event: string) {
  const prompt = `你是一个深沉、神秘且带有克苏鲁色彩的旁白。
根据玩家当前遇到的情况："${event}"
请给出一句简短（20字以内）、富有氛围感且令人不安的独白。直接返回文字，不要有引号。`;

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    return result.text?.trim() || "虚空中回荡着无法理解的低语...";
  } catch (e) {
    return "虚空中回荡着无法理解的低语...";
  }
}

export async function generateVictorySpeech(time: number, kills: number): Promise<string> {
  const prompt = `你是一个深沉、神秘且带有克苏鲁色彩的旁白。
玩家刚刚成功逃离了“无尽虚空”迷宫。
统计数据：用时 ${time} 秒，击杀虚空生物 ${kills} 只。
请根据这些数据写一段简短的撤离评语（50字以内）。
如果击杀很多，称赞其无情的收割；如果用时极短，惊叹其超越凡人的理智或运气。
要求：语气冷峻、神秘，具有史诗感。直接输出内容。`;

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    return result.text?.trim() || "你逃离了，但虚空的阴影将永远留在你的灵魂深处。";
  } catch (e) {
    return "你逃离了，但虚空的阴影将永远留在你的灵魂深处。";
  }
}
