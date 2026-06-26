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
  Cpu,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  PlayCircle,
  AlertTriangle,
  FileText,
  Plus,
  Trash2,
  X,
  ExternalLink,
  Info
} from 'lucide-react';

// Initialize Client-Side Supabase (with fallback support)
const supabaseUrl = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_SUPABASE_URL || '') : '';
const supabaseAnonKey = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '') : '';
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

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

interface Toast {
  message: string;
  type: 'info' | 'success' | 'error';
  id: number;
}

export default function Workspace() {
  const [session, setSession] = useState<any>(null);
  const [useLocalAuth, setUseLocalAuth] = useState(false);
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [repoName, setRepoName] = useState('my-forge-app');
  const [selectedModel, setSelectedModel] = useState('meta-llama/llama-3.3-70b-instruct');

  // Multi-Agent Pipeline States
  const [currentStep, setCurrentStep] = useState<Step>('IDLE');
  const [logs, setLogs] = useState<string[]>([]);
  const [pmSpec, setPmSpec] = useState<string>('');
  const [architectureLayout, setArchitectureLayout] = useState<string>('');
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTabFile, setActiveTabFile] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'logs'>('logs');

  // Dynamic Workspace Panes Layout Controls
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(true);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // New File Creation Input
  const [newFilePath, setNewFilePath] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState(false);

  // Notifications State
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Interactive revision state
  const [feedback, setFeedback] = useState('');
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);

  // WebContainer States
  const [webcontainer, setWebcontainer] = useState<WebContainer | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [testOutput, setTestOutput] = useState<string>('');
  const [isBootingSandbox, setIsBootingSandbox] = useState(true);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const codeEditorRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Monitor Auth Sessions & check for Mock Fallback
  useEffect(() => {
    if (!supabase) {
      setUseLocalAuth(true);
      const localUser = localStorage.getItem('forge_local_session');
      if (localUser) {
        setSession({ user: JSON.parse(localUser) });
        fetchLocalProjects();
      }
      return;
    }

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

  // WebContainer Initializer
  useEffect(() => {
    async function bootSandbox() {
      try {
        addLog("Booting sandboxed system WebContainer layers...");
        const instance = await WebContainer.boot();
        setWebcontainer(instance);
        setIsBootingSandbox(false);
        addLog("WebAssembly isolated browser sandbox running successfully.");
      } catch (err: any) {
        addLog(`Sandbox failed to load: ${err.message}. Ensure Cross-Origin Isolation headers are configured.`);
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

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { message, type, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Profile configuration retrievers
  const fetchUserProfile = async (userId: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('profiles').select('openrouter_key').eq('id', userId).single();
    if (data?.openrouter_key) setOpenRouterKey(data.openrouter_key);
  };

  const fetchUserProjects = async (userId: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('projects').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setSavedProjects(data as SavedProject[]);
  };

  // Local storage auth bypass controls (Runs if Supabase variables are unset)
  const fetchLocalProjects = () => {
    const data = localStorage.getItem('forge_local_projects');
    if (data) setSavedProjects(JSON.parse(data));
  };

  const saveLocalProject = (newProject: SavedProject) => {
    const localProj = localStorage.getItem('forge_local_projects');
    const existing: SavedProject[] = localProj ? JSON.parse(localProj) : [];
    const updated = [newProject, ...existing];
    localStorage.setItem('forge_local_projects', JSON.stringify(updated));
    setSavedProjects(updated);
  };

  const handleLocalBypassLogin = () => {
    const mockUser = { id: 'local_dev_user', email: 'offline-developer@forge.local' };
    localStorage.setItem('forge_local_session', JSON.stringify(mockUser));
    setSession({ user: mockUser });
    fetchLocalProjects();
    addLog("Sandbox session initiated in Local Mode.");
    showToast("Logged in via bypass mode", "success");
  };

  const saveUserProfileKey = async () => {
    if (!session) return;
    addLog("Updating profile configuration settings...");
    if (supabase) {
      await supabase.from('profiles').upsert({
        id: session.user.id,
        email: session.user.email,
        openrouter_key: openRouterKey
      });
    } else {
      localStorage.setItem('forge_local_key', openRouterKey);
    }
    addLog("Credentials stored securely inside active profiles.");
    showToast("Profile key updated", "success");
  };

  const handleOAuthLogin = async (provider: 'github' | 'google') => {
    if (!supabase) {
      showToast("Supabase parameters unconfigured. Use offline database bypass.", "error");
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin }
    });
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem('forge_local_session');
    }
    setSession(null);
    showToast("Logged out successfully", "info");
  };

  // --- API Proxy Handshakes ---
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

  const cleanAndParseJSON = (text: string) => {
    let raw = text.trim();
    if (raw.startsWith("```json")) raw = raw.substring(7, raw.length - 3).trim();
    else if (raw.startsWith("```")) raw = raw.substring(3, raw.length - 3).trim();
    try {
      return JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error("Could not parse agent output JSON schema.");
    }
  };

  // --- Step 1: Product Manager Agent ---
  const startPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openRouterKey || !prompt) {
      showToast("Configure your OpenRouter API Token & input instructions.", "error");
      return;
    }
    setCurrentStep('PM_SPEC');
    addLog("Product Manager Agent analyzing user blueprint directives...");
    setActiveTab('logs');

    try {
      const pmInstruction = `You are an expert Principal Product Manager. Analyze the user prompt and generate an absolute, detailed Technical Specification Document in Markdown. Outline structural layouts, design intents, and technical rules.`;
      const spec = await callAgentAPI(pmInstruction, `Requirements: ${prompt}`);
      setPmSpec(spec);
      addLog("Product Manager Agent generated Technical Specification document.");
      showToast("Technical Specification created", "success");
      setCurrentStep('PM_APPROVE');
    } catch (err: any) {
      addLog(`PM turn failed: ${err.message}`);
      showToast("PM turn failed", "error");
      setCurrentStep('IDLE');
    }
  };

  const handlePmReview = async (isApproved: boolean) => {
    if (!isApproved) {
      setCurrentStep('PM_SPEC');
      addLog("Reviewing product specs with updates...");
      try {
        const spec = await callAgentAPI(`Update specifications layout reflecting feedback.`, `Spec:\n${pmSpec}\n\nFeedback:\n${feedback}`);
        setPmSpec(spec);
        setFeedback('');
        setCurrentStep('PM_APPROVE');
        addLog("Product specifications updated successfully.");
        showToast("Spec updated with revisions", "success");
      } catch (err: any) {
        addLog(`Revision failed: ${err.message}`);
      }
      return;
    }

    // Step 2: Move to Systems Architecture design
    setCurrentStep('ARCHITECT_DESIGN');
    addLog("Spec approved. Contacting Software Architect Agent...");
    try {
      const design = await callAgentAPI(`Design complete file systems layout, databases schema, and structure in markdown.`, `Specs:\n${pmSpec}`);
      setArchitectureLayout(design);
      addLog("Software Architect completed directory and schema layouts.");
      showToast("Architecture design completed", "success");
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
        const design = await callAgentAPI(`Update system architectures layout based on instructions.`, `Architecture:\n${architectureLayout}\n\nFeedback:\n${feedback}`);
        setArchitectureLayout(design);
        setFeedback('');
        setCurrentStep('ARCHITECT_APPROVE');
        addLog("System architecture layout designs updated.");
        showToast("Architecture updated with revisions", "success");
      } catch (err: any) {
        addLog(`Architect Revision failed: ${err.message}`);
      }
      return;
    }

    runDevelopmentPipeline();
  };

  // --- Step 3: Senior Developer Synthesis ---
  const runDevelopmentPipeline = async () => {
    setCurrentStep('DEVELOPMENT');
    addLog("Architect structures approved. Deploying Senior Developer synthesizer...");

    try {
      const devInstruction = `You are a Senior Fullstack Developer. Write fully operational code file mapping configurations based on architecture designs. 
Output your final result as a clean, strict JSON schema object:
{
  "files": [
    { "path": "package.json", "content": "..." },
    { "path": "index.html", "content": "..." },
    { "path": "test.js", "content": "..." }
  ]
}`;
      const codeOutput = await callAgentAPI(devInstruction, `Write complete logical files for this architecture:\n${architectureLayout}`, true);
      const parsed = cleanAndParseJSON(codeOutput);
      const projectFiles: ProjectFile[] = parsed.files;
      setFiles(projectFiles);
      if (projectFiles.length > 0) {
        setOpenTabs([projectFiles[0].path]);
        setActiveTabFile(projectFiles[0].path);
      }
      addLog("Source code files initialized.");
      showToast("Developer files completed", "success");

      if (webcontainer) {
        await mountFilesToSandbox(projectFiles);
        await runQALoop(projectFiles, 1);
      } else {
        await archiveActiveProject(projectFiles);
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

  // --- Step 4: QA/Self-Healing Refinement Loops ---
  const runQALoop = async (currentFiles: ProjectFile[], attempt: number) => {
    if (attempt > 3) {
      addLog("Maximum autonomous debugging attempts exceeded. Spinning dev servers...");
      await startPreviewServer();
      return;
    }

    setCurrentStep('TEST_RUNNING');
    addLog(`[Refinement Loop ${attempt}/3] Spawning test validation instances...`);

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
        addLog("✨ All workspace unit tests passed successfully!");
        showToast("Sandbox tests passed!", "success");
        await archiveActiveProject(currentFiles);
        await startPreviewServer();
      } else {
        addLog(`❌ Code failed unit testing constraints. Contacting QA Agent to auto-heal...`);
        showToast(`Sandbox validation check failed on attempt ${attempt}`, "error");
        const qaInstruction = `Analyze these test failure outputs and fix the errors. Output strict JSON files mapping. Logs:\n${testLogs}`;
        const patchText = await callAgentAPI(qaInstruction, `Files:\n${JSON.stringify(currentFiles)}`, true);
        const parsedPatch = cleanAndParseJSON(patchText);
        const patchedFiles = parsedPatch.files;

        setFiles(patchedFiles);
        if (patchedFiles.length > 0 && !activeTabFile) {
          setOpenTabs([patchedFiles[0].path]);
          setActiveTabFile(patchedFiles[0].path);
        }
        await mountFilesToSandbox(patchedFiles);
        await runQALoop(patchedFiles, attempt + 1);
      }
    } catch (err: any) {
      addLog(`QA Loop Fault: ${err.message}. Mounting static dev server.`);
      await archiveActiveProject(currentFiles);
      await startPreviewServer();
    }
  };

  const startPreviewServer = async () => {
    try {
      webcontainer!.on('port', (port, type, url) => {
        addLog(`Preview server channel active: ${url}`);
        setPreviewUrl(url);
        setActiveTab('preview');
        setCurrentStep('COMPLETED');
        showToast("Sandbox server is live!", "success");
      });
      await webcontainer!.spawn('npm', ['run', 'start']);
    } catch (err: any) {
      addLog(`Dev Server start failure: ${err.message}`);
      setCurrentStep('COMPLETED');
    }
  };

  const archiveActiveProject = async (projectFiles: ProjectFile[]) => {
    const newProject: SavedProject = {
      id: Math.random().toString(),
      title: repoName,
      prompt,
      spec: pmSpec,
      architecture: architectureLayout,
      files: projectFiles
    };
    if (supabase && session) {
      await supabase.from('projects').insert({
        user_id: session.user.id,
        title: repoName,
        prompt,
        spec: pmSpec,
        architecture: architectureLayout,
        files: projectFiles
      });
      fetchUserProjects(session.user.id);
    } else {
      saveLocalProject(newProject);
    }
  };

  const loadSavedProject = (project: SavedProject) => {
    setRepoName(project.title);
    setPrompt(project.prompt);
    setPmSpec(project.spec);
    setArchitectureLayout(project.architecture);
    setFiles(project.files);
    if (project.files.length > 0) {
      setOpenTabs([project.files[0].path]);
      setActiveTabFile(project.files[0].path);
    }
    setCurrentStep('COMPLETED');
    setActiveTab('logs');
    addLog(`Retrieved project archive: ${project.title}`);
    showToast(`Loaded "${project.title}"`, "info");
  };

  const downloadClientZip = async () => {
    const zip = new JSZip();
    files.forEach(f => zip.file(f.path, f.content));
    const data = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(data);
    link.download = `${repoName}.zip`;
    link.click();
    showToast("Project downloaded cleanly as ZIP", "success");
  };

  // Sync scroll positioning on custom editor line numbers
  const handleEditorScroll = () => {
    if (codeEditorRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = codeEditorRef.current.scrollTop;
    }
  };

  // Generate dynamic line indicators matching the active line-breaks count
  const renderLineNumbers = (fileContent: string) => {
    const lines = fileContent.split('\n').length;
    return Array.from({ length: lines }, (_, i) => (
      <div key={i} className="h-5 text-right pr-3 text-zinc-600 select-none">
        {i + 1}
      </div>
    ));
  };

  // --- Dynamic File Explorer Manipulations ---
  const handleCreateFile = () => {
    if (!newFilePath.trim()) return;
    const exists = files.some(f => f.path === newFilePath);
    if (exists) {
      showToast("A file with that path already exists.", "error");
      return;
    }
    const newFile: ProjectFile = { path: newFilePath, content: '' };
    const updatedFiles = [...files, newFile];
    setFiles(updatedFiles);
    
    // Add tab instantly
    if (!openTabs.includes(newFilePath)) {
      setOpenTabs(prev => [...prev, newFilePath]);
    }
    setActiveTabFile(newFilePath);
    setNewFilePath('');
    setShowNewFileInput(false);
    
    if (webcontainer) {
      webcontainer.fs.writeFile(newFilePath, '');
    }
    showToast(`Created file: ${newFilePath}`, "success");
  };

  const handleDeleteFile = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedFiles = files.filter(f => f.path !== path);
    setFiles(updatedFiles);
    
    // Remove tab
    const updatedTabs = openTabs.filter(t => t !== path);
    setOpenTabs(updatedTabs);
    
    if (activeTabFile === path) {
      setActiveTabFile(updatedTabs.length > 0 ? updatedTabs[0] : null);
    }
    
    if (webcontainer) {
      // Remove from browser sandbox file structure
      webcontainer.fs.rm(path);
    }
    showToast(`Deleted file: ${path}`, "info");
  };

  const handleOpenTab = (path: string) => {
    if (!openTabs.includes(path)) {
      setOpenTabs(prev => [...prev, path]);
    }
    setActiveTabFile(path);
  };

  const handleCloseTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedTabs = openTabs.filter(t => t !== path);
    setOpenTabs(updatedTabs);
    if (activeTabFile === path) {
      setActiveTabFile(updatedTabs.length > 0 ? updatedTabs[0] : null);
    }
  };

  const getActiveFileObj = () => {
    return files.find(f => f.path === activeTabFile) || null;
  };

  // Get active agent visual representation HUD
  const getActiveAgentHUD = () => {
    switch (currentStep) {
      case 'PM_SPEC':
        return { name: "Product Manager Agent", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30", icon: <ClipboardList size={16} /> };
      case 'ARCHITECT_DESIGN':
        return { name: "Systems Architect Agent", color: "text-pink-400 bg-pink-500/10 border-pink-500/30", icon: <Layers size={16} /> };
      case 'DEVELOPMENT':
        return { name: "Senior Developer Agent", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", icon: <Code size={16} /> };
      case 'TEST_RUNNING':
        return { name: "QA & Testing loop Agent", color: "text-amber-400 bg-amber-500/10 border-amber-500/30", icon: <TerminalIcon size={16} /> };
      default:
        return null;
    }
  };

  const activeAgent = getActiveAgentHUD();

  // --- RENDER VIEWS ---

  // Logged-out Landing Hero
  if (!session) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Glowing Background Radial Accents */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#18181b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

        <div className="max-w-xl text-center space-y-8 z-10">
          <div className="inline-flex items-center space-x-2 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-1.5 text-xs text-indigo-400 font-semibold shadow-inner">
            <Sparkles size={13} className="text-indigo-400" />
            <span>Autonomous Software Engineer OS</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
            Deploy Complex App Ideas <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400">In Browser Sandbox</span>
          </h1>
          
          <p className="text-zinc-400 text-sm leading-relaxed max-w-md mx-auto font-sans">
            A visual development workbench. Runs file compilers, executes unit tests, and serves live hot-reloaded previews in real time.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button 
              onClick={() => handleOAuthLogin('github')}
              className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 text-white font-bold px-6 py-3 rounded-lg border border-zinc-800 transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-md"
            >
              <Github size={16} /> Login via GitHub
            </button>
            <button 
              onClick={handleLocalBypassLogin}
              className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-95 text-white font-bold px-6 py-3 rounded-lg transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/20"
            >
              <PlayCircle size={16} /> Bypass database setup
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active Production Workspace
  return (
    <div className="h-screen w-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans text-xs overflow-hidden select-none">
      
      {/* Top Header Panel */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-900/10 flex items-center justify-between px-6 shrink-0 z-10 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="text-xs font-bold tracking-widest text-zinc-400 uppercase">ForgeAgent Studio</h1>
          {useLocalAuth && <span className="bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 px-2 py-0.5 rounded text-[10px]">LOCAL BYPASS MODE</span>}
        </div>

        <div className="flex items-center space-x-4">
          <select 
            value={selectedModel} 
            onChange={e => setSelectedModel(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded px-3 py-1 text-zinc-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B</option>
            <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
            <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
          </select>

          {/* Toggle Config Key bar */}
          <button 
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className={`p-1.5 rounded border border-zinc-800 transition ${isConfigOpen ? 'bg-zinc-800 text-white' : 'bg-zinc-950 text-zinc-400'}`}
          >
            <Settings size={14} />
          </button>

          {isConfigOpen && (
            <div className="flex items-center space-x-2 animate-fade-in">
              <input 
                type="password" 
                placeholder="OpenRouter Token" 
                value={openRouterKey} 
                onChange={e => setOpenRouterKey(e.target.value)} 
                className="bg-zinc-950 border border-zinc-800 rounded px-3 py-1 text-zinc-300 w-44 focus:outline-none focus:border-indigo-500"
              />
              <button onClick={saveUserProfileKey} className="bg-zinc-850 hover:bg-zinc-750 text-zinc-300 font-bold px-2.5 py-1 rounded transition border border-zinc-800">
                Save Key
              </button>
            </div>
          )}

          <button onClick={handleLogout} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 transition" title="Log Out">
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Panel 1: Collapsible Agent Controller sidebar */}
        <div className={`transition-all duration-300 shrink-0 border-r border-zinc-800 bg-zinc-900/5 flex flex-col ${isSidebarOpen ? 'w-[360px]' : 'w-0 overflow-hidden border-r-0'}`}>
          <div className="p-4 border-b border-zinc-800/60 space-y-3 shrink-0">
            <span className="text-xs uppercase font-bold text-zinc-400 tracking-wider">Project Specifications</span>
            <input 
              type="text" 
              placeholder="Workspace App Title" 
              value={repoName} 
              onChange={e => setRepoName(e.target.value)} 
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-indigo-300 font-mono"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* Active Agent operational visual HUD banner */}
            {activeAgent && (
              <div className={`p-3 rounded-lg border flex items-center gap-2.5 animate-pulse ${activeAgent.color}`}>
                {activeAgent.icon}
                <div className="flex-1">
                  <div className="font-bold text-[11px] tracking-wide uppercase">{activeAgent.name}</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">Synthesizing blueprint layers...</div>
                </div>
              </div>
            )}

            {currentStep === 'IDLE' ? (
              <form onSubmit={startPipeline} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Blueprint Instructions</label>
                  <textarea 
                    value={prompt} 
                    onChange={e => setPrompt(e.target.value)} 
                    rows={4} 
                    disabled={currentStep !== 'IDLE'}
                    placeholder="Describe your web application or program layout in detail..." 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-3 text-xs leading-relaxed focus:outline-none focus:border-zinc-700 resize-none font-sans disabled:opacity-50 text-zinc-300"
                  />
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded text-xs uppercase tracking-wider shadow-lg transition">
                  Compile Workspace
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                
                {/* Stepper tracking checkpoint */}
                <div className="border border-zinc-800 rounded p-4 bg-zinc-950/40 space-y-3">
                  <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest block">Active Operations Pipeline</span>
                  <div className="space-y-2.5 text-zinc-400">
                    {[
                      { key: 'PM_SPEC', label: 'PM Specification Map' },
                      { key: 'ARCHITECT_DESIGN', label: 'Architecture Designs' },
                      { key: 'DEVELOPMENT', label: 'Senior Developer Synthesis' },
                      { key: 'TEST_RUNNING', label: 'QA Test Verification' }
                    ].map((item, index) => {
                      const isActive = currentStep.startsWith(item.key) || currentStep === 'PM_APPROVE' && item.key === 'PM_SPEC' || currentStep === 'ARCHITECT_APPROVE' && item.key === 'ARCHITECT_DESIGN';
                      return (
                        <div key={index} className={`flex items-center gap-2.5 text-xs ${isActive ? 'text-indigo-400 font-bold' : 'text-zinc-600'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-indigo-500' : 'bg-zinc-800'}`} />
                          <span>{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Interactive Milestone Approval Gate 1 */}
                {currentStep === 'PM_APPROVE' && (
                  <div className="p-4 rounded-lg border border-indigo-900 bg-indigo-950/10 space-y-3 shadow-lg shadow-indigo-900/5">
                    <h3 className="text-xs font-bold uppercase text-indigo-400 flex items-center gap-1.5">
                      <ClipboardList size={14} /> Spec Review Requested
                    </h3>
                    <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">Please review the specifications draft document. Confirm or submit feedback revisions.</p>
                    <textarea 
                      value={feedback} 
                      onChange={e => setFeedback(e.target.value)} 
                      placeholder="Specify requirements to refine..." 
                      className="w-full h-16 bg-zinc-950 border border-zinc-800 rounded p-2 text-xs focus:outline-none resize-none font-sans text-zinc-300"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => handlePmReview(false)} className="bg-zinc-900 hover:bg-zinc-800 py-2 rounded text-xs font-semibold border border-zinc-800 transition text-zinc-300">Refine Spec</button>
                      <button onClick={() => handlePmReview(true)} className="bg-indigo-600 hover:bg-indigo-500 py-2 rounded text-xs font-semibold text-white shadow-md transition">Approve Spec</button>
                    </div>
                  </div>
                )}

                {/* Interactive Milestone Approval Gate 2 */}
                {currentStep === 'ARCHITECT_APPROVE' && (
                  <div className="p-4 rounded-lg border border-indigo-900 bg-indigo-950/10 space-y-3 shadow-lg shadow-indigo-900/5">
                    <h3 className="text-xs font-bold uppercase text-indigo-400 flex items-center gap-1.5">
                      <Layers size={14} /> Architecture Review Requested
                    </h3>
                    <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">Examine proposed packages configuration and directory tree maps before coding compilation starts.</p>
                    <textarea 
                      value={feedback} 
                      onChange={e => setFeedback(e.target.value)} 
                      placeholder="Request directory revisions..." 
                      className="w-full h-16 bg-zinc-950 border border-zinc-800 rounded p-2 text-xs focus:outline-none resize-none font-sans text-zinc-300"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => handleArchitectReview(false)} className="bg-zinc-900 hover:bg-zinc-800 py-2 rounded text-xs font-semibold border border-zinc-800 transition text-zinc-300">Refine Layout</button>
                      <button onClick={() => handleArchitectReview(true)} className="bg-indigo-600 hover:bg-indigo-500 py-2 rounded text-xs font-semibold text-white shadow-md transition">Approve Layout</button>
                    </div>
                  </div>
                )}

                {/* Reset operational loops */}
                {currentStep === 'COMPLETED' && (
                  <button 
                    onClick={() => { setCurrentStep('IDLE'); setFiles([]); setPmSpec(''); setArchitectureLayout(''); setOpenTabs([]); setActiveTabFile(null); }} 
                    className="w-full bg-zinc-900 hover:bg-zinc-850 py-2 rounded text-xs text-zinc-300 border border-zinc-850 uppercase tracking-wider"
                  >
                    Start New Blueprint Build
                  </button>
                )}
              </div>
            )}

            {/* Historical Saved Projects list */}
            {savedProjects.length > 0 && (
              <div className="border border-zinc-800 rounded p-3 bg-zinc-950/40 space-y-2 flex flex-col overflow-hidden max-h-[250px]">
                <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider flex items-center gap-1.5 shrink-0">
                  <History size={12} className="text-zinc-500" /> Project Archive
                </span>
                <div className="space-y-1 overflow-y-auto flex-1 pr-1">
                  {savedProjects.map((proj) => (
                    <button 
                      key={proj.id} 
                      onClick={() => loadSavedProject(proj)}
                      className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded text-left text-[11px] text-zinc-400 hover:bg-zinc-900 hover:text-white transition font-mono truncate border border-transparent hover:border-zinc-800"
                    >
                      <FolderGit2 size={12} className="text-indigo-400/80" />
                      <span className="truncate flex-1">{proj.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Column Toggle button for Sidebar Drawer */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute left-0 bottom-4 z-25 bg-zinc-900 border border-l-0 border-zinc-800 hover:bg-zinc-800 text-zinc-400 h-8 w-6 flex items-center justify-center rounded-r cursor-pointer"
        >
          {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Panel 2: Code Editor & Hierarchical File Explorer Column */}
        <div className="flex-1 flex overflow-hidden border-r border-zinc-800 bg-[#09090b]">
          
          {/* File Explorer list */}
          <div className={`transition-all duration-300 border-r border-zinc-850/80 bg-zinc-900/5 flex flex-col ${isFileExplorerOpen ? 'w-56 p-3' : 'w-0 overflow-hidden border-r-0 p-0'}`}>
            <div className="flex items-center justify-between mb-3 shrink-0">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Active Workspace</span>
              <button 
                onClick={() => setShowNewFileInput(!showNewFileInput)}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400"
              >
                <Plus size={13} />
              </button>
            </div>

            {showNewFileInput && (
              <div className="mb-3 space-y-1.5 animate-fade-in shrink-0">
                <input 
                  type="text" 
                  placeholder="e.g. index.css"
                  value={newFilePath}
                  onChange={e => setNewFilePath(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none"
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateFile(); }}
                />
                <button onClick={handleCreateFile} className="w-full bg-indigo-600 hover:bg-indigo-500 py-1 rounded text-[10px] font-bold uppercase">Add File</button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-0.5">
              {files.map((file, idx) => (
                <div 
                  key={idx} 
                  onClick={() => handleOpenTab(file.path)}
                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded text-left text-[11px] cursor-pointer transition ${activeTabFile === file.path ? 'bg-zinc-900 text-white font-bold border border-zinc-850' : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-white'}`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <FileCode size={12} className={activeTabFile === file.path ? 'text-indigo-400' : 'text-zinc-600'} />
                    <span className="truncate">{file.path}</span>
                  </div>
                  <button 
                    onClick={(e) => handleDeleteFile(file.path, e)}
                    className="opacity-0 group-hover:opacity-100 hover:text-rose-400 p-0.5 rounded"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Toggle Button for File Explorer list */}
          <button 
            onClick={() => setIsFileExplorerOpen(!isFileExplorerOpen)}
            className="h-8 w-4 bg-zinc-900 border border-l-0 border-zinc-800 hover:bg-zinc-800 text-zinc-400 flex items-center justify-center rounded-r cursor-pointer self-center shrink-0"
          >
            {isFileExplorerOpen ? <ChevronLeft size={10} /> : <ChevronRight size={10} />}
          </button>

          {/* Tabbed Code Editor pane */}
          <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
            
            {/* Open Tabs horizontal scroll bar */}
            {openTabs.length > 0 && (
              <div className="h-9 border-b border-zinc-850 bg-zinc-900/10 flex items-center overflow-x-auto px-2 space-x-1 shrink-0">
                {openTabs.map(tab => (
                  <div 
                    key={tab} 
                    onClick={() => handleOpenTab(tab)}
                    className={`h-7 px-3.5 flex items-center space-x-2 rounded-t text-[11px] cursor-pointer border-t-2 transition ${activeTabFile === tab ? 'bg-zinc-950 text-white font-bold border-indigo-500' : 'bg-transparent text-zinc-500 hover:text-zinc-300 border-transparent'}`}
                  >
                    <span>{tab}</span>
                    <button 
                      onClick={(e) => handleCloseTab(tab, e)}
                      className="hover:text-rose-400 rounded-full p-0.5"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Custom Code Editor Gutter Canvas */}
            <div className="flex-1 overflow-hidden relative">
              {getActiveFileObj() ? (
                <div className="h-full flex flex-col overflow-hidden">
                  <div className="flex-1 flex overflow-hidden font-mono leading-relaxed relative text-zinc-300">
                    
                    {/* Line numbers rendering */}
                    <div 
                      ref={lineNumbersRef}
                      className="w-12 select-none border-r border-zinc-900 text-right pr-2 py-4 font-mono text-zinc-600 bg-zinc-950/40 overflow-hidden shrink-0"
                    >
                      {renderLineNumbers(getActiveFileObj()!.content)}
                    </div>
                    
                    {/* Native Textarea styled precisely */}
                    <textarea 
                      ref={codeEditorRef}
                      value={getActiveFileObj()!.content}
                      onScroll={handleEditorScroll}
                      onChange={e => {
                        const val = e.target.value;
                        const updated = files.map(f => f.path === activeTabFile ? { ...f, content: val } : f);
                        setFiles(updated);
                        if (webcontainer) webcontainer.fs.writeFile(activeTabFile!, val);
                      }}
                      className="flex-1 bg-transparent text-emerald-400/95 p-4 focus:outline-none resize-none overflow-auto whitespace-pre font-mono leading-relaxed h-full border-none outline-none selection:bg-indigo-500/20"
                      spellCheck="false"
                    />
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 italic font-mono space-y-2">
                  <FileText size={24} className="text-zinc-700" />
                  <span>Select or create a file to view code.</span>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Panel 3: Terminal Logs & Active Sandbox Preview IFrame Column */}
        <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
          
          <div className="h-9 border-b border-zinc-800 bg-zinc-900/10 flex items-center justify-between px-4 shrink-0">
            <div className="flex space-x-2">
              <button 
                onClick={() => setActiveTab('logs')}
                className={`h-7 px-3 flex items-center text-[10px] uppercase font-bold tracking-wider rounded transition ${activeTab === 'logs' ? 'bg-zinc-800 text-white border border-zinc-700/50' : 'text-zinc-500'}`}
              >
                Logs & Specs
              </button>
              <button 
                onClick={() => setActiveTab('preview')}
                className={`h-7 px-3 flex items-center text-[10px] uppercase font-bold tracking-wider rounded transition ${activeTab === 'preview' ? 'bg-zinc-800 text-white border border-zinc-700/50' : 'text-zinc-500'}`}
              >
                Sandbox Preview
              </button>
            </div>

            {activeTab === 'preview' && previewUrl && (
              <a 
                href={previewUrl} 
                target="_blank" 
                rel="noreferrer"
                className="text-zinc-400 hover:text-white flex items-center gap-1 text-[10px] uppercase font-bold"
              >
                <span>External Open</span>
                <ExternalLink size={10} />
              </a>
            )}
          </div>

          <div className="flex-1 overflow-hidden relative p-4">
            
            {activeTab === 'logs' && (
              <div className="h-full flex flex-col space-y-4 overflow-y-auto pr-1">
                {/* Console execution view */}
                <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 h-52 flex flex-col shadow-inner">
                  <span className="text-[10px] text-zinc-500 block border-b border-zinc-800/80 pb-2 mb-2 tracking-wider">SYSTEM LOG MONITOR</span>
                  <div className="flex-1 overflow-y-auto space-y-1.5 text-zinc-300 font-mono">
                    {logs.map((log, index) => <div key={index}>{log}</div>)}
                    <div ref={logsEndRef} />
                  </div>
                </div>

                {/* Markdown Documents block */}
                <div className="grid grid-cols-1 gap-4 flex-1">
                  {pmSpec && (
                    <div className="bg-zinc-900/10 border border-zinc-800 rounded-lg p-4 h-80 overflow-y-auto">
                      <span className="text-indigo-400 font-bold block border-b border-zinc-850 pb-2 mb-2 uppercase tracking-wider text-[10px]">Product Specifications</span>
                      <div className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed pt-2 font-sans">{pmSpec}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'preview' && (
              <div className="h-full w-full bg-white rounded-lg border border-zinc-800 overflow-hidden relative shadow-2xl flex flex-col">
                
                {/* Visual address bar / Control toolbar */}
                <div className="h-9 border-b border-zinc-200 bg-zinc-50 flex items-center px-4 justify-between shrink-0">
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => { const temp = previewUrl; setPreviewUrl(null); setTimeout(() => setPreviewUrl(temp), 50); }}
                      className="p-1 rounded hover:bg-zinc-200 text-zinc-600"
                    >
                      <RefreshCw size={11} />
                    </button>
                    <div className="bg-zinc-200/60 border border-zinc-300/40 rounded px-2.5 py-0.5 text-[10px] text-zinc-500 font-mono max-w-sm truncate select-all">
                      {previewUrl || 'localhost:3000'}
                    </div>
                  </div>
                </div>

                <div className="flex-1 relative bg-slate-900">
                  {previewUrl ? (
                    <iframe src={previewUrl} className="w-full h-full border-0 bg-white" />
                  ) : (
                    <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center space-y-4 p-6 text-zinc-400">
                      <div className="flex flex-col items-center space-y-2">
                        <RefreshCw className="animate-spin text-indigo-500" size={24} />
                        <span className="text-xs font-mono">Compiling testing modules inside browser sandbox...</span>
                      </div>
                      {testOutput && (
                        <div className="w-full max-w-2xl bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 font-mono text-xs shadow-lg">
                          <span className="text-rose-400 font-bold block border-b border-zinc-850 pb-2 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                            <AlertTriangle size={14} /> Sandbox unit testing errors detected
                          </span>
                          <div className="text-zinc-300 whitespace-pre-wrap overflow-y-auto max-h-40 leading-relaxed">{testOutput}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>
        </div>

      </div>

      {/* Floating custom Toast Notifications container */}
      <div className="absolute bottom-6 right-6 space-y-2 z-50 pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`p-3.5 rounded-lg border shadow-xl text-xs font-bold tracking-wide pointer-events-auto flex items-center gap-2 animate-slide-up ${
              toast.type === 'success' ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-300' :
              toast.type === 'error' ? 'bg-rose-950/80 border-rose-500/30 text-rose-300' :
              'bg-zinc-900/90 border-zinc-800 text-zinc-200'
            }`}
          >
            <Info size={14} />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Booting Sandbox Loader Overlay */}
      {isBootingSandbox && (
        <div className="absolute inset-0 bg-[#09090b]/95 z-50 flex flex-col items-center justify-center space-y-3 font-mono text-xs">
          <RefreshCw className="animate-spin text-indigo-500" size={28} />
          <span className="text-zinc-400">Loading Node.js WebAssembly compiler sandbox...</span>
        </div>
      )}
    </div>
  );
}
