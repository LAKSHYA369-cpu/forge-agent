'use client';
import React, { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [email, setEmail] = useState('');
  const [repoName, setRepoName] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [status, setStatus] = useState('System Operational // Awaiting Blueprint Engine inputs.');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('📡 Initiating Handshake with High-Speed Inference Core...');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, userEmail: email, repoName, githubToken })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatus(`✨ RUN COMPLETED SUCCESSFULLY! Packaged ${data.count || 0} files. Check your inbox right now!`);
        setPrompt('');
      } else {
        setStatus(`❌ Failure Logged: ${data.error || 'Unknown communication exception occurred.'}`);
      }
    } catch (err: any) {
      setStatus(`❌ Interface Network Layer Blocked: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: '#0b0f19', color: '#f3f4f6', minHeight: '100vh', fontFamily: 'monospace', padding: '40px 20px' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto', background: '#111827', padding: '35px', borderRadius: '12px', border: '1px solid #374151', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
          <span style={{ color: '#10b981', fontSize: '20px' }}>●</span>
          <h1 style={{ color: '#38bdf8', fontSize: '24px', fontWeight: 'bold', margin: 0, letterSpacing: '-0.025em' }}>FORGE-AGENT AUTOMATION OS v3.0</h1>
        </div>
        <p style={{ color: '#9ca3af', fontSize: '13px', marginTop: '0', '../../': '25px' }}>
          Strict autonomous full-stack orchestration layout engine powered via Llama 3.3 Core logic frameworks.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '6px' }}>Delivery Destination Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" style={{ width: '100%', padding: '12px', background: '#030712', border: '1px solid #4b5563', borderRadius: '6px', color: '#fff', fontSize: '14px' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '6px' }}>Git Token (Optional)</label>
              <input type="password" value={githubToken} onChange={e => setGithubToken(e.target.value)} placeholder="ghp_xxxxxxxx" style={{ width: '100%', padding: '12px', background: '#030712', border: '1px solid #4b5563', borderRadius: '6px', color: '#fff', fontSize: '14px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '6px' }}>Target Repository Title</label>
              <input type="text" value={repoName} onChange={e => setRepoName(e.target.value)} placeholder="automated-app-output" style={{ width: '100%', padding: '12px', background: '#030712', border: '1px solid #4b5563', borderRadius: '6px', color: '#fff', fontSize: '14px' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '6px' }}>Structural Project Prompts Specification</label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} required rows={6} placeholder="State structural properties, features, pages, rules or layout styles required..." style={{ width: '100%', padding: '12px', background: '#030712', border: '1px solid #4b5563', borderRadius: '6px', color: '#fff', fontSize: '14px', lineHeight: '1.5', resize: 'none' }} />
          </div>

          <button type="submit" disabled={loading} style={{ background: loading ? '#4b5563' : '#38bdf8', color: '#111827', fontWeight: 'bold', padding: '14px', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', textTransform: 'uppercase', transition: 'background 0.2s' }}>
            {loading ? 'Executing Synthesis Core Operations...' : 'Compile, Package & Transmit System Code'}
          </button>
        </form>

        <div style={{ marginTop: '25px', padding: '15px', background: '#030712', borderRadius: '6px', border: '1px solid #374151' }}>
          <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>System Operational Feedback Telemetry</div>
          <div style={{ color: loading ? '#38bdf8' : '#f3f4f6', fontSize: '13px', lineHeight: '1.4' }}>{status}</div>
        </div>

      </div>
    </div>
  );
}
