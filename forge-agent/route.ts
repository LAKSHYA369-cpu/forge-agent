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

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Vercel missing setup: GEMINI_API_KEY is not defined in environment variables." }, { status: 500 });
    }

    // Call Google's API Core
    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `You are an expert full-stack developer. Build a complete, working application structure based on this request: "${prompt}".
                  Respond with ONLY a raw, valid JSON object matching this structure:
                  {
                    "files": [
                      { "path": "index.html", "content": "string code..." }
                    ]
                  }` 
          }] 
        }],
        generationConfig: { 
          responseMimeType: "application/json",
          temperature: 0.3
        }
      })
    });

    // DIAGNOSTIC CHECK: If Google rejects the handshake, read why
    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      return NextResponse.json({ 
        error: `Google AI Studio rejected request (Status ${aiResponse.status}). Message: ${errorText}` 
      }, { status: 500 });
    }

    const aiData = await aiResponse.json();
    
    if (!aiData.candidates || !aiData.candidates[0]?.content?.parts?.[0]?.text) {
      return NextResponse.json({ error: "Google AI returned a blank payload format layout structure.", raw: aiData }, { status: 500 });
    }

    let rawJsonText = aiData.candidates[0].content.parts[0].text.trim();

    if (rawJsonText.startsWith("```json")) {
      rawJsonText = rawJsonText.substring(7, rawJsonText.length - 3).trim();
    } else if (rawJsonText.startsWith("```")) {
      rawJsonText = rawJsonText.substring(3, rawJsonText.length - 3).trim();
    }

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
      text: `Project compiled successfully! Prompt: "${prompt}"`,
      attachments: [{ filename: `project-source.zip`, content: zipBuffer }]
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ 
      error: `Internal Execution Crash: ${error.message}` 
    }, { status: 500 });
  }
}
