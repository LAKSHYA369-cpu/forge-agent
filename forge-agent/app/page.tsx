'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Sparkles, 
  PlayCircle, 
  AlertTriangle, 
  FileText, 
  Plus, 
  Trash2, 
  X, 
  ExternalLink, 
  Info,
  Disc,
  MessageSquare,
  Mail,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

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

interface ChatMessage {
  id: string;
  sender: 'User' | 'Product Manager' | 'Systems Architect' | 'Senior Developer' | 'QA Engineer' | 'System';
  avatarColor: string;
  content: string;
  timestamp: string;
}

// Thread-Safe WebContainer Singleton Boot Instantiation to Prevent Double-Boot Failures
let webcontainerInstancePromise: Promise<WebContainer> | null = null;
async function getWebContainerInstance(): Promise<WebContainer> {
  if (!webcontainerInstancePromise) {
    webcontainerInstancePromise = WebContainer.boot();
  }
  return webcontainerInstancePromise;
}

export default function Workspace() {
  const [supabase, setSupabase] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [useLocalAuth, setUseLocalAuth] = useState(false);
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [directEmailInput, setDirectEmailInput] = useState('');
  const [prompt, setPrompt] = useState('');
  const [repoName, setRepoName] = useState('forge-application');
  const [selectedModel, setSelectedModel] = useState('meta-llama/llama-3.3-70b-instruct');

  // Multi-Agent Pipeline States
  const [currentStep, setCurrentStep] = useState<Step>('IDLE');
  const [logs, setLogs] = useState<string[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [pmSpec, setPmSpec] = useState<string>('');
  const [architectureLayout, setArchitectureLayout] = useState<string>('');
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTabFile, setActiveTabFile] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'logs'>('logs');

  // Layout Panels
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(true);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Revisions & Feedback
  const [feedback, setFeedback] = useState('');
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [newFilePath, setNewFilePath] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // WebContainer Sandbox States
  const [webcontainer, setWebcontainer] = useState<WebContainer | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [testOutput, setTestOutput] = useState<string>('');
  const [isBootingSandbox, setIsBootingSandbox] = useState(true);

  // Scroll/Editor Refs
  const logsEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const codeEditorRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const writeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Global helper function to retrieve local projects
  const fetchLocalProjects = useCallback(() => {
    const data = localStorage.getItem('forge_local_projects');
    if (data) setSavedProjects(JSON.parse(data));
  }, []);

  // Safe Client-Side Client Initialization
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      setUseLocalAuth(true);
      const localUser = localStorage.getItem('forge_local_session');
      if (localUser) {
        setSession({ user: JSON.parse(localUser) });
        fetchLocalProjects();
      }
      addLog("Database credentials missing. Running in local bypass mode.");
      return;
    }

    const client = createClient(url, key);
    setSupabase(client);

    client.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        client.from('profiles').select('openrouter_key').eq('id', session.user.id).single().then(({ data }) => {
          if (data?.openrouter_key) setOpenRouterKey(data.openrouter_key);
        });
        client.from('projects').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).then(({ data }) => {
          if (data) setSavedProjects(data as SavedProject[]);
        });
      }
    });

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        client.from('profiles').select('openrouter_key').eq('id', session.user.id).single().then(({ data }) => {
          if (data?.openrouter_key) setOpenRouterKey(data.openrouter_key);
        });
        client.from('projects').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).then(({ data }) => {
          if (data) setSavedProjects(data as SavedProject[]);
        });
      }
    });

    return () => {
      subscription.unsubscribe();
      if (writeTimeoutRef.current) clearTimeout(writeTimeoutRef.current);
    };
  }, [fetchLocalProjects]);

  // WebContainer Singleton initialization
  useEffect(() => {
    let active = true;
    async function bootSandbox() {
      try {
        addLog("Booting sandboxed system WebContainer layers...");
        const instance = await getWebContainerInstance();
        if (active) {
          setWebcontainer(instance);
          setIsBootingSandbox(false);
          addLog("WebAssembly isolated browser sandbox running successfully.");
        }
      } catch (err: any) {
        if (active) {
          addLog(`Sandbox failed to load: ${err.message}. (COOP/COEP isolation headers required)`);
          setIsBootingSandbox(false);
        }
      }
    }
    bootSandbox();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const addChatMessage = useCallback((sender: ChatMessage['sender'], content: string, color: string) => {
    setChatHistory(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        sender,
        avatarColor: color,
        content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  }, []);

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { message, type, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const saveUserProfileKey = async () => {
    if (!session) return;
    addLog("Updating profile configuration settings...");
    if (supabase && !useLocalAuth) {
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

  const handleOAuthLogin = async (provider: 'github' | 'google' | 'discord') => {
    if (!supabase) {
      showToast("Supabase parameters unconfigured. Use offline database bypass.", "error");
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin }
    });
  };

  const handleDirectEmailBypass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directEmailInput.trim()) {
      showToast("Please enter a valid email address.", "error");
      return;
    }
    const mockUser = { id: 'direct_email_user', email: directEmailInput.trim() };
    localStorage.setItem('forge_local_session', JSON.stringify(mockUser));
    setSession({ user: mockUser });
    fetchLocalProjects();
    addLog(`Direct access session initiated for email: ${directEmailInput}`);
    showToast("Logged in successfully", "success");
  };

  const handleLogout = async () => {
    if (supabase && !useLocalAuth) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem('forge_local_session');
    }
    setSession(null);
    showToast("Logged out successfully", "info");
  };

  // --- API Proxy Handshakes ---
  const callAgentAPI = async (systemInstruction: string, userPrompt: string, useJson: boolean = false) => {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction, userPrompt, openRouterKey, useJson, model: selectedModel })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed API transaction.");
    return data.content;
  };

  const safeWriteSandboxFile = async (container: WebContainer, filePath: string, content: string) => {
    const parts = filePath.split('/');
    if (parts.length > 1) {
      const dirPath = parts.slice(0, -1).join('/');
      await container.fs.mkdir(dirPath, { recursive: true });
    }
    await container.fs.writeFile(filePath, content);
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
    setChatHistory([]); 
    addChatMessage('User', prompt, 'bg-indigo-500');
    addChatMessage('Product Manager', 'Analyzing requirements. Structuring product specifications outline in your requested language...', 'bg-indigo-400');
    setActiveTab('logs');

    try {
      const pmInstruction = `You are an expert Principal Product Manager. Analyze the user instructions and build a rigorous, comprehensive Technical Specification Document in Markdown. Incorporate clean layout wireframe designs, functional logic requirements, and list all required features clearly.
CRITICAL LANGUAGE LAW: Detect the human language used by the user in their prompt. You MUST output the entire technical specification document, your thoughts, and responses in that SAME human language (e.g. if requested in Hindi, write in Hindi; if in Spanish, write in Spanish). Do not use English unless the user requested it.`;
      
      const spec = await callAgentAPI(pmInstruction, `Requirements: ${prompt}`);
      setPmSpec(spec);
      addLog("Product Manager Agent generated Technical Specification document.");
      addChatMessage('Product Manager', `Technical Specification completed successfully.\n\n${spec.substring(0, 300)}...\n\n**Please review and approve below.**`, 'bg-indigo-400');
      setCurrentStep('PM_APPROVE');
    } catch (err: any) {
      addLog(`PM turn failed: ${err.message}`);
      addChatMessage('System', `PM Pipeline crashed: ${err.message}`, 'bg-red-500');
      setCurrentStep('IDLE');
    }
  };

  const handlePmReview = async (isApproved: boolean) => {
    if (!isApproved) {
      setCurrentStep('PM_SPEC');
      addLog("Reviewing product specs with updates...");
      addChatMessage('User', `Revisions requested: ${feedback}`, 'bg-indigo-500');
      addChatMessage('Product Manager', "Processing specifications updates based on your feedback...", 'bg-indigo-400');
      try {
        const spec = await callAgentAPI(`Update specifications layout reflecting feedback. Match the user's human language.`, `Spec:\n${pmSpec}\n\nFeedback:\n${feedback}`);
        setPmSpec(spec);
        setFeedback('');
        addChatMessage('Product Manager', `Specs updated successfully.\n\n${spec.substring(0, 300)}...\n\n**Please review and approve.**`, 'bg-indigo-400');
        setCurrentStep('PM_APPROVE');
        addLog("Product specifications updated successfully.");
      } catch (err: any) {
        addLog(`Revision failed: ${err.message}`);
      }
      return;
    }

    addChatMessage('User', "Technical Specification Approved.", 'bg-indigo-500');
    setCurrentStep('ARCHITECT_DESIGN');
    addLog("Spec approved. Contacting Software Architect Agent...");
    addChatMessage('Systems Architect', "Designing database schemas, technology stacks, and system tree maps based on the approved spec...", 'bg-pink-400');
    try {
      const design = await callAgentAPI(`Design complete file systems layout, databases schema, and structure in markdown. Match the user's human language in text explanations.`, `Specs:\n${pmSpec}`);
      setArchitectureLayout(design);
      addLog("Software Architect completed directory and schema layouts.");
      addChatMessage('Systems Architect', `Architecture Layout designs generated.\n\n${design.substring(0, 300)}...\n\n**Please approve configuration layout.**`, 'bg-pink-400');
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
      addChatMessage('User', `Directory adjustments requested: ${feedback}`, 'bg-indigo-500');
      addChatMessage('Systems Architect', "Refining database systems and package structures...", 'bg-pink-400');
      try {
        const design = await callAgentAPI(`Update system architectures layout based on instructions. Match the user's human language.`, `Architecture:\n${architectureLayout}\n\nFeedback:\n${feedback}`);
        setArchitectureLayout(design);
        setFeedback('');
        addChatMessage('Systems Architect', `Designs updated successfully.\n\n${design.substring(0, 300)}...\n\n**Review and Approve.**`, 'bg-pink-400');
        setCurrentStep('ARCHITECT_APPROVE');
        addLog("System architecture layout designs updated.");
      } catch (err: any) {
        addLog(`Architect Revision failed: ${err.message}`);
      }
      return;
    }

    addChatMessage('User', "Architecture Layout Approved.", 'bg-indigo-500');
    runDevelopmentPipeline();
  };

  const runDevelopmentPipeline = async () => {
    setCurrentStep('DEVELOPMENT');
    addLog("Architect structures approved. Deploying Senior Developer synthesizer...");
    addChatMessage('Senior Developer', "Synthesizing clean, fully-formed code blocks inside the file explorer workspace...", 'bg-emerald-400');

    try {
      const devInstruction = `You are an expert Senior Fullstack Developer. Write fully operational code file mapping configurations based on architecture designs.
CRITICAL POLYGLOT RULES:
1. Write code in the exact programming languages, runtimes, and frameworks requested (HTML/JS/CSS, Node.js, Python, Rust, Go, C++, etc.).
2. Write complete, functional logic. Do not truncate. Never write placeholder comments like "// code goes here".
3. Write file comments, API documentation, and README descriptions in the same human language used by the user in their prompt.
Return your complete, corrected project file structure as a strict JSON object mapping with NO conversational markdown:
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
      addChatMessage('Senior Developer', `Code structures written successfully. Compiled ${projectFiles.length} files. Forwarding to QA sandbox testing checks...`, 'bg-emerald-400');

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

  const runQALoop = async (currentFiles: ProjectFile[], attempt: number) => {
    if (attempt > 3) {
      addLog("Maximum autonomous debugging attempts exceeded. Spinning dev servers...");
      addChatMessage('QA Engineer', "Maximum code validation loop reached. Launching web servers.", 'bg-amber-400');
      await startPreviewServer();
      return;
    }

    setCurrentStep('TEST_RUNNING');
    addLog(`[Refinement Loop ${attempt}/3] Spawning test validation instances...`);
    addChatMessage('QA Engineer', `[Validation Loop ${attempt}/3] Installing dependencies and executing test scripts...`, 'bg-amber-400');

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
        addChatMessage('QA Engineer', "✨ All validation checks passed! Generating deployment server instances...", 'bg-amber-400');
        await archiveActiveProject(currentFiles);
        await startPreviewServer();
      } else {
        addLog(`❌ Code failed unit testing constraints. Contacting QA Agent to auto-heal...`);
        addChatMessage('QA Engineer', `❌ Build validation failed. Self-healing engine activated. Re-patching error structures...`, 'bg-amber-400');
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
      let runScript = 'start';
      try {
        const pkgFile = files.find(f => f.path === 'package.json');
        if (pkgFile) {
          const pkg = JSON.parse(pkgFile.content);
          if (pkg.scripts?.dev) runScript = 'dev';
          if (pkg.scripts?.start) runScript = 'start';
        }
      } catch (e) {}

      webcontainer!.on('port', (port, type, url) => {
        addLog(`Live Sandbox preview active at: ${url}`);
        addChatMessage('System', `🚀 Build completed successfully! Your live preview is ready below.`, 'bg-indigo-500');
        setPreviewUrl(url);
        setActiveTab('preview');
        setCurrentStep('COMPLETED');
        showToast("Sandbox server is live!", "success");
      });
      await webcontainer!.spawn('npm', ['run', runScript]);
    } catch (err: any) {
      addLog(`Dev Server start failure: ${err.message}`);
      setCurrentStep('COMPLETED');
    }
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

  const handleEditorScroll = () => {
    if (codeEditorRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = codeEditorRef.current.scrollTop;
    }
  };

  const renderLineNumbers = (fileContent: string) => {
    const lines = fileContent.split('\n').length;
    return Array.from({ length: lines }, (_, i) => (
      <div key={i} className="h-5 text-right pr-3 text-zinc-600 select-none">
        {i + 1}
      </div>
    ));
  };

  const handleEditorChange = (val: string) => {
    if (!activeTabFile) return;
    
    const updated = files.map(f => f.path === activeTabFile ? { ...f, content: val } : f);
    setFiles(updated);

    if (writeTimeoutRef.current) clearTimeout(writeTimeoutRef.current);
    writeTimeoutRef.current = setTimeout(async () => {
      if (webcontainer) {
        await webcontainer.fs.writeFile(activeTabFile!, val);
      }
    }, 350); 
  };

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

  // Declare ActiveAgent HUD helper immediately before usage
  const activeAgent = getActiveAgentHUD();

  const handleCreateFile = async () => {
    if (!newFilePath.trim()) return;
    const exists = files.some(f => f.path === newFilePath);
    if (exists) {
      showToast("A file with that path already exists.", "error");
      return;
    }
    const newFile: ProjectFile = { path: newFilePath, content: '' };
    const updatedFiles = [...files, newFile];
    setFiles(updatedFiles);
    
    if (!openTabs.includes(newFilePath)) {
      setOpenTabs(prev => [...prev, newFilePath]);
    }
    setActiveTabFile(newFilePath);
    setNewFilePath('');
    setShowNewFileInput(false);
    
    if (webcontainer) {
      await safeWriteSandboxFile(webcontainer, newFilePath, '');
    }
    showToast(`Created file: ${newFilePath}`, "success");
  };

  const handleDeleteFile = async (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedFiles = files.filter(f => f.path !== path);
    setFiles(updatedFiles);
    
    const updatedTabs = openTabs.filter(t => t !== path);
    setOpenTabs(updatedTabs);
    
    if (activeTabFile === path) {
      setActiveTabFile(updatedTabs.length > 0 ? updatedTabs[0] : null);
    }
    
    if (webcontainer) {
      await webcontainer.fs.rm(path);
    }
    showToast(`Deleted file: ${path}`, "info");
  };

  // Logged-out Landing Hero
  if (!session) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Glowing Background Radial Accents */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#18181b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

        <div className="max-w-xl text-center space-y-8 z-10 w-full">
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

          {/* Centered OAuth Controls */}
          <div className="flex flex-col gap-3.5 max-w-sm mx-auto pt-4 w-full">
            <form onSubmit={handleDirectEmailBypass} className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 space-y-3 backdrop-blur-md">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center justify-center gap-1.5"><Mail size={12} /> Direct Email Access Bypass</span>
              <div className="flex gap-2">
                <input 
                  type="email" 
                  required
                  placeholder="Enter email to begin..."
                  value={directEmailInput}
                  onChange={e => setDirectEmailInput(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 font-sans"
                />
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 rounded-lg text-xs uppercase tracking-wider transition shrink-0">
                  Launch
                </button>
              </div>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-zinc-800/60"></div>
              <span className="flex-shrink mx-4 text-zinc-500 text-[9px] uppercase font-bold tracking-widest">Or authenticate via</span>
              <div className="flex-grow border-t border-zinc-800/60"></div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => handleOAuthLogin('github')}
                className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-2.5 rounded-lg border border-zinc-800 transition flex items-center justify-center gap-2 text-[11px] uppercase tracking-wider"
              >
                <Github size={14} /> GitHub
              </button>
              <button 
                onClick={() => handleOAuthLogin('discord')}
                className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold py-2.5 rounded-lg border border-zinc-800 transition flex items-center justify-center gap-2 text-[11px] uppercase tracking-wider"
              >
                <Disc size={14} /> Discord
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            className="bg-zinc-950 border border-zinc-800 rounded px-3 py-1 text-zinc-350 focus:outline-none focus:border-indigo-500 font-mono"
          >
            <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B Instruct</option>
            <option value="deepseek/deepseek-r1:free">DeepSeek R1 (Reasoning - FREE)</option>
            <option value="deepseek/deepseek-chat">DeepSeek V3 (Chat - FAST)</option>
            <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
            <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
            <option value="openai/gpt-4o">GPT-4o (Flagship)</option>
          </select>

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
                className="bg-zinc-950 border border-zinc-800 rounded px-3 py-1 text-zinc-300 w-44 focus:outline-none focus:border-indigo-500 font-mono"
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

      {/* Main Workspace split views */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Panel 1: Collapsible Agent Unified Chat Console sidebar */}
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

          {/* Unified Chat Timeline Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatHistory.length === 0 ? (
              <div className="text-center text-zinc-500 space-y-2 py-8 font-sans">
                <MessageSquare className="mx-auto text-zinc-700" size={24} />
                <p>System operational. Submit your blueprint specifications below to start conversation.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {chatHistory.map((msg) => (
                  <div key={msg.id} className="space-y-1.5 animate-slide-up">
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-zinc-950 ${
                        msg.sender === 'User' ? 'bg-indigo-400' :
                        msg.sender === 'Product Manager' ? 'bg-indigo-300' :
                        msg.sender === 'Systems Architect' ? 'bg-pink-400' :
                        msg.sender === 'Senior Developer' ? 'bg-emerald-400' :
                        'bg-amber-400'
                      }`}>
                        {msg.sender.substring(0, 1)}
                      </div>
                      <span className="text-[10px] font-bold text-zinc-400">{msg.sender}</span>
                      <span className="text-[9px] text-zinc-650 ml-auto">{msg.timestamp}</span>
                    </div>
                    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg p-3 text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans">
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/20 shrink-0 space-y-3">
            {currentStep === 'IDLE' ? (
              <form onSubmit={startPipeline} className="space-y-2">
                <textarea 
                  value={prompt} 
                  onChange={e => setPrompt(e.target.value)} 
                  placeholder="Ask ForgeAgent to design and compile an application..." 
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2.5 text-xs focus:outline-none focus:border-indigo-500 resize-none font-sans text-zinc-300"
                  rows={3}
                />
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded text-[11px] uppercase tracking-wider transition flex items-center justify-center gap-1.5">
                  <Send size={12} /> Send Instructions
                </button>
              </form>
            ) : (
              <div className="space-y-3">
                {currentStep === 'PM_APPROVE' && (
                  <div className="space-y-2.5">
                    <span className="text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1"><ClipboardList size={12} /> PM Approval Required</span>
                    <textarea 
                      value={feedback} 
                      onChange={e => setFeedback(e.target.value)} 
                      placeholder="Type modifications or approve spec..." 
                      className="w-full h-16 bg-zinc-950 border border-zinc-800 rounded p-2 text-xs focus:outline-none resize-none font-sans text-zinc-300"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => handlePmReview(false)} className="bg-zinc-900 hover:bg-zinc-850 py-1.5 rounded text-[10px] font-bold uppercase border border-zinc-800">Request Changes</button>
                      <button onClick={() => handlePmReview(true)} className="bg-indigo-600 hover:bg-indigo-500 py-1.5 rounded text-[10px] font-bold uppercase text-white">Approve Spec</button>
                    </div>
                  </div>
                )}

                {currentStep === 'ARCHITECT_APPROVE' && (
                  <div className="space-y-2.5">
                    <span className="text-[10px] uppercase font-bold text-pink-400 flex items-center gap-1"><Layers size={12} /> Architect Approval Required</span>
                    <textarea 
                      value={feedback} 
                      onChange={e => setFeedback(e.target.value)} 
                      placeholder="Type modifications or approve design..." 
                      className="w-full h-16 bg-zinc-950 border border-zinc-800 rounded p-2 text-xs focus:outline-none resize-none font-sans text-zinc-300"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => handleArchitectReview(false)} className="bg-zinc-900 hover:bg-zinc-855 py-1.5 rounded text-[10px] font-bold uppercase border border-zinc-800">Request Changes</button>
                      <button onClick={() => handleArchitectReview(true)} className="bg-indigo-600 hover:bg-indigo-500 py-1.5 rounded text-[10px] font-bold uppercase text-white">Approve Design</button>
                    </div>
                  </div>
                )}

                {currentStep !== 'PM_APPROVE' && currentStep !== 'ARCHITECT_APPROVE' && activeAgent && (
                  <div className="flex items-center gap-2 text-zinc-500 text-[10px] py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    <span>Agent is working. Sandbox files mounting...</span>
                  </div>
                )}
              </div>
            )}

            {savedProjects.length > 0 && currentStep === 'IDLE' && (
              <div className="pt-2 border-t border-zinc-800/60">
                <span className="text-[9px] uppercase text-zinc-500 font-bold block mb-1.5 tracking-wider flex items-center gap-1"><History size={10} /> Archived Projects</span>
                <div className="space-y-1 overflow-y-auto max-h-24">
                  {savedProjects.map((proj) => (
                    <button 
                      key={proj.id} 
                      onClick={() => loadSavedProject(proj)}
                      className="w-full flex items-center space-x-1.5 py-1 rounded text-left text-[10px] text-zinc-500 hover:text-white transition font-mono truncate"
                    >
                      <FolderGit2 size={10} className="text-indigo-500/60" />
                      <span className="truncate">{proj.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Toggle handle */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute left-0 bottom-4 z-25 bg-zinc-900 border border-l-0 border-zinc-800 hover:bg-zinc-800 text-zinc-400 h-8 w-6 flex items-center justify-center rounded-r cursor-pointer"
        >
          {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Right workspace panels container */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#09090b]">
          
          <div className="h-10 border-b border-zinc-800 bg-zinc-900/10 flex items-center justify-between px-6 shrink-0">
            <div className="flex space-x-2">
              {['logs', 'code', 'preview'].map((tab) => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab as any)} 
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold transition uppercase tracking-wider ${activeTab === tab ? 'bg-zinc-900 text-white border border-zinc-800' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  {tab === 'logs' && <TerminalIcon size={12} />}
                  {tab === 'code' && <Code size={12} />}
                  {tab === 'preview' && <Eye size={12} />}
                  <span className="capitalize">{tab}</span>
                </button>
              ))}
            </div>

            {files.length > 0 && (
              <button onClick={downloadClientZip} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs font-bold transition">
                <Download size={12} /> Download ZIP
              </button>
            )}
          </div>

          <div className="flex-1 overflow-hidden relative p-4">
            
            {activeTab === 'logs' && (
              <div className="h-full flex flex-col space-y-4 overflow-y-auto pr-1">
                {/* Console lists */}
                <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 h-52 flex flex-col shadow-inner">
                  <span className="text-[10px] text-zinc-500 block border-b border-zinc-800/80 pb-2 mb-2 tracking-wider font-mono">SYSTEM LOG MONITOR</span>
                  <div className="flex-1 overflow-y-auto space-y-1.5 text-zinc-300 font-mono">
                    {logs.map((log, index) => <div key={index}>{log}</div>)}
                    <div ref={logsEndRef} />
                  </div>
                </div>

                {/* Markdown specs display */}
                <div className="grid grid-cols-1 gap-4 flex-1">
                  {pmSpec && (
                    <div className="bg-zinc-900/10 border border-zinc-800 rounded-lg p-4 h-80 overflow-y-auto">
                      <span className="text-indigo-400 font-bold block border-b border-zinc-850 pb-2 mb-2 uppercase tracking-wider text-[10px]">Product Specifications Document</span>
                      <div className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed pt-2 font-sans">{pmSpec}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'code' && (
              <div className="h-full flex overflow-hidden border border-slate-800 rounded bg-slate-900/10">
                <div className="w-56 border-r border-slate-800 p-3 space-y-2 shrink-0 overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase text-slate-500 font-bold">Workspace Tree</span>
                    <button onClick={() => setShowNewFileInput(!showNewFileInput)} className="p-1 rounded hover:bg-zinc-800 text-zinc-400">
                      <Plus size={12} />
                    </button>
                  </div>

                  {showNewFileInput && (
                    <div className="mb-3 space-y-1.5 animate-fade-in shrink-0">
                      <input 
                        type="text" 
                        placeholder="e.g. src/app.js"
                        value={newFilePath}
                        onChange={e => setNewFilePath(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-355 focus:outline-none font-mono"
                        onKeyDown={e => { if (e.key === 'Enter') handleCreateFile(); }}
                      />
                      <button onClick={handleCreateFile} className="w-full bg-indigo-600 hover:bg-indigo-500 py-1 rounded text-[10px] font-bold uppercase">Add File</button>
                    </div>
                  )}

                  {files.map((file, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => handleOpenTab(file.path)}
                      className={`group flex items-center justify-between px-2 py-1.5 rounded text-left text-xs cursor-pointer ${activeTabFile === file.path ? 'bg-zinc-900 text-white font-bold border border-zinc-800' : 'text-zinc-400 hover:text-white'}`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <FileCode size={12} className={activeTabFile === file.path ? 'text-indigo-400' : 'text-zinc-650'} />
                        <span className="truncate">{file.path}</span>
                      </div>
                      <button onClick={(e) => handleDeleteFile(file.path, e)} className="opacity-0 group-hover:opacity-100 hover:text-rose-400 p-0.5 rounded">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950 font-mono text-xs">
                  {getActiveFileObj() ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      {/* File Workspace open Tabs */}
                      <div className="h-9 border-b border-zinc-855 bg-zinc-900/10 flex items-center overflow-x-auto px-2 space-x-1 shrink-0">
                        {openTabs.map(tab => (
                          <div 
                            key={tab} 
                            onClick={() => handleOpenTab(tab)}
                            className={`h-7 px-3.5 flex items-center space-x-2 rounded-t text-[11px] cursor-pointer border-t-2 transition ${activeTabFile === tab ? 'bg-zinc-950 text-white font-bold border-indigo-500' : 'bg-transparent text-zinc-500 hover:text-zinc-300 border-transparent'}`}
                          >
                            <span>{tab}</span>
                            <button onClick={(e) => handleCloseTab(tab, e)} className="hover:text-rose-400 rounded-full p-0.5">
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex-1 flex overflow-hidden font-mono leading-relaxed relative text-zinc-300">
                        <div 
                          ref={lineNumbersRef}
                          className="w-12 select-none border-r border-zinc-900 text-right pr-2 py-4 font-mono text-zinc-600 bg-zinc-950/40 overflow-hidden shrink-0"
                        >
                          {renderLineNumbers(getActiveFileObj()!.content)}
                        </div>
                        
                        <textarea 
                          ref={codeEditorRef}
                          value={getActiveFileObj()!.content}
                          onScroll={handleEditorScroll}
                          onChange={e => handleEditorChange(e.target.value)}
                          className="flex-1 bg-transparent text-emerald-400/95 p-4 focus:outline-none resize-none overflow-auto whitespace-pre font-mono leading-relaxed h-full border-none outline-none selection:bg-indigo-500/20"
                          spellCheck="false"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center italic text-zinc-650 font-mono">
                      // Select files from the navigation tree to display content.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'preview' && (
              <div className="h-full w-full bg-white rounded-lg border border-zinc-800 overflow-hidden relative shadow-2xl flex flex-col">
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
                  {previewUrl && (
                    <a 
                      href={previewUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-zinc-600 hover:text-zinc-900 flex items-center gap-1 text-[10px] font-bold"
                    >
                      <ExternalLink size={10} />
                    </a>
                  )}
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
                          <span className="text-rose-400 font-bold block border-b border-zinc-855 pb-2 mb-2 uppercase tracking-wide flex items-center gap-1.5">
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
