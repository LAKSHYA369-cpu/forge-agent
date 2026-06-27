import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { systemInstruction, userPrompt, openRouterKey, useJson, model } = await request.json();

    if (!openRouterKey) {
      return NextResponse.json({ error: "Missing OpenRouter API Key" }, { status: 400 });
    }

    const selectedModel = model || "meta-llama/llama-3.3-70b-instruct";

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openRouterKey}`,
        'HTTP-Referer': 'https://vercel.com',
        'X-Title': 'Forge-Agent Studio Core v11'
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.15,
        response_format: useJson ? { type: "json_object" } : undefined
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `OpenRouter execution error: ${errText}` }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();
    
    if (!content) {
      throw new Error("Empty completion payload received from model.");
    }

    return NextResponse.json({ content });

  } catch (error: any) {
    return NextResponse.json({ error: `Agent Proxy Failure: ${error.message}` }, { status: 500 });
  }
}
