import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();
const ai = new GoogleGenAI({});
async function main() {
    const response = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: "Explain how AI works",
    });
    for await (const chunk of response) {
        console.log(chunk.text);
    }
}
await main();
//# sourceMappingURL=index.js.map