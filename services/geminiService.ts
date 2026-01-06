
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
    3. 宝箱物品类型仅限: FOOD, WATER, FLASHLIGHT, KNIFE, GUN。
    4. 严格返回 JSON 格式，不要包含 Markdown 代码块，不要有任何多余文字。
    格式: {"monsters": [{"x": number, "y": number}, ...], "chests": [{"x": number, "y": number, "items": [{"type": "ITEM_TYPE", "count": 10}, ...]}]}`;

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
  return "黑暗在注视着...";
}
