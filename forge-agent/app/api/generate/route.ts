import { NextResponse } from 'next/server';
import JSZip from 'jszip';
// @ts-ignore
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
// ... (leave the rest of the code exactly the same)
  try {
    const { prompt, userEmail, githubToken, repoName } = await request.json();

    if (!prompt || !userEmail) {
      return NextResponse.json({ error: "Missing Email or Prompt!" }, { status: 400 });
    }

    // Call Google's Free AI Model
    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `Act as an expert developer. Create a complete application based on this request: "${prompt}".
                  Return your entire response matching this exact JSON format layout:
                  {
                    "files": [
                      { "path": "index.html", "content": "<html>content</html>" },
                      { "path": "README.md", "content": "# Readme Content" }
                    ]
                  }` 
          }] 
        }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const aiData = await aiResponse.json();
    const rawJsonText = aiData.candidates[0].content.parts[0].text;
    const structuredPayload = JSON.parse(rawJsonText);

    // Create the ZIP file in computer memory
    const zip = new JSZip();
    structuredPayload.files.forEach((file: any) => {
      zip.file(file.path, file.content);
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

    // Send the Email with the Attached Zip
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: userEmail,
      subject: `🚀 ForgeAgent Project: ${repoName || 'Your App'}`,
      text: `Your app has been built successfully!\n\nPrompt: "${prompt}"\n\nFind your complete source code files attached inside the .zip asset.`,
      attachments: [{ filename: `${repoName || 'project'}.zip`, content: zipBuffer }]
    });

    // Upload to GitHub directly if a Developer Token was provided
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
        for (const file of structuredPayload.files) {
          const base64Content = Buffer.from(file.content).toString('base64');
          // We extract the user username directly from the token profile
          const userProfileRes = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `token ${githubToken}`, 'User-Agent': 'ForgeAgent' }
          });
          const userProfile = await userProfileRes.json();

          await fetch(`https://api.github.com/repos/${userProfile.login}/${repoName}/contents/${file.path}`, {
            method: 'PUT',
            headers: {
              'Authorization': `token ${githubToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'ForgeAgent'
            },
            body: JSON.stringify({
              message: `Added ${file.path}`,
              content: base64Content
            })
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
