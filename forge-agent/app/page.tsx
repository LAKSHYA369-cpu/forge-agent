'use client';
import React, { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [email, setEmail] = useState('');
  const [repoName, setRepoName] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [status, setStatus] = useState('Idle');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('Generating Code Files with AI...');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, userEmail: email, repoName, githubToken })
      });

      if (res.ok) {
        setStatus('✨ Success! Check your email and GitHub account right now!');
      } else {
        setStatus('❌ Compilation Error. Double check your settings keys.');
      }
    } catch (err) {
      setStatus('❌ Network error processing your code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: '#090d16', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif', padding: '40px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', background: '#111827', padding: '30px', borderRadius: '12px', border: '1px solid #1f2937' }}>
        <h1 style={{ color: '#2dd4bf', marginTop: 0, marginBottom: '20px' }}>🤖 ForgeAgent Panel</h1>
        <p style={{ color: '#9ca3af', fontSize: '14px' }}>Specify what you want to build. The agent compiles it, packages a .zip, and sends it out instantly.</p>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '5px' }}>Your Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="yourname@gmail.com" style={{ width: '100%', padding: '10px', background: '#030712', border: '1px solid #374151', borderRadius: '6px', color: '#fff' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '5px' }}>GitHub Personal Access Token (Optional)</label>
            <input type="password" value={githubToken} onChange={e => setGithubToken(e.target.value)} placeholder="ghp_yourGitHubTokenGoesHere" style={{ width: '100%', padding: '10px', background: '#030712', border: '1px solid #374151', borderRadius: '6px', color: '#fff' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '5px' }}>Desired Repository Name (Optional)</label>
            <input type="text" value={repoName} onChange={e => setRepoName(e.target.value)} placeholder="my-awesome-game" style={{ width: '100%', padding: '10px', background: '#030712', border: '1px solid #374151', borderRadius: '6px', color: '#fff' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '5px' }}>Project Blueprint Instructions</label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} required rows={4} placeholder="e.g., Build a complete space invader game inside a single HTML file with cool retro colors..." style={{ width: '100%', padding: '10px', background: '#030712', border: '1px solid #374151', borderRadius: '6px', color: '#fff', resize: 'none' }} />
          </div>

          <button type="submit" disabled={loading} style={{ background: '#2dd4bf', color: '#030712', fontWeight: 'bold', padding: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px' }}>
            {loading ? 'Processing Workspace...' : 'Compile & Deliver Everything'}
          </button>
        </form>

        <div style={{ marginTop: '20px', padding: '15px', background: '#030712', borderRadius: '6px', border: '1px solid #1f2937', fontSize: '14px' }}>
          <strong>System Engine Status:</strong> <span style={{ color: '#2dd4bf' }}>{status}</span>
        </div>
      </div>
    </div>
  );
}