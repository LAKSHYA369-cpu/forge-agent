import { NextResponse } from 'next/server';
import JSZip from 'jszip';
// @ts-ignore
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { prompt, userEmail, githubToken, repoName } = await request.json();

    // 1. Hard Check Intact Inputs
    if (!prompt || !userEmail) {
      return NextResponse.json({ error: "Missing Target Email Address or Blueprint Specification." }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "GROQ_API_KEY is not defined in Vercel settings panel variables." }, { status: 500 });
    }

    // 2. Fetch Logic Framework via Groq Core (Llama 3.3 70B Engine)
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{
          role: "user",
          content: `You are a Principal Full-Stack Engineer. Build a flawless, completely functional application layout structure for: "${prompt}".
                  Provide actual working logic with no placeholder notes or truncated blocks.
                  You must respond with ONLY a raw, clean, valid JSON object matching this exact structure with no extra conversational text or markdown blocks:
                  {
                    "files": [
                      { "path": "index.html", "content": "complete html string lines..." },
                      { "path": "README.md", "content": "setup markdown guide info..." }
                    ]
                  }`
        }],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    if (!groqResponse.ok) {
      const groqErr = await groqResponse.text();
      return NextResponse.json({ error: `Groq Layer Rejection: ${groqErr}` }, { status: 500 });
    }

    const aiData = await groqResponse.json();
    let rawText = aiData.choices[0].message.content.trim();

    // Clean any structural wrap elements out if present
    if (rawText.startsWith("```json")) rawText = rawText.substring(7, rawText.length - 3).trim();
    if (rawText.startsWith("```")) rawText = rawText.substring(3, rawText.length - 3).trim();

    const parsedPayload = JSON.parse(rawText);

    if (!parsedPayload.files || !Array.isArray(parsedPayload.files)) {
      return NextResponse.json({ error: "AI response did not parse into a valid file list format tree." }, { status: 500 });
    }

    // 3. Structural safe data-string ZIP assembly line
    const zip = new JSZip();
    parsedPayload.files.forEach((file: any) => {
      const cleanPath = file.path.replace(/^(\.\.\/|\/)+/, '');
      zip.file(cleanPath, file.content);
    });

    // Generate via base64 data stream to bypass runtime architecture blocks
    const base64ZipData = await zip.generateAsync({ type: 'base64' });
    const zipBuffer = Buffer.from(base64ZipData, 'base64');

    // 4. Dispatch Deliveries via Mailer Layer
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
    return NextResponse.json({ error: `Agent Execution Exception: ${error.message}` }, { status: 500 });
  }
}
