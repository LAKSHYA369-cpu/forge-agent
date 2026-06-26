import { NextResponse } from 'next/server';
import JSZip from 'jszip';
// @ts-ignore
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { prompt, userEmail, repoName } = await request.json();

    if (!prompt || !userEmail) {
      return NextResponse.json({ error: "Missing Target Email Address or Blueprint Specification." }, { status: 400 });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "OPENROUTER_API_KEY is missing in Vercel environment configurations." }, { status: 500 });
    }

    // 1. Fire Handshake with OpenRouter Endpoint (Llama 3.3 70B Core)
    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://vercel.com', // Required by OpenRouter rules
        'X-Title': 'Forge-Agent OS'
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct",
        messages: [{
          role: "user",
          content: `You are a Principal Software Engineer. Build a fully functional, complete application based on this request: "${prompt}".
                  Write absolute complete code logic lines. Never truncate code or use placeholder comments. Include complete configuration parameters.
                  You must respond with ONLY a raw, clean, valid JSON object matching this exact structure with no extra conversational text or markdown codeblocks:
                  {
                    "files": [
                      { "path": "index.html", "content": "complete html string lines..." },
                      { "path": "README.md", "content": "setup instructions..." }
                    ]
                  }`
        }],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    if (!openRouterResponse.ok) {
      const errText = await openRouterResponse.text();
      return NextResponse.json({ error: `OpenRouter Rejection Framework Logged: ${errText}` }, { status: 500 });
    }

    const aiData = await openRouterResponse.json();
    let rawText = aiData.choices[0].message.content.trim();

    if (rawText.startsWith("```json")) rawText = rawText.substring(7, rawText.length - 3).trim();
    if (rawText.startsWith("```")) rawText = rawText.substring(3, rawText.length - 3).trim();

    const parsedPayload = JSON.parse(rawText);

    if (!parsedPayload.files || !Array.isArray(parsedPayload.files)) {
      return NextResponse.json({ error: "AI structural response layout was invalid." }, { status: 500 });
    }

    // 2. Structural zip generation block via pure data serialization
    const zip = new JSZip();
    parsedPayload.files.forEach((file: any) => {
      const cleanPath = file.path.replace(/^(\.\.\/|\/)+/, '');
      zip.file(cleanPath, file.content);
    });

    const base64ZipData = await zip.generateAsync({ type: 'base64' });
    const zipBuffer = Buffer.from(base64ZipData, 'base64');

    // 3. Mailing Delivery Systems Core
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD 
      }
    });

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: userEmail,
      subject: `📦 ForgeAgent Generation Complete: ${repoName || 'Workspace-Output'}`,
      text: `Your requested workspace files have been compiled cleanly by the underlying agent engine.\n\nPrompt Blueprint Specification: "${prompt}"`,
      attachments: [{ filename: `${repoName || 'source-pack'}.zip`, content: zipBuffer }]
    });

    return NextResponse.json({ success: true, count: parsedPayload.files.length });
  } catch (error: any) {
    return NextResponse.json({ error: `Agent Core Process Failure: ${error.message}` }, { status: 500 });
  }
}
