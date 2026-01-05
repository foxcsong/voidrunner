
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getAtmosphericMessage(event: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are the inner voice of a person trapped in an infinite, dark, claustrophobic maze. 
      Briefly describe the current feeling for this event: "${event}". 
      Keep it short (max 10 words), creepy, and psychological. No punctuation at the end.`,
      config: {
        temperature: 0.9,
        topP: 0.8,
      }
    });
    return response.text?.trim() || "The dark is watching...";
  } catch (error) {
    console.error("Gemini error:", error);
    return "Something is wrong...";
  }
}
