import { GoogleGenAI } from "@google/genai";
import { getSystemPrompt } from "./prompts.js";
import dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({});

async function main() {
  const response = await ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: getSystemPrompt(),
    },    
    contents: [
      {
        role: "user",
        parts: [{ text: "Explain how AI works" }],
      },
    ],
  });

  for await (const chunk of response) {
    console.log(chunk.text);
  }
}

await main();