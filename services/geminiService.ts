
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY
});

export async function getAtmosphericMessage(event: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{
        role: "user",
        parts: [{
          text: `你是一个被困在无尽、黑暗、幽闭迷宫中的人的内心独白。
          请针对这个事件进行简短描述: "${event}"。
          要求：非常简短（最多10个汉字），诡异，心理恐怖，不要标点符号。使用中文。`
        }]
      }],
      config: {
        temperature: 0.9,
        topP: 0.8,
      }
    });
    return response.text?.trim() || "黑暗在注视着...";
  } catch (error) {
    console.error("Gemini error:", error);
    return "Something is wrong...";
  }
}
