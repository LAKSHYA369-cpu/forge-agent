'use client';
import React, { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [email, setEmail] = useState('');
  const [repoName, setRepoName] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [status, setStatus] = useState('System Idle - Ready for Blueprint Input');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Smooth step-by-step UI loading feedback
    setStatus('📡 Connecting to Frontier AI Core...');
    
    setTimeout(() => {
      setStatus('🧠 Analyzing request architecture & generating code tree files...');
    }, 2500);

    setTimeout(() => {
      setStatus('⚡ Compiling complete code text lines into safe in-memory binary code...');
    }, 6500);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, userEmail: email, repoName, githubToken })
      });

      if (res.ok) {
        setStatus('✨ SUCCESS! Your compiled codebase has been emailed and pushed to GitHub!');
        setPrompt('');
      } else {
        const data = await res.json();
        setStatus(`❌ Compile Error: ${data.error || 'Check environment configuration configurations.'}`);
      }
    } catch (err) {
      setStatus('❌ Network layer exception occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: '#070a13', color: '#f3f4f6', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', padding: '40px 20px' }}>
      <div style={{ maxWidth: '650px', margin: '0 auto', background: '#0f172a', padding: '40px', borderRadius: '16px', border: '1px solid #1e293b', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', animate: 'pulse 2s infinite' }}></div>
          <h1 style={{ color: '#38bdf8', fontSize: '28px', fontWeight: '800', margin: 0, tracking: '-0.05em' }}>FORGE//AGENT v2.0</h1>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.5', marginTop: '0', marginBottom: '30px' }}>
          An autonomous software development workspace. Input your requirements below. The agent handles total full-stack synthesis, code validation, zip archivals, and delivery.
        </p>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Target Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="developer@example.com" style={{ width: '100%', padding: '12px', background: '#020617', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px', transition: 'border-color 0.2s' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>GitHub Developer Token (Optional)</label>
              <input type="password" value={githubToken} onChange={e => setGithubToken(e.target.value)} placeholder="ghp_xxxx" style={{ width: '100%', padding: '12px', background: '#020617', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>GitHub Repository Name</label>
              <input type="text" value={repoName} onChange={e => setRepoName(e.target.value)} placeholder="my-automated-repo" style={{ width: '100%', padding: '12px', background: '#020617', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Application Blueprint Specification</label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} required rows={5} placeholder="Describe your web application, script tool, chrome extension, or game in deep structural detail..." style={{ width: '100%', padding: '12px', background: '#020617', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px', lineHeight: '1.6', resize: 'none' }} />
          </div>

          <button type="submit" disabled={loading} style={{ background: loading ? '#475569' : '#38bdf8', color: '#0f172a', fontWeight: '700', padding: '14px', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.025em', transition: 'background-color 0.2s' }}>
            {loading ? 'Synthesizing Project Blueprint...' : 'Compile & Dispatch Application Source'}
          </button>
        </form>

        <div style={{ marginTop: '25px', padding: '20px', background: '#020617', borderRadius: '8px', border: '1px solid #1e293b' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Agent Operational Log</div>
          <div style={{ color: loading ? '#38bdf8' : '#e2e8f0', fontSize: '14px', fontWeight: '500' }}>{status}</div>
        </div>
      </div>
    </div>
  );
}