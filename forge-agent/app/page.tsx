'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { WebContainer } from '@webcontainer/api';
import JSZip from 'jszip';
import { 
  Terminal as TerminalIcon, 
  Send, 
  Play, 
  RefreshCw, 
  Layers, 
  ClipboardList, 
  Code, 
  Check, 
  Eye, 
  FileCode, 
  Download, 
  Settings, 
  Github, 
  Chrome, 
  LogOut, 
  History, 
  FolderGit2, 
  Cpu
} from 'lucide-react';

// Initialize Client-Side Supabase Connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Step = 'IDLE' | 'PM_SPEC' | 'PM_APPROVE' | 'ARCHITECT_DESIGN' | 'ARCHITECT_APPROVE' | 'DEVELOPMENT' | 'TEST_RUNNING' | 'COMPLETED';

interface ProjectFile {
  path: string;
  content: string;
}

interface SavedProject {
  id: string;
  title: string;
  prompt: string;
  spec: string;
  architecture: string;
  files: ProjectFile[];
}

export default function Workspace() {
  const [session, setSession] = useState<any>(null);
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [repoName, setRepoName] = useState('my-automated-app');
  const [selectedModel, setSelectedModel] = useState('meta-llama/llama-3.3-70b-instruct');

  // Agent Pipeline States
  const [currentStep, setCurrentStep] = useState<Step>('IDLE');
  const [logs, setLogs] = useState<string[]>([]);
  const [pmSpec, setPmSpec] = useState<string>('');
  const [architectureLayout, setArchitectureLayout] = useState<string>('');
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'logs'>('logs');

  // Interactive revision and project list states
  const [feedback, setFeedback] = useState('');
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Browser Sandbox (WebContainer) State
  const [webcontainer, setWebcontainer] = useState<WebContainer | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [testOutput, setTestOutput] = useState<string>('');
  const [isBootingSandbox, setIsBootingSandbox] = useState(true);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Monitor Authentication Sessions
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
        fetchUserProjects(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
        fetchUserProjects(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // WebContainer initialization
  useEffect(() => {
    async function bootSandbox() {
      try {
        addLog("Booting sandboxed system WebContainer...");
        const instance = await WebContainer.boot();
        setWebcontainer(instance);
        setIsBootingSandbox(false);
        addLog("WebAssembly isolated browser sandbox operational.");
      } catch (err: any) {
        addLog(`Sandbox failed to load: ${err.message}`);
        setIsBootingSandbox(false);
      }
    }
    bootSandbox();
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // Profile data fetchers
  const fetchUserProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('openrouter_key').eq('id', userId).single();
    if (data?.openrouter_key) {
      setOpenRouterKey(data.openrouter_key);
    }
  };

  const fetchUserProjects = async (userId: string) => {
    const { data } = await supabase.from('projects').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setSavedProjects(data as SavedProject[]);
  };

  const saveUserProfileKey = async () => {
    if (!session) return;
    addLog("Updating profile configuration options...");
    await supabase.from('profiles').upsert({
      id: session.user.id,
      email: session.user.email,
      openrouter_key: openRouterKey
    });
    addLog("API credentials stored securely inside your Supabase profile.");
  };

  // OAuth Trigger Controls
  const handleOAuthLogin = async (provider: 'github' | 'google') => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin }
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // --- API Handshakes ---
  const callAgentAPI = async (systemInstruction: string, userPrompt: string, useJson: boolean = false) => {
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction, userPrompt, openRouterKey, useJson, model: selectedModel })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Execution turn failed.");
    return data.content;
  };

  const cleanAndParseJSON = (text: string) => {
    let raw = text.trim();
    if (raw.startsWith("```json")) raw = raw.substring(7, raw.length - 3).trim();
    else if (raw.startsWith("```")) raw = raw.substring(3, raw.length - 3).trim();
    try {
      return JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error("Could not parse agent's output.");
    }
  };

  // --- Multi-Agent Orchestration Pipeline ---
  const startPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openRouterKey || !prompt) {
      alert("Configure your API credentials and detail your app blueprint instructions.");
      return;
    }
    setCurrentStep('PM_SPEC');
    addLog("Connecting to Product Manager Agent...");
    setActiveTab('logs');

    try {
      const pmInstruction = `You are a Senior Product Manager. Build a complete Technical Specification Document in Markdown based on the user prompt. Detail layout, functional states, and assets.`;
      const spec = await callAgentAPI(pmInstruction, `Requirements: ${prompt}`);
      setPmSpec(spec);
      addLog("Product Manager Agent compiled specification draft.");
      setCurrentStep('PM_APPROVE');
    } catch (err: any) {
      addLog(`PM turn failed: ${err.message}`);
      setCurrentStep('IDLE');
    }
  };

  const handlePmReview = async (isApproved: boolean) => {
    if (!isApproved) {
      setCurrentStep('PM_SPEC');
      addLog("Revising specification layouts...");
      try {
        const spec = await callAgentAPI(`Update the specification based on feedback.`, `Spec:\n${pmSpec}\n\nFeedback:\n${feedback}`);
        setPmSpec(spec);
        setFeedback('');
        setCurrentStep('PM_APPROVE');
        addLog("PM specifications updated successfully.");
      } catch (err: any) {
        addLog(`Revision failed: ${err.message}`);
      }
      return;
    }

    // Move to Architecture Design
    setCurrentStep('ARCHITECT_DESIGN');
    addLog("Specification signed off. Initiating Software Architect Agent...");
    try {
      const design = await callAgentAPI(`Design the directories, tech stack, and DB schema. Output in markdown.`, `Specs:\n${pmSpec}`);
      setArchitectureLayout(design);
      addLog("Software Architect completed system mapping blueprints.");
      setCurrentStep('ARCHITECT_APPROVE');
    } catch (err: any) {
      addLog(`Architect failed: ${err.message}`);
      setCurrentStep('PM_APPROVE');
    }
  };

  const handleArchitectReview = async (isApproved: boolean) => {
    if (!isApproved) {
      setCurrentStep('ARCHITECT_DESIGN');
      addLog("Refining directory structures...");
      try {
        const design = await callAgentAPI(`Update architecture diagram based on feedback.`, `Architecture:\n${architectureLayout}\n\nFeedback:\n${feedback}`);
        setArchitectureLayout(design);
        setFeedback('');
        setCurrentStep('ARCHITECT_APPROVE');
        addLog("Architecture designs refined.");
      } catch (err: any) {
        addLog(`Architecture revision failed: ${err.message}`);
      }
      return;
    }

    runDevelopmentPipeline();
  };

  const runDevelopmentPipeline = async () => {
    setCurrentStep('DEVELOPMENT');
    addLog("System blueprint signed off. Launching Senior Developer Synthesis...");

    try {
      const devInstruction = `You are an expert Senior Fullstack Developer. Write fully functional, clean file logic structures matching the architectural design. Output strict JSON:
{
  "files": [
    { "path": "package.json", "content": "..." },
    { "path": "index.html", "content": "..." },
    { "path": "test.js", "content": "..." }
  ]
}`;
      const codeOutput = await callAgentAPI(devInstruction, `Write implementations based on this architecture:\n${architectureLayout}`, true);
      const parsed = cleanAndParseJSON(codeOutput);
      const projectFiles: ProjectFile[] = parsed.files;
      setFiles(projectFiles);
      setSelectedFile(projectFiles[0] || null);
      addLog("Developer synthesis completed.");

      if (webcontainer) {
        await mountFilesToSandbox(projectFiles);
        await runQALoop(projectFiles, 1);
      } else {
        await saveProjectToSupabase(projectFiles);
        setCurrentStep('COMPLETED');
      }
    } catch (err: any) {
      addLog(`Development Failure: ${err.message}`);
      setCurrentStep('ARCHITECT_APPROVE');
    }
  };

  const mountFilesToSandbox = async (filesToMount: ProjectFile[]) => {
    const tree: any = {};
    filesToMount.forEach(file => {
      const parts = file.path.split('/');
      let current = tree;
      parts.forEach((part, idx) => {
        if (idx === parts.length - 1) {
          current[part] = { file: { contents: file.content } };
        } else {
          if (!current[part]) current[part] = { directory: {} };
          current = current[part].directory;
        }
      });
    });
    await webcontainer!.mount(tree);
  };

  const runQALoop = async (currentFiles: ProjectFile[], attempt: number) => {
    if (attempt > 3) {
      addLog("Maximum autonomous debugging attempts exceeded. Spinning dev servers...");
      await startPreviewServer();
      return;
    }

    setCurrentStep('TEST_RUNNING');
    addLog(`[Refinement Run ${attempt}/3] Executing automated testing suites...`);

    try {
      const install = await webcontainer!.spawn('npm', ['install']);
      await install.exit;

      const test = await webcontainer!.spawn('npm', ['test']);
      let testLogs = '';
      test.output.pipeTo(new WritableStream({
        write(data) { testLogs += data; }
      }));
      const exitCode = await test.exit;
      setTestOutput(testLogs);

      if (exitCode === 0) {
        addLog("✨ All automated unit tests passed successfully!");
        await saveProjectToSupabase(currentFiles);
        await startPreviewServer();
      } else {
        addLog(`❌ Code failed unit testing constraints. Contacting QA Agent to auto-heal...`);
        const qaInstruction = `Analyze the test logs and patch the implementations. Output strict JSON files mapping. Logs:\n${testLogs}`;
        const patchText = await callAgentAPI(qaInstruction, `Files:\n${JSON.stringify(currentFiles)}`, true);
        const parsedPatch = cleanAndParseJSON(patchText);
        const patchedFiles = parsedPatch.files;

        setFiles(patchedFiles);
        setSelectedFile(patchedFiles[0] || null);
        await mountFilesToSandbox(patchedFiles);
        await runQALoop(patchedFiles, attempt + 1);
      }
    } catch (err: any) {
      addLog(`QA Automation Fault: ${err.message}. Saving progress.`);
      await saveProjectToSupabase(currentFiles);
      await startPreviewServer();
    }
  };

  const startPreviewServer = async () => {
    try {
      webcontainer!.on('port', (port, type, url) => {
        addLog(`Live Sandbox preview active at: ${url}`);
        setPreviewUrl(url);
        setActiveTab('preview');
        setCurrentStep('COMPLETED');
      });
      await webcontainer!.spawn('npm', ['run', 'start']);
    } catch (err: any) {
      addLog(`Server spin-up error: ${err.message}`);
      setCurrentStep('COMPLETED');
    }
  };

  const saveProjectToSupabase = async (projectFiles: ProjectFile[]) => {
    if (!session) return;
    addLog("Archiving workspace files state into your Supabase profile...");
    await supabase.from('projects').insert({
      user_id: session.user.id,
      title: repoName,
      prompt,
      spec: pmSpec,
      architecture: architectureLayout,
      files: projectFiles
    });
    fetchUserProjects(session.user.id);
  };

  const loadSavedProject = (project: SavedProject) => {
    setRepoName(project.title);
    setPrompt(project.prompt);
    setPmSpec(project.spec);
    setArchitectureLayout(project.architecture);
    setFiles(project.files);
    setSelectedFile(project.files[0] || null);
    setCurrentStep('COMPLETED');
    setActiveTab('code');
    addLog(`Loaded archived project: ${project.title}`);
  };

  const downloadClientZip = async () => {
    const zip = new JSZip();
    files.forEach(f => zip.file(f.path, f.content));
    const data = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(data);
    link.download = `${repoName}.zip`;
    link.click();
  };

  // --- RENDERING VIEWS ---

  // Logged-out Landing Page
  if (!session) {
    return (
      <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Decorative Grid Mesh */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

        <div className="max-w-2xl text-center space-y-6 z-10">
          <div className="inline-flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-full px-4 py-1.5 text-xs text-indigo-400 font-semibold mb-2">
            <Cpu size={14} className="animate-spin" />
            <span>AI Software Development Agent</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
            Compile Ideas Into <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400">Production Codebases</span>
          </h1>
          
          <p className="text-slate-400 text-sm leading-relaxed max-w-lg mx-auto">
            A professional multi-agent software engineering workspace. Generates, validates, and runs previews inside an isolated browser sandbox.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-6">
            <button 
              onClick={() => handleOAuthLogin('github')}
              className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-3 rounded-lg border border-slate-800 transition flex items-center justify-center gap-2 text-sm"
            >
              <Github size={18} /> Continue with GitHub
            </button>
            <button 
              onClick={() => handleOAuthLogin('google')}
              className="w-full sm:w-auto bg-white hover:bg-slate-100 text-slate-950 font-bold px-6 py-3 rounded-lg transition flex items-center justify-center gap-2 text-sm"
            >
              <Chrome size={18} /> Continue with Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active Multi-Agent Workspace UI
  return (
    <div className="h-screen w-screen bg-[#030712] text-slate-100 flex flex-col font-mono text-xs overflow-hidden select-none">
      
      {/* Top Workspace Header Controls */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center space-x-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="text-sm font-bold tracking-widest text-indigo-400 uppercase">FORGEAGENT OS // WORKSPACE</h1>
        </div>

        <div className="flex items-center space-x-4">
          <select 
            value={selectedModel} 
            onChange={e => setSelectedModel(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-3 py-1 text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B</option>
            <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
            <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
          </select>

          <input 
            type="password" 
            placeholder="OpenRouter Token" 
            value={openRouterKey} 
            onChange={e => setOpenRouterKey(e.target.value)} 
            className="bg-slate-950 border border-slate-800 rounded px-3 py-1 text-slate-300 w-44 focus:outline-none focus:border-indigo-500"
          />

          <button onClick={saveUserProfileKey} className="bg-slate-800 hover:bg-slate-700 font-bold text-slate-200 px-2 py-1 rounded">
            Save Key
          </button>

          <button onClick={handleLogout} className="p-1.5 rounded hover:bg-slate-800 text-slate-400" title="Log Out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main panel layout */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Side Controller Panel */}
        <div className="w-[380px] border-r border-slate-800 bg-slate-900/10 flex flex-col shrink-0 overflow-y-auto p-4 space-y-4">
          
          <form onSubmit={startPipeline} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs uppercase font-bold text-slate-400 tracking-wider">Application Blueprint instructions</label>
              <textarea 
                value={prompt} 
                onChange={e => setPrompt(e.target.value)} 
                rows={4} 
                disabled={currentStep !== 'IDLE'}
                placeholder="Detail what you would like to build..." 
                className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-xs leading-relaxed focus:outline-none focus:border-indigo-500 resize-none font-sans"
              />
            </div>
            {currentStep === 'IDLE' && (
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded text-xs tracking-wider uppercase transition">
                Build Application Workspace
              </button>
            )}
          </form>

          {/* Stepper Pipeline Indicators */}
          {currentStep !== 'IDLE' && (
            <div className="border border-slate-800 rounded p-4 bg-slate-950/40 space-y-3">
              <span className="text-[10px] uppercase text-slate-500 font-bold tracking-widest block">Active Operations Pipeline</span>
              <div className="space-y-2 text-slate-400">
                <div className={`flex items-center gap-2 ${currentStep === 'PM_SPEC' || currentStep === 'PM_APPROVE' ? 'text-indigo-400 font-bold' : ''}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-current" />
                  <span>PM Specification Mapping</span>
                </div>
                <div className={`flex items-center gap-2 ${currentStep === 'ARCHITECT_DESIGN' || currentStep === 'ARCHITECT_APPROVE' ? 'text-indigo-400 font-bold' : ''}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-current" />
                  <span>Architecture Structures Design</span>
                </div>
                <div className={`flex items-center gap-2 ${currentStep === 'DEVELOPMENT' ? 'text-indigo-400 font-bold' : ''}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-current" />
                  <span>Senior Developer Code Synthesis</span>
                </div>
                <div className={`flex items-center gap-2 ${currentStep === 'TEST_RUNNING' ? 'text-indigo-400 font-bold' : ''}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-current" />
                  <span>QA Self-Healing Validation Loops</span>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Approval Gates */}
          {currentStep === 'PM_APPROVE' && (
            <div className="p-4 rounded-lg border border-indigo-900 bg-indigo-950/20 space-y-3">
              <h3 className="text-xs font-bold uppercase text-indigo-400 flex items-center gap-1"><ClipboardList size={14} /> Spec Review Requested</h3>
              <p className="text-[11px] text-slate-400">Please review the specifications document on the right pane.</p>
              <textarea 
                value={feedback} 
                onChange={e => setFeedback(e.target.value)} 
                placeholder="Specify requirements to refine..." 
                className="w-full h-16 bg-slate-950 border border-slate-800 rounded p-2 text-xs focus:outline-none resize-none font-sans"
              />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handlePmReview(false)} className="bg-slate-900 hover:bg-slate-800 py-1.5 rounded text-xs font-semibold">Refine Spec</button>
                <button onClick={() => handlePmReview(true)} className="bg-indigo-600 hover:bg-indigo-500 py-1.5 rounded text-xs font-semibold">Approve & Design</button>
              </div>
            </div>
          )}

          {currentStep === 'ARCHITECT_APPROVE' && (
            <div className="p-4 rounded-lg border border-indigo-900 bg-indigo-950/20 space-y-3">
              <h3 className="text-xs font-bold uppercase text-indigo-400 flex items-center gap-1"><Layers size={14} /> Architecture Review Requested</h3>
              <p className="text-[11px] text-slate-400">Review the workspace systems and directory architectures.</p>
              <textarea 
                value={feedback} 
                onChange={e => setFeedback(e.target.value)} 
                placeholder="Request stack adjustments..." 
                className="w-full h-16 bg-slate-950 border border-slate-800 rounded p-2 text-xs focus:outline-none resize-none font-sans"
              />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleArchitectReview(false)} className="bg-slate-900 hover:bg-slate-800 py-1.5 rounded text-xs font-semibold">Refine Schema</button>
                <button onClick={() => handleArchitectReview(true)} className="bg-indigo-600 hover:bg-indigo-500 py-1.5 rounded text-xs font-semibold">Approve & Code</button>
              </div>
            </div>
          )}

          {/* Historical Saved Projects Panel */}
          {savedProjects.length > 0 && (
            <div className="border border-slate-800 rounded p-3 space-y-2 bg-slate-950/40">
              <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider flex items-center gap-1.5"><History size={12} /> Archived Builds</span>
              <div className="space-y-1 overflow-y-auto max-h-40">
                {savedProjects.map((proj) => (
                  <button 
                    key={proj.id} 
                    onClick={() => loadSavedProject(proj)}
                    className="w-full flex items-center space-x-2 px-2 py-1.5 rounded text-left text-[11px] text-slate-400 hover:bg-slate-900 hover:text-white transition font-mono truncate"
                  >
                    <FolderGit2 size={12} className="text-indigo-400" />
                    <span className="truncate">{proj.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Side Working Canvas Panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
          
          <div className="h-10 border-b border-slate-800 bg-slate-900/20 flex items-center justify-between px-6 shrink-0">
            <div className="flex space-x-2">
              <button onClick={() => setActiveTab('logs')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition ${activeTab === 'logs' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>
                <TerminalIcon size={12} /> Console Output
              </button>
              <button onClick={() => setActiveTab('code')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition ${activeTab === 'code' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>
                <Code size={12} /> File Explorer
              </button>
              <button onClick={() => setActiveTab('preview')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition ${activeTab === 'preview' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>
                <Eye size={12} /> Browser Preview
              </button>
            </div>

            {files.length > 0 && (
              <button onClick={downloadClientZip} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs font-bold transition">
                <Download size={12} /> Download ZIP
              </button>
            )}
          </div>

          <div className="flex-1 overflow-hidden relative p-4">
            {activeTab === 'logs' && (
              <div className="h-full flex flex-col space-y-4 overflow-y-auto">
                <div className="bg-slate-950 border border-slate-800 rounded p-4 h-60 overflow-y-auto font-mono text-slate-300">
                  <span className="text-[10px] text-slate-500 block border-b border-slate-800 pb-2 mb-2">SYSTEM TELEMETRY ENGINE LOGGER</span>
                  {logs.map((log, index) => <div key={index}>{log}</div>)}
                  <div ref={logsEndRef} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                  {pmSpec && (
                    <div className="bg-slate-900/10 border border-slate-800 rounded p-4 h-80 overflow-y-auto">
                      <span className="text-indigo-400 font-bold block border-b border-slate-800 pb-2 mb-2 uppercase tracking-wider text-xs">Specification Markdown Doc</span>
                      <div className="text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed pt-2 font-sans">{pmSpec}</div>
                    </div>
                  )}

                  {architectureLayout && (
                    <div className="bg-slate-900/10 border border-slate-800 rounded p-4 h-80 overflow-y-auto">
                      <span className="text-indigo-400 font-bold block border-b border-slate-800 pb-2 mb-2 uppercase tracking-wider text-xs">Architect System Schema</span>
                      <div className="text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed pt-2">{architectureLayout}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'code' && (
              <div className="h-full flex overflow-hidden border border-slate-800 rounded bg-slate-900/10">
                <div className="w-56 border-r border-slate-800 p-3 space-y-2 shrink-0 overflow-y-auto">
                  <span className="text-[10px] uppercase text-slate-500 font-bold block mb-2">Workspace Tree</span>
                  {files.map((file, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => setSelectedFile(file)}
                      className={`w-full flex items-center space-x-2 px-2 py-1.5 rounded text-left text-xs ${selectedFile?.path === file.path ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'}`}
                    >
                      <FileCode size={12} />
                      <span className="truncate">{file.path}</span>
                    </button>
                  ))}
                </div>

                <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 font-mono text-xs">
                  {selectedFile ? (
                    <textarea 
                      value={selectedFile.content}
                      onChange={e => {
                        const updatedContent = e.target.value;
                        const updatedFiles = files.map(f => f.path === selectedFile.path ? { ...f, content: updatedContent } : f);
                        setFiles(updatedFiles);
                        setSelectedFile({ ...selectedFile, content: updatedContent });
                        if (webcontainer) webcontainer.fs.writeFile(selectedFile.path, updatedContent);
                      }}
                      className="flex-1 bg-slate-950 text-emerald-400 p-4 focus:outline-none resize-none overflow-auto leading-relaxed whitespace-pre font-mono"
                      spellCheck="false"
                    />
                  ) : (
                    <div className="flex-1 flex items-center justify-center italic text-slate-600">
                      // Select files from the navigation pane to view implementation code.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'preview' && (
              <div className="h-full w-full bg-white rounded border border-slate-800 overflow-hidden relative">
                {previewUrl ? (
                  <iframe src={previewUrl} className="w-full h-full border-0" />
                ) : (
                  <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center space-y-3">
                    <RefreshCw className="animate-spin text-indigo-500" size={24} />
                    <span className="text-slate-400">Compiling sandbox testing variables...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {isBootingSandbox && (
        <div className="absolute inset-0 bg-slate-950/90 z-50 flex flex-col items-center justify-center space-y-2">
          <RefreshCw className="animate-spin text-indigo-500" size={24} />
          <span className="text-slate-400">Loading system development compiler layers...</span>
        </div>
      )}
    </div>
  );
}
