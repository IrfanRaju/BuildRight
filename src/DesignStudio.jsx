import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  FileImage,
  FilePlus2,
  FolderOpen,
  Fullscreen,
  History,
  LoaderCircle,
  MessageSquareText,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react';
import { buildDxf, buildElevationSvg, buildIfc, buildPlanSvg, buildSectionSvg, createDesignFromPrompt, designQuantities, resizeRoom, validateDesign } from './design-engine';
import { buildDrawing } from './cad/drawing';

const STORAGE_KEY = 'buildright-design-projects-v1';
const STARTER_PROMPTS = [
  'Design a modern 3-story commercial plaza with shops, offices, glass storefronts, and parking.',
  'Create a 2-floor modern house with 3 bedrooms, a kitchen, lounge, and garden.',
  'Plan a 4-floor office building with stairs, an elevator, and contemporary glass windows.',
];
const PROJECT_TYPES = ['House', 'Plaza', 'Shop', 'University', 'Office', 'Apartment', 'Road', 'Tunnel', 'Commercial Building'];
const LOCATIONS = ['Islamabad', 'Rawalpindi', 'Lahore', 'Karachi', 'Peshawar', 'Gilgit-Baltistan'];

function readProjects() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    console.error('Unable to read saved BuildRight designs:', error);
    return [];
  }
}

export default function DesignStudio() {
  const [projects, setProjects] = useState(readProjects);
  const [activeProject, setActiveProject] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [config, setConfig] = useState(null);
  const [tab, setTab] = useState('plan');
  const [sheet, setSheet] = useState('floor');
  const [versions, setVersions] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState(0);
  const [viewMode, setViewMode] = useState('Perspective');
  const [selection, setSelection] = useState(null);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generationSource, setGenerationSource] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1280);
  const [attachment, setAttachment] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [validationError, setValidationError] = useState('');
  const [storageNotice, setStorageNotice] = useState('');
  const [sceneForExport, setSceneForExport] = useState(null);
  const [configDraft, setConfigDraft] = useState({ type: 'House', width: 18, depth: 14, floors: 2, unit: 'meters', style: 'Modern', location: 'Islamabad', budget: '' });
  const fileInput = useRef(null);

  const svg = useMemo(() => {
    if (!config) return '';
    if (sheet === 'elevation') return buildElevationSvg(config);
    if (sheet === 'section') return buildSectionSvg(config);
    return buildPlanSvg(config, selectedFloor);
  }, [config, selectedFloor, sheet]);
  const quantities = useMemo(() => config ? designQuantities(config) : null, [config]);

  useEffect(() => {
    const token = localStorage.getItem('buildright-access-token');
    if (!token) return;
    let cancelled = false;
    fetch('/api/designs', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Project sync failed (${response.status}).`);
        return result.projects || [];
      })
      .then((remoteProjects) => {
        if (cancelled || !Array.isArray(remoteProjects)) return;
        const localProjects = readProjects();
        const remote = remoteProjects.map((project) => ({
          id: project.localId || project._id,
          serverId: project._id,
          title: project.title,
          config: project.config,
          messages: project.messages || [],
          source: project.source || 'BuildRight design service',
          updatedAt: project.updatedAt,
        }));
        const merged = [...remote, ...localProjects.filter((local) => !remote.some((item) => item.serverId === local.serverId))];
        setProjects(merged);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      })
      .catch((error) => {
        if (!cancelled) setStorageNotice(`Server project sync unavailable: ${error.message} Local saving still works.`);
      });
    return () => { cancelled = true; };
  }, []);

  const updateProjects = (next) => {
    setProjects(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.error('Unable to save BuildRight designs in this browser:', error);
      setValidationError('Could not save locally. Your browser storage may be full or disabled.');
    }
  };

  const startNew = () => {
    setActiveProject(null);
    setPrompt('');
    setMessages([]);
    setConfig(null);
    setGenerationSource('');
    setGenerationStatus('');
    setValidationError('');
    setSelectedFloor(0);
  };

  const openProject = (project) => {
    try {
      validateDesign(project.config);
    } catch (error) {
      setValidationError(`This saved design is invalid: ${error.message}`);
      return;
    }
    setActiveProject(project.id);
    setConfig(project.config);
    setVersions(project.versions || []);
    setMessages(project.messages || []);
    setPrompt('');
    setTab('plan');
    setSelectedFloor(0);
    setViewMode('Exterior');
    setGenerationSource(project.source || 'Saved in this browser');
    setValidationError('');
  };

  const generate = async (input = prompt, options = {}) => {
    const command = input.trim();
    if (!command || isGenerating) return;
    setIsGenerating(true);
    setValidationError('');
    setGenerationStatus('Reading your brief and preparing the building layout…');
    setPrompt('');
    const userMessage = { id: crypto.randomUUID(), role: 'user', text: command, attachment: attachment?.name };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    try {
      const base = options.newDesign ? {} : config || {};
      const proceduralConfig = createDesignFromPrompt(command, { ...base, ...options.configuration });
      validateDesign(proceduralConfig);

      let resultConfig = proceduralConfig;
      let source = 'Procedural geometry fallback';
      setGenerationStatus('Generating synchronized 2D plan and 3D geometry…');
      try {
        const token = localStorage.getItem('buildright-access-token');
        const response = await fetch('/api/designs/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ prompt: command, config: proceduralConfig, previousConfig: config }),
        });
        if (response.ok) {
          const result = await response.json();
          if (result?.config) {
            validateDesign(result.config);
            resultConfig = result.config;
            if (result.ai?.warning) resultConfig.assumptions = [...(resultConfig.assumptions || []), result.ai.warning];
            if (result.ai && result.ai.configured === false) resultConfig.assumptions = [...(resultConfig.assumptions || []), 'No external AI provider is configured. The plan and model were produced by the procedural geometry service.'];
            source = result.source || 'BuildRight design service';
          } else {
            throw new Error('The design service returned an incomplete response.');
          }
        } else {
          const contentType = response.headers.get('content-type') || '';
          if ([404, 502, 503, 504].includes(response.status) || (response.status >= 500 && !contentType.includes('application/json'))) {
            source = 'Procedural geometry fallback (API unavailable)';
          } else {
            const result = await response.json().catch(() => ({}));
            throw new Error(result.error || `Design service failed (${response.status}).`);
          }
        }
      } catch (error) {
        if (error instanceof TypeError || error.message.includes('Failed to fetch')) {
          source = 'Procedural geometry fallback (API unavailable)';
        } else {
          throw error;
        }
      }

      setVersions((current) => (config ? [{ id: crypto.randomUUID(), savedAt: new Date().toISOString(), title: config.title, config }, ...current].slice(0, 8) : current));
      setConfig(resultConfig);
      setConfigDraft({
        type: resultConfig.projectType,
        width: resultConfig.width,
        depth: resultConfig.depth,
        floors: resultConfig.floors,
        unit: resultConfig.unit,
        style: resultConfig.style,
        location: resultConfig.location,
        budget: resultConfig.budget,
      });
      setSelectedFloor((current) => Math.min(current, resultConfig.floors - 1));
      setGenerationSource(source);
      setGenerationStatus('Design ready. The plan and model use the same project configuration.');
      setMessages((previous) => [...previous, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: [
          options.newDesign
            ? `Created a ${resultConfig.floors}-floor ${resultConfig.style.toLowerCase()} ${resultConfig.projectType.toLowerCase()} concept from a structured specification. The 2D plan and 3D model use the same geometry.`
            : `Updated the existing design. The ${resultConfig.floors}-floor model and floor plan were regenerated from the shared project configuration.`,
          ...(resultConfig.assumptions || []),
          ...(resultConfig.editNotes || []),
          ...(resultConfig.unapplied || []),
          ...(resultConfig.validation?.warnings || []).slice(0, 3),
          ...(resultConfig.validation?.errors || []),
          ...(resultConfig.questions || []).map((question) => `Still needed: ${question}`),
        ].join(' '),
      }]);
      setAttachment(null);
    } catch (error) {
      setValidationError(error.message || 'The design could not be generated. Please check the dimensions and retry.');
      setGenerationStatus('');
      setMessages((previous) => [...previous, { id: crypto.randomUUID(), role: 'assistant', text: `I could not apply that design request: ${error.message}` }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const createFromConfiguration = () => {
    const configuration = { ...configDraft, projectType: configDraft.type };
    try {
      validateDesign(configuration);
      const brief = `${configuration.projectType}, ${configuration.floors} floors, ${configuration.width} by ${configuration.depth} ${configuration.unit}, ${configuration.style} style, ${configuration.location}`;
      generate(brief, { newDesign: true, configuration });
    } catch (error) {
      setValidationError(error.message);
    }
  };

  const saveProject = () => {
    if (!config) return;
    const now = new Date().toISOString();
    const current = projects.find((project) => project.id === activeProject);
    const project = {
      id: activeProject || crypto.randomUUID(),
      title: config.title || `${config.projectType} design`,
      config,
      messages,
      versions,
      source: generationSource,
      updatedAt: now,
    };
    updateProjects([project, ...projects.filter((item) => item.id !== project.id)]);
    setActiveProject(project.id);
    setGenerationStatus('Project saved in this browser.');
    const token = localStorage.getItem('buildright-access-token');
    if (token) {
      const method = project.serverId ? 'PUT' : 'POST';
      const endpoint = project.serverId ? `/api/designs/${project.serverId}` : '/api/designs';
      fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: project.title, config, messages, versions, source: generationSource }),
      }).then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Server save failed (${response.status}).`);
        const serverId = result.project?._id || project.serverId;
        if (serverId) updateProjects(readProjects().map((item) => item.id === project.id ? { ...item, serverId } : item));
        setGenerationStatus('Project saved in this browser and synced to your account.');
      }).catch((error) => setStorageNotice(`Server save unavailable: ${error.message} Your local copy is safe.`));
    }
  };

  const renameProject = (project) => {
    const title = window.prompt('Rename design', project.title);
    if (title?.trim()) {
      const updatedTitle = title.trim();
      updateProjects(projects.map((item) => item.id === project.id ? { ...item, title: updatedTitle, updatedAt: new Date().toISOString() } : item));
      const token = localStorage.getItem('buildright-access-token');
      if (token && project.serverId) {
        fetch(`/api/designs/${project.serverId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: updatedTitle }) })
          .then(async (response) => {
            if (!response.ok) {
              const result = await response.json().catch(() => ({}));
              throw new Error(result.error || `Rename failed (${response.status}).`);
            }
          })
          .catch((error) => setStorageNotice(`Server rename unavailable: ${error.message} The local title was updated.`));
      }
    }
  };

  const duplicateProject = (project) => {
    const copy = { ...project, id: crypto.randomUUID(), serverId: undefined, title: `${project.title} copy`, updatedAt: new Date().toISOString() };
    updateProjects([copy, ...projects]);
  };

  const deleteProject = (id) => {
    if (!window.confirm('Delete this saved design from this browser?')) return;
    updateProjects(projects.filter((project) => project.id !== id));
    if (activeProject === id) startNew();
    const project = projects.find((item) => item.id === id);
    const token = localStorage.getItem('buildright-access-token');
    if (token && project?.serverId) {
      fetch(`/api/designs/${project.serverId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
        .then(async (response) => {
          if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            throw new Error(result.error || `Delete failed (${response.status}).`);
          }
        })
        .catch((error) => setStorageNotice(`Server delete unavailable: ${error.message} The local copy was removed.`));
    }
  };

  const exportPlanPng = async () => {
    if (!svg) return;
    try {
      const image = new Image();
      const objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1800;
        canvas.height = 1160;
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objectUrl);
        canvas.toBlob((blob) => {
          if (!blob) {
            setValidationError('PNG export failed. Please try again.');
            return;
          }
          downloadBlob(blob, `${safeName(config.title)}-floor-${selectedFloor + 1}.png`);
        }, 'image/png');
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setValidationError('Could not render the floor plan for PNG export.');
      };
      image.src = objectUrl;
    } catch (error) {
      setValidationError(`PNG export failed: ${error.message}`);
    }
  };

  const exportPlanPdf = () => {
    if (!svg) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setValidationError('Allow pop-ups to print or save the plan as PDF.');
      return;
    }
    printWindow.document.write(`<html><head><title>${escapeHtml(config.title)} — Floor Plan</title><style>body{margin:24px;font-family:Arial,sans-serif}svg{width:100%;height:auto}</style></head><body>${svg}<script>window.onload=()=>window.print()<\/script></body></html>`);
    printWindow.document.close();
  };

  const downloadText = (contents, filename, type) => {
    downloadBlob(new Blob([contents], { type }), filename);
  };

  const exportSvg = () => {
    if (!svg) return;
    downloadText(svg, `${safeName(config.title)}-${sheet}.svg`, 'image/svg+xml');
  };

  const exportDxf = () => {
    if (!config) return;
    downloadText(buildDxf(config, selectedFloor), `${safeName(config.title)}-floor-${selectedFloor + 1}.dxf`, 'application/dxf');
  };

  const exportIfc = () => {
    if (!config) return;
    downloadText(buildIfc(config, selectedFloor), `${safeName(config.title)}-floor-${selectedFloor + 1}.ifc`, 'application/x-step');
  };

  const sendToEstimator = () => {
    if (!quantities) return;
    const perFloor = config.unit === 'feet' ? config.width * config.depth : quantities.builtUpSqFt / config.floors;
    sessionStorage.setItem('buildright-from-design', JSON.stringify({
      projectName: config.title,
      location: config.location,
      projectType: config.projectType,
      plotArea: config.plotArea || perFloor,
      plotUnit: config.plotUnit || (config.unit === 'feet' ? 'sq ft' : 'sq m'),
      coveredArea: Math.round(perFloor),
      coveredUnit: 'sq ft',
      floors: config.floors,
      note: quantities.missing.join(' '),
    }));
    window.location.assign('/estimator');
  };

  const exportStill = () => {
    const canvas = document.querySelector('[data-model-export] canvas');
    if (!canvas) {
      setValidationError('Open the 3D model before capturing a still. The image is a real-time PBR view of this model, not a separate illustration.');
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        setValidationError('The browser could not capture the 3D view. Try again after the model finishes drawing.');
        return;
      }
      downloadBlob(blob, `${safeName(config.title)}-pbr-still.png`);
    }, 'image/png');
  };

  const exportGlb = async () => {
    const model = document.querySelector('[data-model-export]');
    const threeScene = model?.__r3f?.root?.getState()?.scene || sceneForExport?.scene || sceneForExport;
    if (!threeScene) {
      setValidationError('3D model is still loading. Please wait, then retry the export.');
      return;
    }
    try {
      const exporter = new GLTFExporter();
      exporter.parse(threeScene, (result) => {
        const blob = new Blob([result], { type: 'model/gltf-binary' });
        downloadBlob(blob, `${safeName(config.title)}.glb`);
      }, (error) => setValidationError(`GLB export failed: ${error.message || error}`), { binary: true });
    } catch (error) {
      setValidationError(`GLB export failed: ${error.message}`);
    }
  };

  const commitConfig = (next) => {
    validateDesign(next);
    setHistory((current) => [...current, config].slice(-30));
    setFuture([]);
    setConfig(next);
    setValidationError('');
  };

  const adjustConfig = (key, value) => {
    try {
      const next = createDesignFromPrompt('', { ...config, [key]: value });
      commitConfig(next);
      setConfigDraft({ ...configDraft, [key === 'projectType' ? 'type' : key]: value });
      setSelectedFloor((current) => Math.min(current, next.floors - 1));
    } catch (error) {
      setValidationError(error.message);
    }
  };

  const undoEdit = () => {
    if (!history.length) return;
    setFuture((items) => [config, ...items]);
    setConfig(history[history.length - 1]);
    setHistory((current) => current.slice(0, -1));
  };

  const redoEdit = () => {
    if (!future.length) return;
    setHistory((current) => [...current, config]);
    setConfig(future[0]);
    setFuture((items) => items.slice(1));
  };

  const applyRoomSize = (event) => {
    event.preventDefault();
    if (selection?.kind !== 'room') return;
    const data = new FormData(event.currentTarget);
    try {
      const widened = resizeRoom(config, selection.name, 'width', data.get('width'));
      commitConfig(resizeRoom(widened, selection.name, 'depth', data.get('depth')));
    } catch (error) {
      setValidationError(error.message);
    }
  };

  const setExterior = (material) => {
    try {
      commitConfig({ ...config, exteriorMaterial: material });
    } catch (error) {
      setValidationError(error.message);
    }
  };

  return (
    <div className="min-h-[calc(100vh-76px)] bg-slate-100">
      <div className="relative flex min-h-[calc(100vh-76px)]">
        {sidebarOpen && (
          <aside className="absolute inset-y-0 left-0 z-40 w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4 shadow-xl xl:relative xl:z-auto xl:h-[calc(100vh-76px)] xl:shadow-none">
            <button onClick={startNew} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-orange px-4 py-3 text-sm font-bold text-white shadow-md shadow-orange-100 hover:bg-orange-500"><FilePlus2 className="h-4 w-4" /> New Design</button>
            <div className="mt-7 space-y-1">
              <div className="mb-2 flex items-center gap-2 px-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400"><Clock3 className="h-3.5 w-3.5" /> Recent Designs</div>
              {projects.length === 0 && <p className="px-2 py-3 text-xs leading-5 text-slate-500">Your generated projects will appear here.</p>}
              {projects.map((project) => (
                <div key={project.id} className={`group flex items-center gap-2 rounded-xl p-2 ${activeProject === project.id ? 'bg-orange-50' : 'hover:bg-slate-50'}`}>
                  <button onClick={() => openProject(project)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-semibold text-slate-700">{project.title}</div>
                    <div className="mt-0.5 text-[10px] text-slate-400">{new Date(project.updatedAt).toLocaleDateString()}</div>
                  </button>
                  <DesignProjectMenu project={project} onRename={renameProject} onDuplicate={duplicateProject} onDelete={deleteProject} />
                </div>
              ))}
            </div>
            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="mb-2 flex items-center gap-2 px-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400"><FolderOpen className="h-3.5 w-3.5" /> Saved Projects</p>
              {projects.length === 0 ? <p className="px-2 text-xs text-slate-400">Save a design to keep it here.</p> : projects.slice(0, 4).map((project) => <button key={project.id} onClick={() => openProject(project)} className="block w-full truncate rounded-lg px-2 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50">{project.title}</button>)}
            </div>
            <div className="mt-7 border-t border-slate-100 pt-5">
              <p className="mb-3 flex items-center gap-2 px-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400"><History className="h-3.5 w-3.5" /> Design History</p>
              {messages.slice(-4).map((message) => <p key={message.id} className="truncate px-2 py-1.5 text-xs text-slate-500">{message.role === 'user' ? 'You: ' : 'Designer: '}{message.text}</p>)}
              {messages.length === 0 && <p className="px-2 text-xs text-slate-400">No design history yet.</p>}
            </div>
            <div className="mt-7 rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Sparkles className="h-4 w-4 text-brand-orange" /> Geometry fallback</div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Creates editable conceptual geometry locally. It is not a structural or permit-ready architectural plan.</p>
            </div>
          </aside>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen((open) => !open)} aria-label="Toggle projects sidebar" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><FolderOpen className="h-4 w-4" /><ArrowLeft className={`ml-1 inline h-3 w-3 transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} /></button>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-orange">BuildRight AI Designer</p>
                <h1 className="text-base font-bold text-slate-900 sm:text-lg">{config?.title || 'Architectural Design Studio'}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {config && <span className="hidden max-w-56 truncate rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-semibold text-amber-800 sm:inline">{generationSource}</span>}
              <button onClick={saveProject} disabled={!config} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"><Check className="h-4 w-4" /> Save</button>
              <button onClick={startNew} className="rounded-lg bg-slate-900 p-2 text-white hover:bg-slate-700" aria-label="New design"><Plus className="h-4 w-4" /></button>
            </div>
          </div>

          {storageNotice && <div role="status" className="mx-4 mt-4 flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:mx-6"><span>{storageNotice}</span><button onClick={() => setStorageNotice('')} aria-label="Dismiss storage notice"><X className="h-4 w-4" /></button></div>}
          {validationError && <div role="alert" className="mx-4 mt-4 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-6"><span>{validationError}</span><button onClick={() => setValidationError('')} aria-label="Dismiss error"><X className="h-4 w-4" /></button></div>}

          {!config ? (
            <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 py-10 sm:px-8">
              <div className="mb-7 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-brand-orange"><WandSparkles className="h-7 w-7" /></div>
                <h2 className="mt-5 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Welcome to BuildRight AI Designer</h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">Describe your dream construction project, and our geometry engine will turn the brief into an editable 2D floor plan and interactive 3D concept.</p>
              </div>
              <div className="mb-5 grid gap-3 md:grid-cols-3">
                {STARTER_PROMPTS.map((example) => <button key={example} onClick={() => setPrompt(example)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left text-xs leading-5 text-slate-600 transition hover:border-orange-200 hover:shadow-sm">{example}<ArrowRight className="mt-3 h-4 w-4 text-brand-orange" /></button>)}
              </div>
              <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
                <button onClick={() => document.getElementById('design-config')?.classList.toggle('hidden')} className="flex w-full items-center justify-between text-left text-sm font-bold text-slate-800"><span>Optional quick configuration</span><ChevronDown className="h-4 w-4 text-slate-400" /></button>
                <div id="design-config" className="mt-4 hidden grid-cols-2 gap-3 md:grid-cols-4">
                  <label className="text-xs text-slate-500">Project type<select className="input mt-1" value={configDraft.type} onChange={(e) => setConfigDraft({ ...configDraft, type: e.target.value })}>{PROJECT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
                  <label className="text-xs text-slate-500">Width<input className="input mt-1" type="number" min="6" max="120" value={configDraft.width} onChange={(e) => setConfigDraft({ ...configDraft, width: Number(e.target.value) })} /></label>
                  <label className="text-xs text-slate-500">Depth<input className="input mt-1" type="number" min="6" max="120" value={configDraft.depth} onChange={(e) => setConfigDraft({ ...configDraft, depth: Number(e.target.value) })} /></label>
                  <label className="text-xs text-slate-500">Floors<input className="input mt-1" type="number" min="1" max="20" value={configDraft.floors} onChange={(e) => setConfigDraft({ ...configDraft, floors: Number(e.target.value) })} /></label>
                  <label className="text-xs text-slate-500">Units<select className="input mt-1" value={configDraft.unit} onChange={(e) => setConfigDraft({ ...configDraft, unit: e.target.value })}><option>meters</option><option>feet</option><option>marla</option><option>kanal</option></select></label>
                  <label className="text-xs text-slate-500">Style<select className="input mt-1" value={configDraft.style} onChange={(e) => setConfigDraft({ ...configDraft, style: e.target.value })}><option>Modern</option><option>Contemporary</option><option>Traditional</option><option>Minimalist</option></select></label>
                  <label className="text-xs text-slate-500">Location<select className="input mt-1" value={configDraft.location} onChange={(e) => setConfigDraft({ ...configDraft, location: e.target.value })}>{LOCATIONS.map((location) => <option key={location}>{location}</option>)}</select></label>
                  <label className="text-xs text-slate-500">Budget (optional)<input className="input mt-1" value={configDraft.budget} onChange={(e) => setConfigDraft({ ...configDraft, budget: e.target.value })} placeholder="PKR" /></label>
                  <button onClick={createFromConfiguration} className="col-span-2 rounded-xl bg-brand-orange px-4 py-2 text-xs font-bold text-white md:col-span-4">Generate from configuration</button>
                </div>
              </div>
              <ChatComposer prompt={prompt} setPrompt={setPrompt} onSend={() => generate(prompt, { newDesign: true })} isGenerating={isGenerating} attachment={attachment} setAttachment={setAttachment} fileInput={fileInput} />
              {isGenerating && <div role="status" className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-brand-orange"><LoaderCircle className="h-4 w-4 animate-spin" />{generationStatus}</div>}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
                <div className="flex gap-2">
                  <button onClick={() => setTab('plan')} className={`rounded-lg px-4 py-2 text-xs font-bold ${tab === 'plan' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>2D Floor Plan</button>
                  <button onClick={() => setTab('model')} className={`rounded-lg px-4 py-2 text-xs font-bold ${tab === 'model' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>3D Model</button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select aria-label="Floor selector" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700" value={selectedFloor} onChange={(e) => setSelectedFloor(Number(e.target.value))}>{Array.from({ length: config.floors }, (_, index) => <option key={index} value={index}>Floor {index + 1}</option>)}</select>
                  {tab === 'model' && <>
                    <select aria-label="Camera view" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700" value={viewMode} onChange={(e) => setViewMode(e.target.value)}>{['Perspective', 'Front', 'Rear', 'Left', 'Right', 'Top', 'Interior'].map((view) => <option key={view}>{view}</option>)}</select>
                    <button type="button" onClick={undoEdit} disabled={!history.length} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40">Undo</button>
                    <button type="button" onClick={redoEdit} disabled={!future.length} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40">Redo</button>
                    <button type="button" onClick={exportIfc} title="Downloads an IFC2x3 wall index. It is not a certified Revit solid model." className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">IFC index</button>
                  </>}
                  {tab === 'plan' ? <><select aria-label="Drawing sheet" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold" value={sheet} onChange={(event) => setSheet(event.target.value)}><option value="floor">Floor plan</option><option value="elevation">Elevation</option><option value="section">Section</option></select><button onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">−</button><span className="text-xs text-slate-500">{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((value) => Math.min(1.5, value + 0.1))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">+</button><button onClick={exportSvg} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">SVG</button><button onClick={exportDxf} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">DXF</button><button onClick={exportPlanPng} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold"><FileImage className="h-3.5 w-3.5" /> PNG</button><button onClick={exportPlanPdf} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold"><Download className="h-3.5 w-3.5" /> PDF</button></> : <><button onClick={exportGlb} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold"><Box className="h-3.5 w-3.5" /> GLB</button><button onClick={exportStill} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">PBR still</button><button onClick={() => setZoom((value) => Math.min(1.8, value + 0.1))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">Zoom +</button><button onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">Zoom −</button><button onClick={() => setZoom(1)} className="rounded-lg border border-slate-200 p-2 text-slate-600" aria-label="Reset camera"><RotateCcw className="h-3.5 w-3.5" /></button></>}
                  <button onClick={() => generate('Regenerate the current design from the existing project requirements.')} disabled={isGenerating} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" /> Regenerate</button>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_340px]">
                <section className="relative min-h-[420px] bg-slate-100 p-4 sm:p-6">
                  {tab === 'plan' ? (
                    <div className="flex h-full min-h-[390px] items-center justify-center overflow-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                      <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }} className="w-full max-w-5xl transition-transform" dangerouslySetInnerHTML={{ __html: svg }} />
                    </div>
                  ) : (
                    <div className="group relative h-[min(70vh,720px)] min-h-[480px] overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-sky-100 to-slate-200 shadow-sm" data-model-export>
                      <Canvas key={`${config.lighting || 'day'}-${config.exteriorMaterial || 'concrete'}`} camera={{ position: [Math.max(config.width, config.depth) * 1.8, Math.max(config.width, config.depth) * 1.2, Math.max(config.width, config.depth) * 1.8], fov: 42 }} shadows frameloop="always" gl={{ antialias: true, preserveDrawingBuffer: true }} onPointerMissed={() => setSelection(null)}>
                        <SceneReady onReady={setSceneForExport} targetY={viewMode === 'Interior' || viewMode === 'Top' ? selectedFloor * (config.unit === 'feet' ? 11 : 3.2) + 1.4 : config.floors * 1.4} />
                        <CameraRig view={viewMode} span={Math.max(config.width, config.depth) / zoom} targetY={viewMode === 'Interior' ? selectedFloor * (config.unit === 'feet' ? 11 : 3.2) + 1.5 : config.floors * 1.2} />
                        <ambientLight intensity={config.lighting === 'night' ? 0.15 : 0.45} />
                        <directionalLight position={[18, 28, 12]} intensity={config.lighting === 'night' ? 0.25 : 2.4} castShadow color={config.lighting === 'night' ? '#93c5fd' : '#fff7ed'} />
                        <hemisphereLight intensity={config.lighting === 'night' ? 0.2 : 0.55} color={config.lighting === 'night' ? '#1e3a8a' : '#f8fafc'} groundColor="#78716c" />
                        <BuildingGeometry config={config} floor={selectedFloor} viewMode={viewMode} selection={selection} onSelect={setSelection} />
                        <ContactShadows position={[0, 0, 0]} opacity={0.3} blur={2.5} far={45} />
                        <OrbitControls makeDefault target={[0, viewMode === 'Interior' ? selectedFloor * (config.unit === 'feet' ? 11 : 3.2) + 1.5 : config.floors * 1.2, 0]} enablePan enableZoom enableRotate />
                      </Canvas>
                      <button onClick={(event) => event.currentTarget.parentElement.requestFullscreen?.()} className="absolute right-3 top-3 rounded-lg border border-white/60 bg-white/80 p-2 text-slate-700 shadow-sm backdrop-blur"><Fullscreen className="h-4 w-4" /></button>
                      <div className="absolute bottom-3 left-3 max-w-md rounded-lg bg-white/85 px-3 py-2 text-xs text-slate-600 backdrop-blur">{viewMode} · Floor {selectedFloor + 1} of {config.floors} · Real-time PBR of this model, not an offline render or a separate picture</div>
                    </div>
                  )}
                  <p className="mt-3 text-center text-[11px] text-slate-500">Conceptual geometry for planning only; validate drawings, dimensions, structure, and code with qualified local professionals.</p>
                </section>

                <aside className="flex min-h-0 flex-col border-l border-slate-200 bg-white">
                  <div className="border-b border-slate-100 p-4">
                    <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-slate-900">Design specifications</h2><button onClick={() => setTab('plan')} className="text-xs font-semibold text-brand-orange"><Pencil className="mr-1 inline h-3.5 w-3.5" /> Edit</button></div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <label className="text-slate-500">Type<select className="input mt-1 !rounded-lg !px-2 !py-2" value={config.projectType} onChange={(e) => adjustConfig('projectType', e.target.value)}>{PROJECT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
                      <label className="text-slate-500">Floors<input className="input mt-1 !rounded-lg !px-2 !py-2" type="number" min="1" max="20" value={config.floors} onChange={(e) => adjustConfig('floors', Number(e.target.value))} /></label>
                      <label className="text-slate-500">Width ({config.unit})<input className="input mt-1 !rounded-lg !px-2 !py-2" type="number" min="6" max="120" value={config.width} onChange={(e) => adjustConfig('width', Number(e.target.value))} /></label>
                      <label className="text-slate-500">Depth ({config.unit})<input className="input mt-1 !rounded-lg !px-2 !py-2" type="number" min="6" max="120" value={config.depth} onChange={(e) => adjustConfig('depth', Number(e.target.value))} /></label>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">{config.style} · {config.location} · {config.rooms.length} rooms per floor · {config.exteriorMaterial || 'concrete'}</p>
                    {tab === 'model' && <ModelEditor config={config} selection={selection} onMaterial={setExterior} onRoomSize={applyRoomSize} />}
                    {quantities && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600"><p>Built-up area {quantities.builtUpSqFt.toLocaleString()} sq ft. Wall length {quantities.wallLength} {quantities.unit}.</p><button type="button" onClick={sendToEstimator} className="mt-2 font-semibold text-brand-orange">Estimate from this model</button></div>}
                    {versions.length > 0 && <div className="mt-3">{versions.map((version) => <button key={version.id} type="button" onClick={() => { setConfig(version.config); setValidationError(''); }} className="block w-full truncate py-1 text-left text-xs text-slate-500 hover:text-slate-800">Restore {new Date(version.savedAt).toLocaleTimeString()}</button>)}</div>}
                    {config.validation?.errors?.length > 0 && <p className="mt-2 text-xs text-red-600">{config.validation.errors[0]}</p>}
                  </div>
                  <div className="min-h-28 flex-1 space-y-3 overflow-y-auto p-4">
                    {messages.slice(-8).map((message) => <div key={message.id} className={`rounded-xl p-3 text-xs leading-5 ${message.role === 'user' ? 'ml-5 bg-orange-50 text-slate-700' : 'mr-3 bg-slate-50 text-slate-600'}`}><span className="mb-1 block font-bold text-slate-800">{message.role === 'user' ? 'You' : 'BuildRight Designer'}</span>{message.text}{message.attachment && <span className="mt-1 block text-slate-400">Attached: {message.attachment} (reference only)</span>}</div>)}
                    {isGenerating && <div className="flex items-center gap-2 text-xs text-brand-orange"><LoaderCircle className="h-4 w-4 animate-spin" />{generationStatus}</div>}
                  </div>
                  <div className="border-t border-slate-100 p-3">
                    <ChatComposer prompt={prompt} setPrompt={setPrompt} onSend={() => generate(prompt)} isGenerating={isGenerating} attachment={attachment} setAttachment={setAttachment} fileInput={fileInput} compact />
                  </div>
                </aside>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ChatComposer({ prompt, setPrompt, onSend, isGenerating, attachment, setAttachment, fileInput, compact = false }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm focus-within:border-orange-300">
      {attachment && <div className="mb-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"><span className="truncate">{attachment.name}</span><button onClick={() => setAttachment(null)} aria-label="Remove attachment"><X className="h-4 w-4" /></button></div>}
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend(); } }} rows={compact ? 2 : 3} placeholder="Describe a new building or tell me what to change…" className="w-full resize-none border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400" />
      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
        <div className="flex items-center gap-2"><button onClick={() => fileInput.current?.click()} aria-label="Attach reference" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Paperclip className="h-4 w-4" /></button><input ref={fileInput} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setAttachment(e.target.files?.[0] || null)} /><span className="text-[10px] text-slate-400">Design instructions are processed by the geometry fallback</span></div>
        <button onClick={onSend} disabled={!prompt.trim() || isGenerating} className="inline-flex items-center gap-2 rounded-lg bg-brand-orange px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-3.5 w-3.5" /> {isGenerating ? 'Generating' : 'Send'}</button>
      </div>
    </div>
  );
}

const SURFACE_MATERIALS = {
  concrete: { color: '#d6d3d1', roughness: 0.86, metalness: 0.02 },
  brick: { color: '#9a3412', roughness: 0.92, metalness: 0 },
  stone: { color: '#a8a29e', roughness: 0.78, metalness: 0.04 },
  wood: { color: '#a16207', roughness: 0.62, metalness: 0 },
  plaster: { color: '#fafaf9', roughness: 0.94, metalness: 0 },
  'stone-glass': { color: '#e7e5e4', roughness: 0.55, metalness: 0.08 },
};

function BuildingGeometry({ config, floor, viewMode, selection, onSelect }) {
  const width = Math.max(6, Number(config.width) || 18);
  const depth = Math.max(6, Number(config.depth) || 14);
  const drawing = buildDrawing(config, floor);
  const floorHeight = drawing.floorHeight;
  const stairX = config.stairsPosition === 'left' ? -width * 0.31 : config.stairsPosition === 'rear' ? 0 : width * 0.31;
  const exterior = SURFACE_MATERIALS[config.exteriorMaterial] || SURFACE_MATERIALS.concrete;

  if (['Road', 'Tunnel', 'Parking', 'Landscape', 'Bridge'].includes(config.projectType)) {
    return <group position={[0, -0.1, 0]}>
      <mesh position={[0, 0, 0]} receiveShadow><boxGeometry args={[width, 0.25, depth]} /><meshStandardMaterial color="#475569" /></mesh>
      {Array.from({ length: 5 }, (_, index) => <mesh key={index} position={[-width / 2 + ((index + 0.5) / 5) * width, 0.14, 0]}><boxGeometry args={[0.13, 0.02, depth * 0.4]} /><meshStandardMaterial color="#f8fafc" /></mesh>)}
      {config.projectType === 'Parking' && Array.from({ length: 3 }, (_, index) => <mesh key={index} position={[-width / 2 + ((index + 0.5) / 3) * width, 0.2, 0]}><boxGeometry args={[width / 4, 0.08, depth * 0.7]} /><meshStandardMaterial color="#334155" /></mesh>)}
      {config.projectType === 'Tunnel' && <>
        <mesh position={[-width / 2 + 0.2, 2.1, 0]}><boxGeometry args={[0.4, 4.2, depth]} /><meshStandardMaterial color="#94a3b8" /></mesh>
        <mesh position={[width / 2 - 0.2, 2.1, 0]}><boxGeometry args={[0.4, 4.2, depth]} /><meshStandardMaterial color="#94a3b8" /></mesh>
        <mesh position={[0, 4.1, 0]}><boxGeometry args={[width, 0.35, depth]} /><meshStandardMaterial color="#64748b" /></mesh>
      </>}
      <OrbitControls makeDefault enablePan enableZoom enableRotate />
    </group>;
  }

  const floorsToDraw = viewMode === 'Interior' ? [floor] : Array.from({ length: config.floors }, (_, index) => index);
  const choose = (payload) => (event) => {
    event.stopPropagation();
    onSelect?.(payload);
  };
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, -0.08, 0]} receiveShadow><boxGeometry args={[width + 16, 0.16, depth + 16]} /><meshStandardMaterial color="#a8a29e" roughness={0.95} /></mesh>
      {config.garden && <mesh position={[-width / 2 - 3, 0.02, 0]}><boxGeometry args={[3, 0.08, depth + 3]} /><meshStandardMaterial color="#4d7c0f" roughness={0.9} /></mesh>}
      {config.parking && <ParkingArea width={width} depth={depth} />}
      {floorsToDraw.map((floorIndex) => {
        const level = buildDrawing(config, floorIndex);
        return <group key={floorIndex}>
          <mesh position={[0, floorIndex * floorHeight + 0.08, 0]} receiveShadow><boxGeometry args={[width, 0.16, depth]} /><meshStandardMaterial color="#d6d3d1" roughness={0.8} /></mesh>
          {level.rooms.map((room) => {
            const active = selection?.kind === 'room' && selection.name === room.name && selection.floor === floorIndex;
            return <mesh key={room.id || room.name} position={[room.x + room.width / 2 - width / 2, floorIndex * floorHeight + 0.18, room.y + room.depth / 2 - depth / 2]} onClick={choose({ kind: 'room', name: room.name, floor: floorIndex, width: room.width, depth: room.depth })}>
              <boxGeometry args={[Math.max(room.width * 0.92, 0.4), 0.06, Math.max(room.depth * 0.92, 0.4)]} />
              <meshStandardMaterial color={active ? '#fdba74' : '#e7e5e4'} roughness={0.9} />
            </mesh>;
          })}
          {level.walls.filter((wall) => viewMode !== 'Interior' || wall.kind === 'internal' || wall.y1 > 0.2).map((wall, index) => {
            const length = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
            const angle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1);
            const wallId = `${floorIndex}-${index}`;
            const active = selection?.kind === 'wall' && selection.id === wallId;
            return <mesh key={wallId} position={[(wall.x1 + wall.x2) / 2 - width / 2, floorIndex * floorHeight + floorHeight / 2, (wall.y1 + wall.y2) / 2 - depth / 2]} rotation={[0, -angle, 0]} castShadow receiveShadow onClick={choose({ kind: 'wall', id: wallId, floor: floorIndex, length: Number(length.toFixed(2)), thickness: wall.thickness, role: wall.kind })}>
              <boxGeometry args={[length, floorHeight, wall.thickness]} />
              <meshStandardMaterial color={active ? '#fb923c' : wall.kind === 'external' ? exterior.color : '#f5f5f4'} roughness={wall.kind === 'external' ? exterior.roughness : 0.9} metalness={wall.kind === 'external' ? exterior.metalness : 0} />
            </mesh>;
          })}
          {level.openings.filter((item) => item.type === 'window').map((opening, index) => <mesh key={`window-${index}`} position={[opening.x - width / 2, floorIndex * floorHeight + floorHeight * 0.55, opening.y - depth / 2 + 0.08]}>
            <boxGeometry args={[opening.width, floorHeight * 0.38, 0.06]} />
            <meshPhysicalMaterial color="#dbeafe" roughness={0.05} metalness={0} transmission={0.72} thickness={0.2} transparent opacity={0.55} />
          </mesh>)}
          {level.openings.filter((item) => item.type === 'door' && floorIndex === 0).slice(0, 1).map((opening) => <mesh key="entry" position={[opening.x - width / 2, floorHeight * 0.38, depth / 2 + 0.05]}>
            <boxGeometry args={[opening.width * 0.7, floorHeight * 0.72, 0.08]} />
            <meshStandardMaterial color="#7c4a2d" roughness={0.55} />
          </mesh>)}
        </group>;
      })}
      <mesh position={[0, config.floors * floorHeight + 0.12, 0]} castShadow><boxGeometry args={[width + 0.4, 0.24, depth + 0.4]} /><meshStandardMaterial color="#44403c" roughness={0.72} metalness={0.05} /></mesh>
      {config.balconies && Array.from({ length: Math.max(config.floors - 1, 0) }, (_, index) => <mesh key={`balcony-${index}`} position={[0, (index + 1) * floorHeight + 0.16, depth / 2 + 1.2]}><boxGeometry args={[width * 0.46, 0.12, 2.2]} /><meshStandardMaterial color="#d6d3d1" roughness={0.8} /></mesh>)}
      {config.roofUtility && <mesh position={[width * 0.25, config.floors * floorHeight + 0.7, 0]}><boxGeometry args={[width * 0.28, 1.1, depth * 0.22]} /><meshStandardMaterial color="#78716c" roughness={0.6} metalness={0.2} /></mesh>}
      {config.lighting === 'night' && <pointLight position={[0, floor * floorHeight + 2, 0]} intensity={8} distance={Math.max(width, depth)} color="#fdba74" />}
      <InteriorStairs x={stairX} y={floor * floorHeight} z={config.stairsPosition === 'rear' ? -depth * 0.25 : 0} />
      <Trees width={width} depth={depth} />
    </group>
  );
}

function CameraRig({ view, span, targetY }) {
  const { camera } = useThree();
  useEffect(() => {
    const distance = Math.max(span, 8) * 1.7;
    const placements = {
      Perspective: [distance, distance * 0.72, distance],
      Front: [0, targetY + span * 0.25, distance],
      Rear: [0, targetY + span * 0.25, -distance],
      Left: [-distance, targetY + span * 0.25, 0],
      Right: [distance, targetY + span * 0.25, 0],
      Top: [0, distance * 1.6, 0.01],
      Interior: [0, targetY, span * 0.15],
    };
    const [x, y, z] = placements[view] || placements.Perspective;
    camera.position.set(x, y, z);
    camera.lookAt(0, view === 'Top' ? 0 : targetY, 0);
  }, [camera, span, targetY, view]);
  return null;
}

function ModelEditor({ config, selection, onMaterial, onRoomSize }) {
  const materials = ['concrete', 'brick', 'stone', 'wood', 'plaster', 'stone-glass'];
  return (
    <div className="mt-3 rounded-xl border border-slate-200 p-3 text-xs">
      <p className="font-bold text-slate-800">3D model editor</p>
      <p className="mt-1 text-slate-500">Click a floor pad or wall. Material changes do not change dimensions. Room edits update the plan and the model together.</p>
      <div className="mt-2 flex flex-wrap gap-1">{materials.map((material) => <button key={material} type="button" onClick={() => onMaterial(material)} className={`rounded-full px-2 py-1 ${config.exteriorMaterial === material ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>{material}</button>)}</div>
      {selection?.kind === 'room' && (
        <form key={`${selection.name}-${selection.floor}`} onSubmit={onRoomSize} className="mt-3 grid grid-cols-2 gap-2">
          <p className="col-span-2 font-semibold">{selection.name} · floor {selection.floor + 1}</p>
          <label>Width ({config.unit})<input name="width" className="input mt-1" type="number" min="2" step="0.1" defaultValue={selection.width} /></label>
          <label>Depth ({config.unit})<input name="depth" className="input mt-1" type="number" min="2" step="0.1" defaultValue={selection.depth} /></label>
          <button className="col-span-2 rounded-lg bg-[#FF7518] px-3 py-2 font-semibold text-white" type="submit">Update room</button>
        </form>
      )}
      {selection?.kind === 'wall' && <p className="mt-3 text-slate-600">Wall {selection.role}, length {selection.length} {config.unit}, thickness {selection.thickness} {config.unit}. Move it by editing the adjoining room.</p>}
      {!selection && <p className="mt-3 text-slate-500">Nothing selected.</p>}
    </div>
  );
}

function SceneReady({ onReady, targetY }) {
  const { scene, camera } = useThree();
  useEffect(() => {
    onReady(scene);
    camera.lookAt(0, targetY, 0);
  }, [camera, onReady, scene, targetY]);
  return null;
}

function InteriorStairs({ x, y, z }) {
  return <group position={[x, y, z]}>{Array.from({ length: 8 }, (_, index) => <mesh key={index} position={[0, index * 0.18, -0.75 + index * 0.2]}><boxGeometry args={[1.1, 0.12, 0.32]} /><meshStandardMaterial color="#64748b" /></mesh>)}</group>;
}

function ParkingArea({ width, depth }) {
  return <group position={[-width / 2 - 3.5, 0.12, 0]}><mesh><boxGeometry args={[5.5, 0.1, depth + 2]} /><meshStandardMaterial color="#475569" /></mesh>{[-1.4, 0, 1.4].map((z) => <mesh key={z} position={[0, 0.06, z]}><boxGeometry args={[0.08, 0.015, 1]} /><meshStandardMaterial color="#f8fafc" /></mesh>)}</group>;
}

function Trees({ width, depth }) {
  return <group>{[[-width / 2 - 3, -depth / 2 - 2], [width / 2 + 3, -depth / 2 - 2], [width / 2 + 3, depth / 2 + 2]].map(([x, z], index) => <group key={index} position={[x, 0, z]}><mesh position={[0, 1, 0]}><cylinderGeometry args={[0.22, 0.3, 2]} /><meshStandardMaterial color="#7c5437" /></mesh><mesh position={[0, 2.25, 0]}><sphereGeometry args={[1.1, 12, 10]} /><meshStandardMaterial color="#4f8b56" /></mesh></group>)}</group>;
}

function DesignProjectMenu({ project, onRename, onDuplicate, onDelete }) {
  const [open, setOpen] = useState(false);
  return <div className="relative"><button aria-label={`Project actions for ${project.title}`} onClick={() => setOpen((value) => !value)} className="rounded-lg p-1 text-slate-400 hover:bg-white"><MoreHorizontal className="h-4 w-4" /></button>{open && <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">{[[Pencil, 'Rename', onRename], [Copy, 'Duplicate', onDuplicate], [Trash2, 'Delete', onDelete]].map(([Icon, label, action]) => <button key={label} onClick={() => { action(project); setOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"><Icon className="h-3.5 w-3.5" />{label}</button>)}</div>}</div>;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeName(value) {
  return String(value || 'buildright-design').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'buildright-design';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
