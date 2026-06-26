'use client';

import React, { useState, useEffect, useRef } from 'react';
import { WebContainer } from '@webcontainer/api';
import { Terminal, Send, CheckCircle2, Play, RefreshCw, Layers, ClipboardList, Code, Check, Eye } from 'lucide-react';

type Step = 'IDLE' | 'PM_SPEC' | 'PM_APPROVE' | 'ARCHITECT_DESIGN' | 'ARCHITECT_APPROVE' | 'DEVELOPMENT' | 'TEST_RUNNING' | 'COMPLETED';

interface ProjectFile {
  path: string;
  content: string;
}

export default function Workspace() {
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [email, setEmail] = useState('');
  const [prompt, setPrompt] = useState('');
  const [repoName, setRepoName] = useState('my-sandboxed-app');

  // Multi-Agent State tracking
  const [currentStep, setCurrentStep] = useState<Step>('IDLE');
  const [logs, setLogs] = useState<string[]>([]);
  const [pmSpec, setPmSpec] = useState<string>('');
  const [architectureLayout, setArchitectureLayout] = useState<string>('');
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'logs'>('logs');

  // Interactive feedback inputs
  const [feedback, setFeedback] = useState('');

  // Sandbox references
  const [webcontainer, setWebcontainer] = useState<WebContainer | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [testOutput, setTestOutput] = useState<string>('');

  // Initialize WebContainer on mount
  useEffect(() => {
    async function bootSandbox() {
      try {
        addLog("Initializing secure system WebContainer...");
        const instance = await WebContainer.boot();
        setWebcontainer(instance);
        addLog("WebAssembly System Sandbox loaded successfully.");
      } catch (err: any) {
        addLog(`Sandbox failed to load: ${err.message}. Make sure headers are isolated.`);
      }
    }
    bootSandbox();
  }, []);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const callAgentAPI = async (systemInstruction: string, userPrompt: string, useJson: boolean = false) => {
    const res = await fetch('/app/api/agent' || '/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction, userPrompt, openRouterKey, useJson })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed API turn.");
    return data.content;
  };

  // --- STAGE 1: Product Manager Agent ---
  const startPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openRouterKey || !email || !prompt) {
      alert("Please provide your OpenRouter Key, Email, and Blueprint instructions.");
      return;
    }
    setCurrentStep('PM_SPEC');
    addLog("Command issued to Product Manager Agent.");
    setActiveTab('logs');

    try {
      const pmInstruction = `You are an expert Product Manager. Analyze the user prompt and generate a detailed Technical Specification outline. 
Identify ambiguities and clarify the product requirements in structured Markdown. Provide a clear wireframe architecture.`;
      
      const spec = await callAgentAPI(pmInstruction, `Analyze design specifications for: ${prompt}`);
      setPmSpec(spec);
      addLog("Product Manager Agent generated Technical Specification document.");
      setCurrentStep('PM_APPROVE');
    } catch (err: any) {
      addLog(`PM Error: ${err.message}`);
      setCurrentStep('IDLE');
    }
  };

  const handlePmApprove = async (approved: boolean) => {
    if (!approved) {
      // Re-trigger PM with feedback
      setCurrentStep('PM_SPEC');
      addLog(`Sending feedback back to PM Agent: "${feedback}"`);
      try {
        const pmInstruction = `You are an expert Product Manager. Update your Technical Specification layout based on user feedback.`;
        const spec = await callAgentAPI(pmInstruction, `Original Spec:\n${pmSpec}\n\nUser Revision Request:\n${feedback}`);
        setPmSpec(spec);
        setFeedback('');
        setCurrentStep('PM_APPROVE');
        addLog("Updated Technical Specification successfully processed.");
      } catch (err: any) {
        addLog(`PM Revision Error: ${err.message}`);
      }
      return;
    }

    // Move to Architecture
    setCurrentStep('ARCHITECT_DESIGN');
    addLog("Technical Spec approved. Contacting Software Architect Agent...");
    try {
      const archInstruction = `You are a Software Architect. Design the project directory layout, list npm dependencies, and database schemas. 
Output your proposal as a cleanly formatted markdown document.`;
      const design = await callAgentAPI(archInstruction, `Design system based on this Spec:\n${pmSpec}`);
      setArchitectureLayout(design);
      addLog("Software Architect completed directory and schema layout design.");
      setCurrentStep('ARCHITECT_APPROVE');
    } catch (err: any) {
      addLog(`Architect Error: ${err.message}`);
      setCurrentStep('PM_APPROVE');
    }
  };

  // --- STAGE 2: Software Architect Agent ---
  const handleArchitectApprove = async (approved: boolean) => {
    if (!approved) {
      setCurrentStep('ARCHITECT_DESIGN');
      addLog(`Sending feedback to Software Architect: "${feedback}"`);
      try {
        const archInstruction = `You are a Software Architect. Revise your system design based on this feedback.`;
        const design = await callAgentAPI(archInstruction, `Previous Design:\n${architectureLayout}\n\nFeedback:\n${feedback}`);
        setArchitectureLayout(design);
        setFeedback('');
        setCurrentStep('ARCHITECT_APPROVE');
        addLog("System Architecture updated.");
      } catch (err: any) {
        addLog(`Architect Revision Error: ${err.message}`);
      }
      return;
    }

    // Move to Coding & Self-healing sandbox compilation
    runDevelopmentPipeline();
  };

  // --- STAGE 3: Senior Developer & QA Tester Loop ---
  const runDevelopmentPipeline = async () => {
    setCurrentStep('DEVELOPMENT');
    addLog("Architecture Design approved. Starting Senior Developer synthesis...");
    
    try {
      const devInstruction = `You are an expert Senior Fullstack Developer. Create the code files based on the specification. 
All files must be clean, fully documented, and robust. Always generate a 'package.json', index.html, static web contents, or test scripts.
Return your response as a strict JSON object mapping files:
{
  "files": [
    { "path": "package.json", "content": "..." },
    { "path": "index.html", "content": "..." },
    { "path": "app.js", "content": "..." },
    { "path": "test.js", "content": "..." }
  ]
}`;
      const payloadText = await callAgentAPI(devInstruction, `Write full implementation files based on this architecture:\n${architectureLayout}`, true);
      const parsed = JSON.parse(payloadText);
      const generatedFiles: ProjectFile[] = parsed.files;
      setFiles(generatedFiles);
      addLog(`Developer synthesized ${generatedFiles.length} project files.`);

      // Mount into Browser Sandbox
      if (webcontainer) {
        await mountSandboxFiles(generatedFiles);
        await runQALoop(generatedFiles, 1);
      } else {
        addLog("WebContainer sandbox unavailable. Bypassing test execution run.");
        setCurrentStep('COMPLETED');
      }

    } catch (err: any) {
      addLog(`Development Failure: ${err.message}`);
      setCurrentStep('ARCHITECT_APPROVE');
    }
  };

  const mountSandboxFiles = async (filesToMount: ProjectFile[]) => {
    addLog("Mounting source structures into virtual system sandbox...");
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
    addLog("Workspace mounted.");
  };

  // --- STAGE 4: Automated Testing & Patching Loop ---
  const runQALoop = async (currentFiles: ProjectFile[], attempt: number) => {
    if (attempt > 3) {
      addLog("Max debugging passes completed. Serving application.");
      await startDevelopmentServer();
      return;
    }

    setCurrentStep('TEST_RUNNING');
    addLog(`[QA Loop Attempt ${attempt}] Writing test scripts and running tests inside sandbox...`);

    try {
      // Install dependencies inside browser sandbox
      addLog("Installing packages inside the WebAssembly Sandbox...");
      const installProcess = await webcontainer!.spawn('npm', ['install']);
      await installProcess.exit;

      // Execute tests
      addLog("Executing test scripts...");
      const runTest = await webcontainer!.spawn('npm', ['test']);
      
      let logsBuffer = '';
      runTest.output.pipeTo(new WritableStream({
        write(data) { logsBuffer += data; }
      }));

      const exitCode = await runTest.exit;
      setTestOutput(logsBuffer);

      if (exitCode === 0) {
        addLog("✨ Success! All sandbox testing checks passed cleanly.");
        await startDevelopmentServer();
      } else {
        addLog(`❌ QA Blocked: Tests failed. Auto-patching implementation (Attempt ${attempt}/3)...`);
        
        const patchInstruction = `You are a Senior Debugging Engineer. The unit test suite failed with this output:
---
${logsBuffer}
---
Review the current files: ${JSON.stringify(currentFiles)} and patch the bugs. Return ONLY updated JSON files mapping.`;

        const patchPayload = await callAgentAPI(patchInstruction, "Identify the logical flaw and return corrected file mappings.", true);
        const parsedPatch = JSON.parse(patchPayload);
        const updatedFiles: ProjectFile[] = parsedPatch.files;

        setFiles(updatedFiles);
        await mountSandboxFiles(updatedFiles);
        // Recurse loop
        await runQALoop(updatedFiles, attempt + 1);
      }
    } catch (err: any) {
      addLog(`QA Run Exception: ${err.message}`);
      await startDevelopmentServer();
    }
  };

  const startDevelopmentServer = async () => {
    addLog("Starting server instance preview thread...");
    try {
      // Bind webcontainer port listener
      webcontainer!.on('port', (port, type, url) => {
        addLog(`Live Preview compiled and served at: ${url}`);
        setPreviewUrl(url);
        setActiveTab('preview');
        setCurrentStep('COMPLETED');
      });

      // Spawn start server script
      await webcontainer!.spawn('npm', ['run', 'start']);
    } catch (err: any) {
      addLog(`Server spin-up error: ${err.message}`);
      setCurrentStep('COMPLETED');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-mono text-sm">
      {/* Settings Top Bar */}
      <header className="border-b border-slate-800 bg-slate-900/50 p-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="text-base font-bold tracking-tight text-indigo-400">FORGE-AGENT OS v6.0</h1>
        </div>

        <div className="flex gap-3 flex-wrap">
          <input 
            type="password" 
            placeholder="OpenRouter Token (sk-or-...)" 
            value={openRouterKey} 
            onChange={e => setOpenRouterKey(e.target.value)} 
            className="bg-slate-950 border border-slate-800 rounded px-3 py-1 text-xs text-indigo-300 w-52 focus:outline-none focus:border-indigo-500"
          />
          <input 
            type="email" 
            placeholder="Target Email Address" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            className="bg-slate-950 border border-slate-800 rounded px-3 py-1 text-xs text-indigo-300 w-44 focus:outline-none focus:border-indigo-500"
          />
          <input 
            type="text" 
            placeholder="App Name" 
            value={repoName} 
            onChange={e => setRepoName(e.target.value)} 
            className="bg-slate-950 border border-slate-800 rounded px-3 py-1 text-xs text-indigo-300 w-36 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </header>

      {/* Main Panel grid */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Left Side: Parameters, Prompts & Milestone Approval Gates */}
        <div className="w-full md:w-[450px] border-r border-slate-800 flex flex-col bg-slate-900/10 overflow-y-auto p-4 space-y-4">
          
          <form onSubmit={startPipeline} className="space-y-3">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">App Blueprint Blueprint</label>
            <textarea 
              value={prompt} 
              onChange={e => setPrompt(e.target.value)} 
              rows={4} 
              disabled={currentStep !== 'IDLE'}
              placeholder="e.g., Build a beautiful Pomodoro Timer app with custom alarm sounds and Vitest check frameworks..." 
              className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-xs leading-relaxed focus:outline-none focus:border-indigo-500 resize-none disabled:opacity-50"
            />
            {currentStep === 'IDLE' && (
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-bold py-2 rounded text-xs tracking-wider uppercase transition">
                Compile Workspace Pipeline
              </button>
            )}
          </form>

          {/* Interactive Milestone Approval Gate UI */}
          {currentStep === 'PM_APPROVE' && (
            <div className="p-4 rounded border border-indigo-900 bg-indigo-950/20 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Milestone 1: Product Specification Approval</h3>
              <p className="text-xs text-slate-400 leading-relaxed">Review the PM Technical Spec document on the right pane. Provide refinement details or approve to proceed.</p>
              <textarea 
                value={feedback} 
                onChange={e => setFeedback(e.target.value)} 
                placeholder="Suggest modifications..." 
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs focus:outline-none resize-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handlePmApprove(false)} className="bg-slate-800 hover:bg-slate-700 py-1.5 rounded text-xs font-semibold">Request Revision</button>
                <button onClick={() => handlePmApprove(true)} className="bg-indigo-600 hover:bg-indigo-500 py-1.5 rounded text-xs font-semibold">Approve Spec</button>
              </div>
            </div>
          )}

          {currentStep === 'ARCHITECT_APPROVE' && (
            <div className="p-4 rounded border border-indigo-900 bg-indigo-950/20 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Milestone 2: Directory & Schema Approval</h3>
              <p className="text-xs text-slate-400 leading-relaxed">Review the layout schema. Once approved, the Senior Developer will begin full-stack implementation.</p>
              <textarea 
                value={feedback} 
                onChange={e => setFeedback(e.target.value)} 
                placeholder="Suggest stack additions..." 
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs focus:outline-none resize-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleArchitectApprove(false)} className="bg-slate-800 hover:bg-slate-700 py-1.5 rounded text-xs font-semibold">Request Revision</button>
                <button onClick={() => handleArchitectApprove(true)} className="bg-indigo-600 hover:bg-indigo-500 py-1.5 rounded text-xs font-semibold">Approve Design</button>
              </div>
            </div>
          )}

          {/* Milestone Stepper Log Checklist */}
          <div className="border border-slate-800 rounded p-3 space-y-2 bg-slate-950/60">
            <span className="text-[10px] uppercase text-slate-500 font-bold tracking-widest block">Core Agent Status Checks</span>
            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${currentStep !== 'IDLE' ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                <span>Product Manager Specification</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${['ARCHITECT_DESIGN','ARCHITECT_APPROVE','DEVELOPMENT','TEST_RUNNING','COMPLETED'].includes(currentStep) ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                <span>Systems Architect Structure</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${['DEVELOPMENT','TEST_RUNNING','COMPLETED'].includes(currentStep) ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                <span>Senior Developer Synthesizer</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${['TEST_RUNNING','COMPLETED'].includes(currentStep) ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                <span>QA Self-Healing Validation Runs</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Side Tab Panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
          <div className="flex border-b border-slate-800 bg-slate-900/20 px-4 py-2 items-center justify-between">
            <div className="flex gap-2">
              <button onClick={() => setActiveTab('logs')} className={`flex items-center gap-1 px-3 py-1 rounded text-xs ${activeTab === 'logs' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>
                <Terminal size={12} /> Console Log
              </button>
              <button onClick={() => setActiveTab('code')} className={`flex items-center gap-1 px-3 py-1 rounded text-xs ${activeTab === 'code' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>
                <Code size={12} /> File Explorer
              </button>
              <button onClick={() => setActiveTab('preview')} className={`flex items-center gap-1 px-3 py-1 rounded text-xs ${activeTab === 'preview' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>
                <Eye size={12} /> Sandbox Web Preview
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {activeTab === 'logs' && (
              <div className="space-y-4">
                <div className="bg-slate-950 p-3 rounded border border-slate-800 h-64 overflow-y-auto space-y-1 text-slate-300">
                  <span className="text-[10px] text-slate-500 block border-b border-slate-800 pb-1 mb-2">SYSTEM EXECUTION CONSOLE OUT</span>
                  {logs.map((log, index) => <div key={index}>{log}</div>)}
                </div>

                {pmSpec && (
                  <div className="bg-slate-900/30 p-4 rounded border border-slate-800 space-y-2">
                    <span className="text-xs font-bold text-indigo-400 flex items-center gap-1"><ClipboardList size={14} /> Product Specification Document</span>
                    <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed border-t border-slate-800/60 pt-2 font-sans">{pmSpec}</div>
                  </div>
                )}

                {architectureLayout && (
                  <div className="bg-slate-900/30 p-4 rounded border border-slate-800 space-y-2">
                    <span className="text-xs font-bold text-indigo-400 flex items-center gap-1"><Layers size={14} /> System Architectural Design Blueprint</span>
                    <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed border-t border-slate-800/60 pt-2">{architectureLayout}</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'code' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-full">
                <div className="md:col-span-1 border border-slate-800 rounded p-3 bg-slate-900/20">
                  <span className="text-xs font-bold text-slate-400 block mb-2">Workspace Tree</span>
                  {files.length === 0 ? (
                    <span className="text-xs text-slate-600 italic">No files generated yet.</span>
                  ) : (
                    <div className="space-y-1 text-xs text-indigo-300">
                      {files.map((file, idx) => (
                        <div key={idx} className="cursor-pointer hover:underline">📄 {file.path}</div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="md:col-span-3 border border-slate-800 rounded p-4 bg-slate-950 text-emerald-400 whitespace-pre-wrap overflow-x-auto h-full font-mono text-xs">
                  {files.length > 0 ? (
                    <div>
                      <span className="text-slate-500 block border-b border-slate-800 pb-1 mb-2">// Active Workspace Files Preview</span>
                      {JSON.stringify(files, null, 2)}
                    </div>
                  ) : (
                    <span className="text-slate-600">// Source files will display here once Developer Agent triggers.</span>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'preview' && (
              <div className="w-full h-full flex flex-col">
                {previewUrl ? (
                  <iframe src={previewUrl} className="w-full flex-1 bg-white rounded border border-slate-800" />
                ) : (
                  <div className="flex flex-col items-center justify-center flex-1 space-y-2 text-slate-500">
                    <RefreshCw className="animate-spin text-indigo-500" size={24} />
                    <span>Waiting for Sandbox Dev Server compilation...</span>
                    {testOutput && (
                      <div className="w-full max-w-lg mt-4 p-3 bg-slate-900 rounded border border-slate-800 text-xs text-rose-400 whitespace-pre-wrap">
                        {testOutput}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
