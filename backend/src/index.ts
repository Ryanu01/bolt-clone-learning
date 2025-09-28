import { GoogleGenAI } from "@google/genai";
import express from 'express';
import { getSystemPrompt, BASE_PROMT } from "./prompts.js";
import dotenv from "dotenv";
import { basePrompt as nodeBsePromt} from "./defaults/node.js";
import { basePrompt as reactBasePromt } from "./defaults/react.js";
import cors from 'cors';
dotenv.config();

const ai = new GoogleGenAI({});
const app = express();
app.use(express.json());
app.use(cors());
app.post('/template',  async (req, res) => {
  const prompt = req.body.prompt;
  const response =  await ai.models.generateContent({
    model: "gemini-2.5-pro",
    config: {
      systemInstruction: "Return either node or react based on what do you think this project should be. Only return a single word either 'node' or 'react'. Do not return anything extra" ,
    },    
    contents: [ {
      role: "user",
      parts: [{text: prompt}]
    }
    ],
  });
  const answer = response.text //either react or node
  if(answer == "react") {
    res.json({
      prompts: [BASE_PROMT, `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePromt}\n\n
        Here is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`],
      uiPrompts: [reactBasePromt]
    })
    return;
  }

  if(answer == "node") {
    res.json({
      prompts: [`Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${nodeBsePromt}\n\n
        Here is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`],
      uiPRompts: [nodeBsePromt]
    })
    return;
  } 

  console.log(answer);
  
  res.status(403).json({message: "You cant accesst this"})
  return;

})


app.post('/chat', async (req,res) => {
  const messages = req.body.messages;
  const response =  await ai.models.generateContent({
    model: "gemini-2.5-pro",
    config: {
      systemInstruction: getSystemPrompt(),
    },    
    contents: messages
  });

  

  res.json({
    response: response.text
  })
  
})

app.listen(3000);

