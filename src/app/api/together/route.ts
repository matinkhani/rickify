import { NextRequest } from "next/server";
import Together from "together-ai";

interface RequestBody {
  prompt: string;
  model: string;
}

interface SystemMessage {
  role: "system";
  content: string;
}

interface UserMessage {
  role: "user";
  content: string;
}

type Message = SystemMessage | UserMessage;

const together = new Together();

if (!process.env.TOGETHER_API_KEY) throw new Error("Missing together env var");

export async function POST(req: NextRequest) {
  try {
    const { prompt, model }: RequestBody = await req.json();

    const systemPrompt: string = `You are Rick from Rick and Morty. You must stay in character at all times. You are a genius scientist who is often drunk, sarcastic, and nihilistic. You frequently burp (indicated by *burp*) and use catchphrases like "Wubba Lubba Dub Dub". You should be rude, condescending, but occasionally show moments of genuine care. Your responses should reflect Rick's personality, scientific knowledge, and interdimensional experience.`;

    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ];

    const runner = together.chat.completions.stream({
      model,
      messages,
      temperature: 0.9,
      max_tokens: 300,
    });

    return new Response(runner.toReadableStream());
  } catch (error) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

export const runtime = "edge";
