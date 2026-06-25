import { NextResponse } from 'next/server';
import JSZip from 'jszip';
// @ts-ignore
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { prompt, userEmail, githubToken, repoName } = await request.json();

    if (!prompt || !userEmail) {
      return NextResponse.json({ error: "Missing Email or Prompt!" }, { status: 400 });
    }

    // Call Google's Free AI Model with Enhanced Engineering Instructions
    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `You are a Principal Software Engineer. Build a fully functional, complete application based on this request: "${prompt}".
                  
                  CRITICAL REQUIREMENT: 
                  - You must generate every single file required to run the application natively.
                  - Write total, complete code logic. Never write comments like "// rest of your code here" or truncate the code.
                  - Include complete configuration files, component styling, and a deep README.md detailing how to install dependencies and run it.

                  You must respond with ONLY a raw, valid JSON object matching this exact structure, with NO extra text before or after:
                  {
                    "files": [
                      { "path": "index.html", "content": "exact code string..." },
                      { "path": "README.md", "content": "setup markdown instructions..." }
                    ]
                  }` 
          }] 
        }],
        generationConfig: { 
          responseMimeType: "application/json",
          temperature: 0.2 // Lower temperature means smarter, more logical coding decisions
        }
      })
    });

    const aiData = await aiResponse.json();
    let rawJsonText = aiData.candidates[0].content.parts[0].text.trim();

    // FAILSAFE: Clean up the output if the LLM accidentally added markdown formatting back in
    if (rawJsonText.startsWith("```json")) {
      rawJsonText = rawJsonText.substring(7, rawJsonText.length - 3).trim();
    } else if (rawJsonText.startsWith("```")) {
      rawJsonText = rawJsonText.substring(3, rawJsonText.length - 3).trim();
    }

    const structuredPayload = JSON.parse(rawJsonText);

    if (!structuredPayload.files || !Array.isArray(structuredPayload.files)) {
      throw new Error("The AI did not return a valid file structure array.");
    }

    // Package the ZIP file in computer memory
    const zip = new JSZip();
    structuredPayload.files.forEach((file: any) => {
      // Clean path names to avoid malicious file generation paths
      const cleanPath = file.path.replace(/^(\.\.\/|\/)+/, '');
      zip.file(cleanPath, file.content);
    });
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Setup the Email Sender
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD 
      }
    });

    // Send the Email with the Attached Zip File
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: userEmail,
      subject: `📦 ForgeAgent Compiled Asset Pack: ${repoName || 'Workspace-Output'}`,
      text: `Your software workspace has been generated successfully!\n\nUser Input Prompt: "${prompt}"\n\nFind your complete production source files attached in the .zip archive.`,
      attachments: [{ filename: `${repoName || 'project-source'}.zip`, content: zipBuffer }]
    });

    // Upload to GitHub directly if a Personal Access Token was supplied
    if (githubToken && repoName) {
      const repoCreation = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ForgeAgent'
        },
        body: JSON.stringify({ name: repoName, private: true, auto_init: true })
      });

      if (repoCreation.ok) {
        // Fetch User login name natively using token profile data
        const userProfileRes = await fetch('https://api.github.com/user', {
          headers: { 'Authorization': `token ${githubToken}`, 'User-Agent': 'ForgeAgent' }
        });
        const userProfile = await userProfileRes.json();

        for (const file of structuredPayload.files) {
          const base64Content = Buffer.from(file.content).toString('base64');
          const cleanPath = file.path.replace(/^(\.\.\/|\/)+/, '');

          await fetch(`https://api.github.com/repos/${userProfile.login}/${repoName}/contents/${cleanPath}`, {
            method: 'PUT',
            headers: {
              'Authorization': `token ${githubToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'ForgeAgent'
            },
            body: JSON.stringify({
              message: `🤖 Autonomous Commit: Added ${cleanPath}`,
              content: base64Content
            })
          });
        }
      }
    }

    return NextResponse.json({ success: true, count: structuredPayload.files.length });
  } catch (error: any) {
    console.error("Backend Error Log:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}