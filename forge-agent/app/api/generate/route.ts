import { NextResponse } from 'next/server';
import JSZip from 'jszip';
// @ts-ignore
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { prompt, userEmail, githubToken, repoName } = await request.json();

    if (!prompt || !userEmail) {
      return NextResponse.json({ error: "Missing required inputs: Prompt or Email." }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "Vercel environment key GROQ_API_KEY is not configured." }, { status: 500 });
    }

    // Call Groq's high-speed endpoint using Llama 3.3 70B
    const aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{
          role: "user",
          content: `You are an expert full-stack developer. Build a complete, working application structure based on this request: "${prompt}".
                  Provide a complete production layout containing actual code logic. 
                  Respond with ONLY a raw, valid JSON object matching this structure with no markdown or wrap text:
                  {
                    "files": [
                      { "path": "index.html", "content": "string code..." },
                      { "path": "README.md", "content": "setup markdown info..." }
                    ]
                  }`
        }],
        temperature: 0.1,
        response_format: { type: "json_object" } // Enforces strict valid JSON data formatting
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      return NextResponse.json({ error: `Groq Interface Error: ${errorText}` }, { status: 500 });
    }

    const aiData = await aiResponse.json();
    const rawJsonText = aiData.choices[0].message.content.trim();
    const structuredPayload = JSON.parse(rawJsonText);

    const zip = new JSZip();
    structuredPayload.files.forEach((file: any) => {
      const cleanPath = file.path.replace(/^(\.\.\/|\/)+/, '');
      zip.file(cleanPath, file.content);
    });
    
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

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
      subject: `📦 ForgeAgent Compiled Asset Pack`,
      text: `Project compiled cleanly via Llama-3.3 Core Engine!\nPrompt: "${prompt}"`,
      attachments: [{ filename: `project-source.zip`, content: zipBuffer }]
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: `Execution Exception: ${error.message}` }, { status: 500 });
  }
}
