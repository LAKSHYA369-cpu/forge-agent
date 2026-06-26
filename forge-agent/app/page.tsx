'use client';

import React, { useState, useEffect, useRef } from 'react';
import { WebContainer } from '@webcontainer/api';
import JSZip from 'jszip';
import { 
  Terminal as TerminalIcon, 
  Send, 
  CheckCircle2, 
  Play, 
  RefreshCw, 
  Layers, 
  ClipboardList, 
  Code, 
  Check, 
  Eye, 
  Folder, 
  FileCode, 
  Download, 
  Settings, 
  AlertTriangle,
  FileText,
  Save,
  ChevronRight,
  ArrowRight
} from 'lucide-react';

type Step = 'IDLE' | 'PM_SPEC' | 'PM_APPROVE' | 'ARCHITECT_DESIGN' | 'ARCHITECT_APPROVE' | 'DEVELOPMENT' | 'TEST_RUNNING' | 'COMPLETED';

interface ProjectFile {
  path: string;
  content: string;
}

export default function Workspace() {
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [email, setEmail] = useState('');
  const [prompt, setPrompt] = useState('');
  const [repoName, setRepoName] = useState('my-automated-app');
  const [selectedModel, setSelectedModel] = useState('meta-llama/llama-3.3-70b-instruct');

  // Stepper & Logging State
  const [currentStep, setCurrentStep] = useState<Step>('IDLE');
  const [logs, setLogs] = useState<string[]>([]);
  const [pmSpec, setPmSpec] = useState<string>('');
  const [architectureLayout, setArchitectureLayout] = useState<string>('');
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'logs'>('logs');

  // Interactive revision logic
  const [feedback, setFeedback] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // WebContainer Sandbox Execution State
  const [webcontainer, setWebcontainer] = useState<WebContainer | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [testOutput, setTestOutput] = useState<string>('');
  const [isBootingSandbox, setIsBootingSandbox] = useState(true);

  // Auto-scrolling ref for logs
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function bootSandbox() {
      try {
        addLog("Booting isolated system WebContainer...");
        const instance = await WebContainer.boot();
        setWebcontainer(instance);
        setIsBootingSandbox(false);
        addLog("WebAssembly browser-sandbox environment loaded successfully.");
      } catch (err: any) {
        addLog(`WebContainer Boot Exception: ${err.message}. Ensure Cross-Origin Isolation headers are active.`);
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

  const callAgentAPI = async (systemInstruction: string, userPrompt: string, useJson: boolean = false) => {
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction, userPrompt, openRouterKey, useJson, model: selectedModel })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed API transaction.");
    return data.content;
  };

  // Safe JSON extraction wrapper to protect parsing against markdown codeblock fences
  const cleanAndParseJSON = (text: string) => {
    let raw = text.trim();
    if (raw.startsWith("```json")) {
      raw = raw.substring(7, raw.length - 3).trim();
    } else if (raw.startsWith("```")) {
      raw = raw.substring(3, raw.length - 3).trim();
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      // RegEx fallback to match matching JSON structural boundaries
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      throw new Error("Could not sanitize API JSON string.");
    }
  };

  // --- STAGE 1: Product Manager Agent ---
  const startPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openRouterKey || !prompt) {
      alert("Please configure your OpenRouter API Token and input your application blueprint instructions.");
      return;
    }
    setCurrentStep('PM_SPEC');
    addLog("Analyzing directives. product Manager Agent initiated...");
    setActiveTab('logs');

    try {
      const pmInstruction = `You are a Senior Product Manager. Analyze the user instructions and build a rigorous, comprehensive Technical Specification Document in Markdown. 
Incorporate clean layout wireframe designs, functional logic requirements, and list all required features clearly.`;
      const spec = await callAgentAPI(pmInstruction, `User Instructions Blueprint: ${prompt}`);
      setPmSpec(spec);
      addLog("Product Manager Agent generated Technical Specification document.");
      setCurrentStep('PM_APPROVE');
    } catch (err: any) {
      addLog(`PM Pipeline Crash: ${err.message}`);
      setCurrentStep('IDLE');
    }
  };

  const handlePmReview = async (isApproved: boolean) => {
    if (!isApproved) {
      setCurrentStep('PM_SPEC');
      addLog(`Refining Spec requirements based on feedback: "${feedback}"`);
      try {
        const pmInstruction = `You are an expert Product Manager. Revise and update your Technical Specification Markdown Document incorporating user adjustments.`;
        const spec = await callAgentAPI(pmInstruction, `Current Specification Draft:\n${pmSpec}\n\nUser Change Requests:\n${feedback}`);
        setPmSpec(spec);
        setFeedback('');
        setCurrentStep('PM_APPROVE');
        addLog("Updated Technical Specification processed successfully.");
      } catch (err: any) {
        addLog(`PM Revision failure: ${err.message}`);
      }
      return;
    }

    // Move directly to System Architecture design
    setCurrentStep('ARCHITECT_DESIGN');
    addLog("Specification approved. Contacting Software Architect Agent...");
    try {
      const archInstruction = `You are an expert Systems Architect. Design the project directory layout, select the optimal tech stack, and define schemas. 
Output your final architecture design as a highly readable technical markdown blueprint.`;
      const design = await callAgentAPI(archInstruction, `Design system layout for this Specification:\n${pmSpec}`);
      setArchitectureLayout(design);
      addLog("Software Architect completed directory and schema layout design.");
      setCurrentStep('ARCHITECT_APPROVE');
    } catch (err: any) {
      addLog(`Architect failure: ${err.message}`);
      setCurrentStep('PM_APPROVE');
    }
  };

  // --- STAGE 2: Systems Architect Agent ---
  const handleArchitectReview = async (isApproved: boolean) => {
    if (!isApproved) {
      setCurrentStep('ARCHITECT_DESIGN');
      addLog(`Refining directory layout schemas based on feedback: "${feedback}"`);
      try {
        const archInstruction = `You are an expert Systems Architect. Refine your layout architecture based on user instructions.`;
        const design = await callAgentAPI(archInstruction, `Current Blueprint Layout:\n${architectureLayout}\n\nUser Adjustments:\n${feedback}`);
        setArchitectureLayout(design);
        setFeedback('');
        setCurrentStep('ARCHITECT_APPROVE');
        addLog("Updated Architecture Layout blueprint processed successfully.");
      } catch (err: any) {
        addLog(`Architect Revision failure: ${err.message}`);
      }
      return;
    }

    runDevelopmentStage();
  };

  // --- STAGE 3: Senior Developer Synthesis ---
  const runDevelopmentStage = async () => {
    setCurrentStep('DEVELOPMENT');
    addLog("System Architecture approved. Starting Senior Developer synthesis phase...");
    setActiveTab('logs');

    try {
      const devInstruction = `You are an expert Senior Fullstack Developer. Create the required workspace code files based on the specification and architecture layout. 
Write highly structured, production-ready implementation logic with zero placeholders or comments like "// code goes here". 
Always supply a 'package.json' defining entrypoints, 'index.html', required styles/scripts, and a test script config in package.json.
Respond with ONLY a clean JSON object structure containing an array of path/content configurations:
{
  "files": [
    { "path": "package.json", "content": "..." },
    { "path": "index.html", "content": "..." },
    { "path": "test.js", "content": "..." }
  ]
}`;
      const codeOutput = await callAgentAPI(devInstruction, `Write full implementation files for this layout:\n${architectureLayout}`, true);
      const parsed = cleanAndParseJSON(codeOutput);
      const projectFiles: ProjectFile[] = parsed.files;
      setFiles(projectFiles);
      setSelectedFile(projectFiles[0] || null);
      addLog(`Senior Developer completed base workspace code blocks. Generated ${projectFiles.length} source files.`);

      if (webcontainer) {
        await mountFilesToSandbox(projectFiles);
        await runQATestingLoop(projectFiles, 1);
      } else {
        addLog("Sandbox execution environment offline. Packaging raw files.");
        setCurrentStep('COMPLETED');
      }
    } catch (err: any) {
      addLog(`Development Stage Failure: ${err.message}`);
      setCurrentStep('ARCHITECT_APPROVE');
    }
  };

  const mountFilesToSandbox = async (filesToMount: ProjectFile[]) => {
    addLog("Mounting updated source codes into virtual system environment...");
    const tree: any = {};
    filesToMount.forEach(file => {
      const parts = file.path.split('/');
      let current = tree;
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          current[part] = { file: { contents: file.content } };
        } else {
          if (!current[part]) current[part] = { directory: {} };
          current = current[part].directory;
        }
      });
    });
    await webcontainer!.mount(tree);
    addLog("In-memory sandbox mounting complete.");
  };

  // --- STAGE 4: Autonomous QA/Test Self-Healing Loop ---
  const runQATestingLoop = async (currentFiles: ProjectFile[], attempt: number) => {
    if (attempt > 3) {
      addLog("Maximum autonomous refinement cycles achieved. Launching dev servers.");
      await launchDevPreviewServer();
      return;
    }

    setCurrentStep('TEST_RUNNING');
    addLog(`[Refinement Loop ${attempt}/3] Running automated unit test validations...`);

    try {
      addLog("Executing sandbox install dependencies...");
      const install = await webcontainer!.spawn('npm', ['install']);
      let installLogs = '';
      install.output.pipeTo(new WritableStream({
        write(chunk) { installLogs += chunk; }
      }));
      await install.exit;

      addLog("Running test suites...");
      const test = await webcontainer!.spawn('npm', ['test']);
      let testLogs = '';
      test.output.pipeTo(new WritableStream({
        write(chunk) { testLogs += chunk; }
      }));
      
      const exitCode = await test.exit;
      setTestOutput(testLogs);

      if (exitCode === 0) {
        addLog("✨ All automated unit tests passed successfully!");
        await launchDevPreviewServer();
      } else {
        addLog(`⚠️ Automated tests failed. Contacting QA Agent to auto-heal & patch implementation...`);
        
        const qaInstruction = `You are a Senior Debugging Engineer. The unit test suite failed during validation checks. 
Review the output failure logs:
---
${testLogs}
---

Correct the errors in your implementation. Readjust file logic mapping structures cleanly. 
Return your complete, corrected project file structure as a strict JSON object mapping with NO conversational markdown:
{
  "files": [
    { "path": "path/to/file", "content": "..." }
  ]
}`;
        const patchText = await callAgentAPI(qaInstruction, `Current implementation context files: ${JSON.stringify(currentFiles)}`, true);
        const parsedPatch = cleanAndParseJSON(patchText);
        const patchedFiles: ProjectFile[] = parsedPatch.files;

        setFiles(patchedFiles);
        setSelectedFile(patchedFiles[0] || null);
        await mountFilesToSandbox(patchedFiles);
        // Recurse loops
        await runQATestingLoop(patchedFiles, attempt + 1);
      }
    } catch (err: any) {
      addLog(`QA Loop encountered execution error: ${err.message}. Preserving build.`);
      await launchDevPreviewServer();
    }
  };

  const launchDevPreviewServer = async () => {
    addLog("Spawning workspace server processes...");
    try {
      webcontainer!.on('port', (port, type, url) => {
        addLog(`Sandbox Web Preview active: ${url}`);
        setPreviewUrl(url);
        setActiveTab('preview');
        setCurrentStep('COMPLETED');
      });

      // Spawns standard startup scripts defined in your packages configurations
      await webcontainer!.spawn('npm', ['run', 'start']);
    } catch (err: any) {
      addLog(`Preview server failed to start: ${err.message}`);
      setCurrentStep('COMPLETED');
    }
  };

  // --- Client-Side ZIP Packager ---
  const downloadClientZip = async () => {
    try {
      addLog("Packaging local repository workspace...");
      const zip = new JSZip();
      files.forEach(file => {
        zip.file(file.path, file.content);
      });
      const content = await zip.generateAsync({ type: 'blob' });
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(content);
      downloadLink.download = `${repoName}.zip`;
      downloadLink.click();
      addLog("Clean project ZIP package successfully generated and downloaded.");
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  };

  const handleLocalFileEdit = (newContent: string) => {
    if (!selectedFile) return;
    const updated = files.map(file => 
      file.path === selectedFile.path ? { ...file, content: newContent } : file
    );
    setFiles(updated);
    setSelectedFile({ ...selectedFile, content: newContent });
    if (webcontainer) {
      // Hot-update the browser sandbox filesystem
      webcontainer.fs.writeFile(selectedFile.path, newContent);
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      
      {/* Top Header Controls bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 z-10 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <h1 className="text-sm font-bold tracking-widest text-indigo-400 uppercase">ForgeAgent Studio</h1>
          <span className="text-xs text-slate-600">v7.0 Stable</span>
        </div>

        {/* Configurations menu */}
        <div className="flex items-center space-x-4">
          <select 
            value={selectedModel} 
            onChange={e => setSelectedModel(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B Instruct</option>
            <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
            <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
            <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
          </select>

          <input 
            type="password" 
            placeholder="OpenRouter Token (sk-or-...)" 
            value={openRouterKey} 
            onChange={e => setOpenRouterKey(e.target.value)} 
            className="bg-slate-900 border border-slate-800 rounded px-3 py-1 text-xs text-slate-300 w-48 focus:outline-none focus:border-indigo-500"
          />

          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* Main workspace panels structure */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Dynamic Stepper Sidebar */}
        <div className={`transition-all duration-300 shrink-0 border-r border-slate-800 bg-slate-900/10 flex flex-col ${isSidebarOpen ? 'w-[380px]' : 'w-0 overflow-hidden border-r-0'}`}>
          <div className="p-4 border-b border-slate-800/60 space-y-3">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Project Specifications</span>
            <input 
              type="text" 
              placeholder="Repository Workspace Title" 
              value={repoName} 
              onChange={e => setRepoName(e.target.value)} 
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-indigo-300 font-mono"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {currentStep === 'IDLE' ? (
              <form onSubmit={startPipeline} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-slate-500 uppercase font-semibold">Blueprint Instructions</label>
                  <textarea 
                    value={prompt} 
                    onChange={e => setPrompt(e.target.value)} 
                    rows={6} 
                    placeholder="Describe your game, web app, script, or utility in detail..." 
                    className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-xs leading-relaxed focus:outline-none focus:border-indigo-500 resize-none font-sans"
                  />
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded text-xs uppercase tracking-wider transition flex items-center justify-center gap-2">
                  <Play size={13} /> Compile Workspace Pipeline
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                {/* Visual Agent Stepper */}
                <div className="border border-slate-800/80 rounded p-4 bg-slate-950/40 space-y-3">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block">Active Operations Pipeline</span>
                  <div className="space-y-3 text-xs">
                    {[
                      { key: 'PM_SPEC', label: '1. Product Specification Output' },
                      { key: 'ARCHITECT_DESIGN', label: '2. Systems Layout Schema' },
                      { key: 'DEVELOPMENT', label: '3. Senior Developer Synthesis' },
                      { key: 'TEST_RUNNING', label: '4. QA Test Self-Healing' }
                    ].map((step, idx) => {
                      const isActive = currentStep.startsWith(step.key) || currentStep === 'PM_APPROVE' && step.key === 'PM_SPEC' || currentStep === 'ARCHITECT_APPROVE' && step.key === 'ARCHITECT_DESIGN';
                      return (
                        <div key={idx} className={`flex items-center gap-3 ${isActive ? 'text-indigo-400 font-bold' : 'text-slate-600'}`}>
                          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-indigo-500' : 'bg-slate-800'}`} />
                          <span>{step.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Milestone Interaction Gates */}
                {currentStep === 'PM_APPROVE' && (
                  <div className="p-4 rounded-lg border border-indigo-900 bg-indigo-950/20 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                      <ClipboardList size={14} /> Spec Sign-off Required
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">Review the PM Specification document on the right. Provide refinement requests or approve to proceed.</p>
                    <textarea 
                      value={feedback} 
                      onChange={e => setFeedback(e.target.value)} 
                      placeholder="e.g., Support responsive grid patterns..." 
                      className="w-full h-16 bg-slate-950 border border-slate-800 rounded p-2 text-xs focus:outline-none resize-none font-sans"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => handlePmReview(false)} className="bg-slate-900 hover:bg-slate-800 py-2 rounded text-xs font-semibold text-slate-300">Request Changes</button>
                      <button onClick={() => handlePmReview(true)} className="bg-indigo-600 hover:bg-indigo-500 py-2 rounded text-xs font-semibold text-white">Approve & Design</button>
                    </div>
                  </div>
                )}

                {currentStep === 'ARCHITECT_APPROVE' && (
                  <div className="p-4 rounded-lg border border-indigo-900 bg-indigo-950/20 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                      <Layers size={14} /> Structure Sign-off Required
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">Ensure the proposed directories and database structures are aligned before the developers begin coding.</p>
                    <textarea 
                      value={feedback} 
                      onChange={e => setFeedback(e.target.value)} 
                      placeholder="e.g., Include vitest dependencies..." 
                      className="w-full h-16 bg-slate-950 border border-slate-800 rounded p-2 text-xs focus:outline-none resize-none font-sans"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => handleArchitectReview(false)} className="bg-slate-900 hover:bg-slate-800 py-2 rounded text-xs font-semibold text-slate-300">Request Changes</button>
                      <button onClick={() => handleArchitectReview(true)} className="bg-indigo-600 hover:bg-indigo-500 py-2 rounded text-xs font-semibold text-white">Approve & Code</button>
                    </div>
                  </div>
                )}

                {/* Reset Trigger */}
                {currentStep === 'COMPLETED' && (
                  <button 
                    onClick={() => { setCurrentStep('IDLE'); setFiles([]); setSelectedFile(null); setPmSpec(''); setArchitectureLayout(''); }} 
                    className="w-full bg-slate-900 hover:bg-slate-850 py-2 rounded text-xs text-slate-300 border border-slate-800 uppercase tracking-wider"
                  >
                    Start New Blueprint Build
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Workspace Panels Grid Layout */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
          
          {/* Workspace Tabs controls */}
          <div className="h-10 border-b border-slate-800 bg-slate-900/20 flex items-center justify-between px-6 shrink-0">
            <div className="flex space-x-2">
              <button 
                onClick={() => setActiveTab('logs')} 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition font-semibold ${activeTab === 'logs' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <TerminalIcon size={12} /> Live Compilation logs
              </button>
              <button 
                onClick={() => { setActiveTab('code'); if (files.length > 0 && !selectedFile) setSelectedFile(files[0]); }} 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition font-semibold ${activeTab === 'code' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Code size={12} /> File Tree & Editor
              </button>
              <button 
                onClick={() => setActiveTab('preview')} 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition font-semibold ${activeTab === 'preview' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Eye size={12} /> Local Live Preview
              </button>
            </div>

            {/* ZIP download button */}
            {files.length > 0 && (
              <button 
                onClick={downloadClientZip}
                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs font-bold transition"
              >
                <Download size={12} /> Get Project ZIP
              </button>
            )}
          </div>

          {/* Active Panel Body */}
          <div className="flex-1 overflow-hidden relative">
            
            {/* Log / Blueprint Display */}
            {activeTab === 'logs' && (
              <div className="h-full p-4 overflow-y-auto space-y-4 font-mono text-xs">
                
                {/* Console Output Block */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col h-64 shadow-inner">
                  <span className="text-[10px] text-slate-500 uppercase border-b border-slate-800/80 pb-2 mb-2 block tracking-wider">Console output terminals</span>
                  <div className="flex-1 overflow-y-auto space-y-1.5 text-slate-300">
                    {logs.map((log, i) => <div key={i}>{log}</div>)}
                    <div ref={logsEndRef} />
                  </div>
                </div>

                {/* Technical Docs Block */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pmSpec && (
                    <div className="bg-slate-900/20 border border-slate-800 rounded-lg p-4 space-y-2 h-[450px] overflow-y-auto">
                      <span className="text-indigo-400 font-bold flex items-center gap-1 border-b border-slate-800 pb-2 text-xs uppercase tracking-wider">
                        <ClipboardList size={13} /> PM Product Specs Document
                      </span>
                      <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed pt-2 font-sans">{pmSpec}</div>
                    </div>
                  )}

                  {architectureLayout && (
                    <div className="bg-slate-900/20 border border-slate-800 rounded-lg p-4 space-y-2 h-[450px] overflow-y-auto">
                      <span className="text-indigo-400 font-bold flex items-center gap-1 border-b border-slate-800 pb-2 text-xs uppercase tracking-wider">
                        <Layers size={13} /> Architecture Directory Schema
                      </span>
                      <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed pt-2">{architectureLayout}</div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* Code Explorer & Editor */}
            {activeTab === 'code' && (
              <div className="h-full flex overflow-hidden">
                {/* Visual File Tree column */}
                <div className="w-64 border-r border-slate-800 bg-slate-900/10 flex flex-col p-3 space-y-3 shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Active Workspace Files</span>
                  <div className="flex-1 overflow-y-auto space-y-1">
                    {files.map((file, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => setSelectedFile(file)}
                        className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded text-left text-xs font-mono transition ${selectedFile?.path === file.path ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
                      >
                        <FileCode size={13} className={selectedFile?.path === file.path ? 'text-indigo-400' : 'text-slate-500'} />
                        <span className="truncate">{file.path}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Code Editor Column */}
                <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 font-mono text-xs">
                  {selectedFile ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="h-9 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between px-4 shrink-0">
                        <span className="text-slate-400 font-bold text-[11px]">{selectedFile.path}</span>
                        <span className="text-[10px] text-emerald-500 flex items-center gap-1 uppercase font-bold">
                          <Check size={10} /> Editable active file
                        </span>
                      </div>
                      <textarea 
                        value={selectedFile.content}
                        onChange={e => handleLocalFileEdit(e.target.value)}
                        className="flex-1 bg-slate-950 text-emerald-400 p-4 focus:outline-none resize-none overflow-auto leading-relaxed whitespace-pre font-mono"
                        spellCheck="false"
                      />
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-600 italic">
                      // Initialize workspace to display code files.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sandbox Live Web Preview */}
            {activeTab === 'preview' && (
              <div className="h-full w-full flex flex-col bg-white">
                {previewUrl ? (
                  <iframe src={previewUrl} className="w-full flex-1 border-0" />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 space-y-4 p-6">
                    <div className="flex flex-col items-center space-y-2">
                      <RefreshCw className="animate-spin text-indigo-500" size={24} />
                      <span className="text-xs text-slate-400 font-mono">Launching Sandbox Server port channels...</span>
                    </div>
                    {testOutput && (
                      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-lg p-4 font-mono text-xs shadow-lg">
                        <span className="text-rose-400 font-bold block border-b border-slate-800 pb-2 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                          <AlertTriangle size={14} /> System unit-test error logs detected
                        </span>
                        <div className="text-slate-300 whitespace-pre-wrap overflow-y-auto max-h-64 leading-relaxed">{testOutput}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

      </div>

      {/* Booting Sandbox Loader Overlay */}
      {isBootingSandbox && (
        <div className="absolute inset-0 bg-slate-950/90 z-50 flex flex-col items-center justify-center space-y-3 font-mono text-xs">
          <RefreshCw className="animate-spin text-indigo-500" size={32} />
          <span className="text-slate-400">Loading Node.js WebAssembly compiler sandbox...</span>
        </div>
      )}
    </div>
  );
}
