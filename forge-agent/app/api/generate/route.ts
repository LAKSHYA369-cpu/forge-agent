import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { systemInstruction, userPrompt, openRouterKey, useJson } = await request.json();

    if (!openRouterKey) {
      return NextResponse.json({ error: "Missing OpenRouter API Key" }, { status: 400 });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openRouterKey}`,
        'HTTP-Referer': 'https://vercel.com',
        'X-Title': 'Forge-Agent Workspace v6'
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct",
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
      return NextResponse.json({ error: `OpenRouter error: ${errText}` }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    return NextResponse.json({ content });

  } catch (error: any) {
    return NextResponse.json({ error: `Agent Proxy Failure: ${error.message}` }, { status: 500 });
  }
}
