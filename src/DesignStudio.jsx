import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Billboard, ContactShadows, Environment, Html, Line, OrbitControls, PointerLockControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
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
import { SearchableSelect } from './components/ui';

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
  const [sectionCut, setSectionCut] = useState(false);
  const [hideExterior, setHideExterior] = useState(false);
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);
  const [firstPerson, setFirstPerson] = useState(false);
  const [configDraft, setConfigDraft] = useState({ type: 'House', width: 18, depth: 14, floors: 2, unit: 'meters', style: 'Modern', location: 'Islamabad', budget: '', material: 'concrete' });
  const fileInput = useRef(null);

  const svg = useMemo(() => {
    if (!config) return '';
    if (sheet === 'elev-front') return buildElevationSvg(config, 'front');
    if (sheet === 'elev-rear') return buildElevationSvg(config, 'rear');
    if (sheet === 'elev-left') return buildElevationSvg(config, 'left');
    if (sheet === 'elev-right') return buildElevationSvg(config, 'right');
    if (sheet === 'section-long') return buildSectionSvg(config, 'longitudinal');
    if (sheet === 'section-cross') return buildSectionSvg(config, 'cross');
    if (sheet === 'elevation') return buildElevationSvg(config, 'front');
    if (sheet === 'section') return buildSectionSvg(config, 'longitudinal');
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
    setViewMode('Perspective');
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
    const configuration = {
      ...configDraft,
      projectType: configDraft.type,
      exteriorMaterial: configDraft.material || 'concrete',
    };
    try {
      validateDesign(configuration);
      if (!configuration.width || !configuration.depth) {
        setValidationError('Enter plot width and depth before generating. Missing essential dimensions are not invented.');
        return;
      }
      const brief = `${configuration.projectType}, ${configuration.floors} floors, ${configuration.width} by ${configuration.depth} ${configuration.unit}, ${configuration.style} style, ${configuration.location}, exterior ${configuration.exteriorMaterial}`;
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
          downloadBlob(blob, `${safeName(config.title)}-${sheet}-f${selectedFloor + 1}.png`);
        }, 'image/png');
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setValidationError('Could not render the drawing sheet for PNG export.');
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
      setValidationError('Allow pop-ups to print or save the drawing as PDF.');
      return;
    }
    printWindow.document.write(`<html><head><title>${escapeHtml(config.title)} — ${escapeHtml(sheet)}</title><style>@page{size:landscape;margin:12mm}body{margin:16px;font-family:Arial,sans-serif;background:#fff}svg{width:100%;height:auto}</style></head><body>${svg}<p style="font-size:11px;color:#64748b">Conceptual BuildRight drawing. Validate structure, foundations, and local code with qualified professionals before construction.</p><script>window.onload=()=>window.print()<\/script></body></html>`);
    printWindow.document.close();
  };

  const toggleLighting = () => {
    if (!config) return;
    commitConfig({ ...config, lighting: config.lighting === 'night' ? 'day' : 'night' });
  };

  const measureDistance = useMemo(() => {
    if (measurePoints.length < 2) return null;
    const [a, b] = measurePoints;
    return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }, [measurePoints]);

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
          <button
            type="button"
            aria-label="Close projects sidebar"
            className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-[1px] xl:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {sidebarOpen && (
          <aside className="fixed inset-y-0 left-0 z-40 w-[min(100%,18rem)] shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4 shadow-xl xl:relative xl:z-auto xl:h-[calc(100vh-76px)] xl:w-72 xl:shadow-none">
            <div className="mb-4 flex items-center justify-between xl:hidden">
              <p className="text-sm font-bold text-slate-900">Projects</p>
              <button type="button" aria-label="Close sidebar" className="rounded-lg border border-slate-200 p-2" onClick={() => setSidebarOpen(false)}><X className="h-4 w-4" /></button>
            </div>
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-3 py-3 backdrop-blur sm:px-6">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button onClick={() => setSidebarOpen((open) => !open)} aria-label="Toggle projects sidebar" className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-50"><FolderOpen className="h-4 w-4" /><ArrowLeft className={`hidden h-3 w-3 transition-transform sm:inline ${sidebarOpen ? 'rotate-180' : ''}`} /></button>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-orange">BuildRight Designer</p>
                <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">{config?.title || 'Architectural Design Studio'}</h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {config && <span className="hidden max-w-48 truncate rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-semibold text-amber-800 lg:inline">{generationSource}</span>}
              <button onClick={saveProject} disabled={!config} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"><Check className="h-4 w-4" /> <span className="hidden sm:inline">Save</span></button>
              <button onClick={startNew} className="rounded-xl bg-slate-900 p-2.5 text-white hover:bg-slate-700" aria-label="New design"><Plus className="h-4 w-4" /></button>
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
                  <label className="text-xs text-slate-500">Project type<SearchableSelect className="mt-1" value={configDraft.type} onChange={(next) => setConfigDraft({ ...configDraft, type: next })} options={PROJECT_TYPES} /></label>
                  <label className="text-xs text-slate-500">Width<input className="input mt-1" type="number" min="6" max="120" value={configDraft.width} onChange={(e) => setConfigDraft({ ...configDraft, width: Number(e.target.value) })} /></label>
                  <label className="text-xs text-slate-500">Depth<input className="input mt-1" type="number" min="6" max="120" value={configDraft.depth} onChange={(e) => setConfigDraft({ ...configDraft, depth: Number(e.target.value) })} /></label>
                  <label className="text-xs text-slate-500">Floors<input className="input mt-1" type="number" min="1" max="20" value={configDraft.floors} onChange={(e) => setConfigDraft({ ...configDraft, floors: Number(e.target.value) })} /></label>
                  <label className="text-xs text-slate-500">Units<SearchableSelect className="mt-1" value={configDraft.unit} onChange={(next) => setConfigDraft({ ...configDraft, unit: next })} options={['meters', 'feet', 'marla', 'kanal']} /></label>
                  <label className="text-xs text-slate-500">Style<SearchableSelect className="mt-1" value={configDraft.style} onChange={(next) => setConfigDraft({ ...configDraft, style: next })} options={['Modern', 'Contemporary', 'Traditional', 'Minimalist']} /></label>
                  <label className="text-xs text-slate-500">Location<SearchableSelect className="mt-1" value={configDraft.location} onChange={(next) => setConfigDraft({ ...configDraft, location: next })} options={LOCATIONS} /></label>
                  <label className="text-xs text-slate-500">Exterior material<SearchableSelect className="mt-1" value={configDraft.material} onChange={(next) => setConfigDraft({ ...configDraft, material: next })} options={[{ value: 'concrete', label: 'Concrete' }, { value: 'brick', label: 'Brick' }, { value: 'stone', label: 'Stone' }, { value: 'wood', label: 'Wood' }, { value: 'plaster', label: 'Plaster' }, { value: 'stone-glass', label: 'Stone and glass' }, { value: 'metal', label: 'Metal' }]} /></label>
                  <label className="text-xs text-slate-500">Budget (optional)<input className="input mt-1" value={configDraft.budget} onChange={(e) => setConfigDraft({ ...configDraft, budget: e.target.value })} placeholder="PKR" /></label>
                  <button onClick={createFromConfiguration} className="col-span-2 rounded-xl bg-brand-orange px-4 py-2 text-xs font-bold text-white md:col-span-4">Generate from configuration</button>
                </div>
              </div>
              <ChatComposer prompt={prompt} setPrompt={setPrompt} onSend={() => generate(prompt, { newDesign: true })} isGenerating={isGenerating} attachment={attachment} setAttachment={setAttachment} fileInput={fileInput} />
              {isGenerating && <div role="status" className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-brand-orange"><LoaderCircle className="h-4 w-4 animate-spin" />{generationStatus}</div>}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-slate-200 bg-white px-3 py-3 sm:px-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="inline-flex w-full rounded-2xl bg-slate-100 p-1 sm:w-auto">
                    <button onClick={() => setTab('plan')} className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-bold transition sm:flex-none ${tab === 'plan' ? 'bg-[#101828] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>2D Floor Plan</button>
                    <button onClick={() => setTab('model')} className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-bold transition sm:flex-none ${tab === 'model' ? 'bg-[#101828] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>3D Model</button>
                  </div>
                  <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:thin] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                    <SearchableSelect
                      aria-label="Floor selector"
                      className="shrink-0 w-32"
                      triggerClassName="!rounded-xl !border-slate-200 !bg-white !px-3 !py-2 !text-xs !font-semibold !text-slate-700"
                      value={String(selectedFloor)}
                      onChange={(next) => setSelectedFloor(Number(next))}
                      options={Array.from({ length: config.floors }, (_, index) => ({ value: String(index), label: `Floor ${index + 1}` }))}
                    />
                    {tab === 'model' && <>
                      <SearchableSelect
                        aria-label="Camera view"
                        className="shrink-0 w-36"
                        triggerClassName="!rounded-xl !border-slate-200 !bg-white !px-3 !py-2 !text-xs !font-semibold !text-slate-700"
                        value={viewMode}
                        onChange={(next) => { setViewMode(next); setFirstPerson(false); }}
                        options={['Perspective', 'Front', 'Rear', 'Left', 'Right', 'Top', 'Interior']}
                      />
                      <button type="button" onClick={toggleLighting} className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">{config.lighting === 'night' ? 'Day light' : 'Night light'}</button>
                      <button type="button" onClick={() => setSectionCut((value) => !value)} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold ${sectionCut ? 'border-orange-300 bg-orange-50 text-orange-800' : 'border-slate-200'}`}>Section</button>
                      <button type="button" onClick={() => setHideExterior((value) => !value)} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold ${hideExterior ? 'border-orange-300 bg-orange-50 text-orange-800' : 'border-slate-200'}`}>Hide walls</button>
                      <button type="button" onClick={() => { setMeasureMode((value) => !value); setMeasurePoints([]); }} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold ${measureMode ? 'border-orange-300 bg-orange-50 text-orange-800' : 'border-slate-200'}`}>Measure</button>
                      <button type="button" onClick={() => { setFirstPerson((value) => !value); setViewMode('Interior'); }} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold ${firstPerson ? 'border-orange-300 bg-orange-50 text-orange-800' : 'border-slate-200'}`}>Walk</button>
                      <button type="button" onClick={undoEdit} disabled={!history.length} className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40">Undo</button>
                      <button type="button" onClick={redoEdit} disabled={!future.length} className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40">Redo</button>
                      <button type="button" onClick={exportIfc} title="Downloads an IFC2x3 wall index. It is not a certified Revit solid model." className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">IFC</button>
                    </>}
                    {tab === 'plan' ? <>
                      <SearchableSelect
                        aria-label="Drawing sheet"
                        className="shrink-0 w-44"
                        triggerClassName="!rounded-xl !border-slate-200 !bg-white !px-3 !py-2 !text-xs !font-semibold"
                        value={sheet}
                        onChange={setSheet}
                        options={[
                          { value: 'floor', label: 'Floor plan' },
                          { value: 'elev-front', label: 'Front elevation' },
                          { value: 'elev-rear', label: 'Rear elevation' },
                          { value: 'elev-left', label: 'Left elevation' },
                          { value: 'elev-right', label: 'Right elevation' },
                          { value: 'section-long', label: 'Longitudinal section' },
                          { value: 'section-cross', label: 'Cross section' },
                        ]}
                      />
                      <button onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))} className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs">−</button>
                      <span className="shrink-0 self-center text-xs text-slate-500">{Math.round(zoom * 100)}%</span>
                      <button onClick={() => setZoom((value) => Math.min(1.5, value + 0.1))} className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs">+</button>
                      <button onClick={exportSvg} className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">SVG</button>
                      <button onClick={exportDxf} className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">DXF</button>
                      <button onClick={exportPlanPng} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold"><FileImage className="h-3.5 w-3.5" /> PNG</button>
                      <button onClick={exportPlanPdf} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold"><Download className="h-3.5 w-3.5" /> PDF</button>
                    </> : <>
                      <button onClick={exportGlb} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold"><Box className="h-3.5 w-3.5" /> GLB</button>
                      <button onClick={exportStill} className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">Still</button>
                      <button onClick={() => setZoom((value) => Math.min(1.8, value + 0.1))} className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs">Zoom +</button>
                      <button onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))} className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs">Zoom −</button>
                      <button onClick={() => setZoom(1)} className="shrink-0 rounded-xl border border-slate-200 p-2 text-slate-600" aria-label="Reset camera"><RotateCcw className="h-3.5 w-3.5" /></button>
                    </>}
                    <button onClick={() => generate('Regenerate the current design from the existing project requirements.')} disabled={isGenerating} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" /> Regen</button>
                  </div>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
                <section className="relative order-1 min-h-[360px] bg-gradient-to-b from-slate-100 to-slate-200/60 p-3 sm:min-h-[420px] sm:p-6">
                  {tab === 'plan' ? (
                    <div className="flex h-full min-h-[320px] items-center justify-center overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:min-h-[390px] sm:p-4">
                      <div data-design-plan style={{ transform: `scale(${zoom})`, transformOrigin: 'center top' }} className="w-full max-w-5xl transition-transform [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
                    </div>
                  ) : (
                    <div className="group relative h-[min(62vh,720px)] min-h-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-sky-100 to-slate-200 shadow-sm sm:min-h-[480px]" data-model-export>
                      <Canvas
                        key={`${config.lighting || 'day'}-${config.exteriorMaterial || 'concrete'}-${sectionCut}-${hideExterior}`}
                        camera={{ position: [Math.max(config.width, config.depth) * 1.8, Math.max(config.width, config.depth) * 1.2, Math.max(config.width, config.depth) * 1.8], fov: firstPerson ? 70 : 42 }}
                        shadows
                        frameloop="always"
                        gl={{ antialias: true, preserveDrawingBuffer: true, localClippingEnabled: true }}
                        onPointerMissed={() => { if (!measureMode) setSelection(null); }}
                      >
                        <SceneReady onReady={setSceneForExport} targetY={viewMode === 'Interior' || viewMode === 'Top' ? selectedFloor * (config.unit === 'feet' ? 11 : 3.2) + 1.4 : config.floors * 1.4} />
                        {!firstPerson && <CameraRig view={viewMode} span={Math.max(config.width, config.depth) / zoom} targetY={viewMode === 'Interior' ? selectedFloor * (config.unit === 'feet' ? 11 : 3.2) + 1.5 : config.floors * 1.2} />}
                        <color attach="background" args={[config.lighting === 'night' ? '#0f172a' : '#bfd4ea']} />
                        {config.lighting !== 'night' && <Sky sunPosition={[80, 40, 20]} turbidity={4} rayleigh={0.6} />}
                        <Environment preset={config.lighting === 'night' ? 'night' : 'city'} environmentIntensity={config.lighting === 'night' ? 0.15 : 0.55} />
                        <ambientLight intensity={config.lighting === 'night' ? 0.12 : 0.35} />
                        <directionalLight position={[22, 34, 14]} intensity={config.lighting === 'night' ? 0.2 : 2.8} castShadow shadow-mapSize={[2048, 2048]} color={config.lighting === 'night' ? '#93c5fd' : '#fff7ed'} />
                        <hemisphereLight intensity={config.lighting === 'night' ? 0.18 : 0.5} color={config.lighting === 'night' ? '#1e3a8a' : '#f8fafc'} groundColor="#78716c" />
                        <BuildingGeometry
                          config={config}
                          floor={selectedFloor}
                          viewMode={viewMode}
                          selection={selection}
                          onSelect={setSelection}
                          sectionCut={sectionCut}
                          hideExterior={hideExterior}
                          measureMode={measureMode}
                          measurePoints={measurePoints}
                          onMeasure={(point) => setMeasurePoints((current) => (current.length >= 2 ? [point] : [...current, point]))}
                        />
                        <ContactShadows position={[0, 0.01, 0]} opacity={0.42} blur={2.8} far={55} />
                        {firstPerson
                          ? <PointerLockControls />
                          : <OrbitControls makeDefault target={[0, viewMode === 'Interior' ? selectedFloor * (config.unit === 'feet' ? 11 : 3.2) + 1.5 : config.floors * 1.2, 0]} enablePan enableZoom enableRotate />}
                      </Canvas>
                      <button onClick={(event) => event.currentTarget.parentElement.requestFullscreen?.()} className="absolute right-3 top-3 rounded-lg border border-white/60 bg-white/80 p-2 text-slate-700 shadow-sm backdrop-blur"><Fullscreen className="h-4 w-4" /></button>
                      <div className="absolute bottom-3 left-3 max-w-xl rounded-lg bg-white/90 px-3 py-2 text-xs text-slate-600 backdrop-blur">
                        {viewMode} · Floor {selectedFloor + 1}/{config.floors}
                        {sectionCut ? ' · Section cut on' : ''}
                        {hideExterior ? ' · Exterior walls hidden' : ''}
                        {firstPerson ? ' · Click canvas, then WASD / mouse look' : ''}
                        {measureMode ? (measureDistance != null ? ` · Measure ${measureDistance.toFixed(2)} ${config.unit}` : ' · Click two points on the model') : ''}
                        {' · '}Room names + lengths on the active floor · outside windows on every facade
                      </div>
                    </div>
                  )}
                  <p className="mt-3 text-center text-[11px] text-slate-500">Conceptual geometry for planning only; validate drawings, dimensions, structure, and code with qualified local professionals.</p>
                </section>

                <aside className="order-2 flex min-h-[420px] flex-col border-t border-slate-200 bg-white xl:min-h-0 xl:border-l xl:border-t-0">
                  <div className="border-b border-slate-100 p-4">
                    <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-slate-900">Design specifications</h2><button onClick={() => setTab('plan')} className="text-xs font-semibold text-brand-orange"><Pencil className="mr-1 inline h-3.5 w-3.5" /> Edit</button></div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <label className="text-slate-500">Type<SearchableSelect className="mt-1" triggerClassName="!rounded-lg !px-2 !py-2" value={config.projectType} onChange={(next) => adjustConfig('projectType', next)} options={PROJECT_TYPES} /></label>
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
  concrete: { color: '#d0cbc4', roughness: 0.78, metalness: 0.05, envMapIntensity: 0.6 },
  brick: { color: '#a34a2e', roughness: 0.88, metalness: 0.03, envMapIntensity: 0.4 },
  stone: { color: '#b7b1a8', roughness: 0.7, metalness: 0.08, envMapIntensity: 0.7 },
  wood: { color: '#a16207', roughness: 0.55, metalness: 0.05, envMapIntensity: 0.45 },
  plaster: { color: '#f3f0ea', roughness: 0.9, metalness: 0.02, envMapIntensity: 0.45 },
  'stone-glass': { color: '#e8e4de', roughness: 0.38, metalness: 0.2, envMapIntensity: 1.15 },
  metal: { color: '#8ea0b5', roughness: 0.26, metalness: 0.88, envMapIntensity: 1.45 },
};

function formatLength(value, unit) {
  const number = Number(value) || 0;
  const digits = unit === 'feet' ? 1 : 2;
  return `${number.toFixed(digits)} ${unit === 'feet' ? 'ft' : 'm'}`;
}

/** Outside facade windows on every floor — not only rooms tagged with window:true. */
function FacadeWindows({ width, depth, floors, floorHeight, hideExterior, night, matProps }) {
  if (hideExterior) return null;
  const faces = [
    { axis: 'z', sign: 1, span: width, wallPos: depth / 2 + 0.06 },
    { axis: 'z', sign: -1, span: width, wallPos: -depth / 2 - 0.06 },
    { axis: 'x', sign: -1, span: depth, wallPos: -width / 2 - 0.06 },
    { axis: 'x', sign: 1, span: depth, wallPos: width / 2 + 0.06 },
  ];
  const winW = Math.min(1.45, Math.max(0.9, width * 0.08));
  const winH = floorHeight * 0.42;
  const gap = winW * 0.55;
  const items = [];
  for (let floorIndex = 0; floorIndex < floors; floorIndex += 1) {
    const sillY = floorIndex * floorHeight + floorHeight * 0.42;
    for (const face of faces) {
      const count = Math.max(2, Math.floor((face.span - 1.4) / (winW + gap)));
      const total = count * winW + (count - 1) * gap;
      const start = -total / 2 + winW / 2;
      for (let i = 0; i < count; i += 1) {
        // Leave a door bay on the front ground floor center
        if (face.axis === 'z' && face.sign === 1 && floorIndex === 0 && Math.abs(start + i * (winW + gap)) < winW * 0.8) continue;
        const along = start + i * (winW + gap);
        const position = face.axis === 'z'
          ? [along, sillY, face.wallPos]
          : [face.wallPos, sillY, along];
        const rotation = face.axis === 'x' ? [0, Math.PI / 2, 0] : [0, 0, 0];
        items.push({ key: `${floorIndex}-${face.axis}-${face.sign}-${i}`, position, rotation });
      }
    }
  }
  return (
    <group>
      {items.map((item) => (
        <group key={item.key} position={item.position} rotation={item.rotation}>
          <mesh castShadow>
            <boxGeometry args={[winW + 0.12, winH + 0.12, 0.08]} />
            <meshStandardMaterial {...matProps({ color: '#3f3f46', metalness: 0.55, roughness: 0.35, envMapIntensity: 0.8 })} />
          </mesh>
          <mesh position={[0, 0, 0.04]} castShadow>
            <boxGeometry args={[winW, winH, 0.05]} />
            <meshPhysicalMaterial {...matProps({
              color: night ? '#93c5fd' : '#b9dcff',
              roughness: 0.05,
              metalness: 0.15,
              transmission: night ? 0.35 : 0.82,
              thickness: 0.25,
              transparent: true,
              opacity: night ? 0.85 : 0.55,
              envMapIntensity: 1.6,
              emissive: night ? '#fbbf24' : '#000000',
              emissiveIntensity: night ? 0.25 : 0,
            })} />
          </mesh>
          <mesh position={[0, 0, 0.045]}>
            <boxGeometry args={[0.04, winH, 0.02]} />
            <meshStandardMaterial {...matProps({ color: '#52525b', metalness: 0.5, roughness: 0.4 })} />
          </mesh>
          <mesh position={[0, -winH / 2 - 0.06, 0.02]}>
            <boxGeometry args={[winW + 0.18, 0.06, 0.12]} />
            <meshStandardMaterial {...matProps({ color: '#a8a29e', roughness: 0.7 })} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function RoomLabels({ rooms, width, depth, floorIndex, floorHeight, unit, visible }) {
  if (!visible) return null;
  return (
    <group>
      {rooms.map((room) => {
        const x = room.x + room.width / 2 - width / 2;
        const z = room.y + room.depth / 2 - depth / 2;
        const y = floorIndex * floorHeight + 0.55;
        return (
          <Billboard key={`label-${floorIndex}-${room.id || room.name}`} position={[x, y, z]} follow lockX={false} lockZ={false}>
            <Html center distanceFactor={14} style={{ pointerEvents: 'none', userSelect: 'none' }}>
              <div className="rounded-lg border border-slate-200/90 bg-white/95 px-2 py-1 text-center shadow-md backdrop-blur-sm">
                <div className="whitespace-nowrap text-[11px] font-bold text-slate-900">{room.name}</div>
                <div className="whitespace-nowrap text-[10px] font-semibold text-[#FF7518]">
                  {formatLength(room.width, unit)} × {formatLength(room.depth, unit)}
                </div>
              </div>
            </Html>
          </Billboard>
        );
      })}
    </group>
  );
}

function BuildingDimensions({ width, depth, floors, floorHeight, unit }) {
  const y = 0.35;
  const lift = floors * floorHeight + 1.1;
  return (
    <group>
      {/* Width dimension along front */}
      <Line points={[[-width / 2, y, depth / 2 + 1.4], [width / 2, y, depth / 2 + 1.4]]} color="#FF7518" lineWidth={2} />
      <Line points={[[-width / 2, 0.05, depth / 2 + 1.1], [-width / 2, y, depth / 2 + 1.4]]} color="#FF7518" lineWidth={1} />
      <Line points={[[width / 2, 0.05, depth / 2 + 1.1], [width / 2, y, depth / 2 + 1.4]]} color="#FF7518" lineWidth={1} />
      <Billboard position={[0, y + 0.25, depth / 2 + 1.4]}>
        <Html center distanceFactor={16} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-md bg-[#101828] px-2 py-0.5 text-[10px] font-bold text-white shadow">
            Width {formatLength(width, unit)}
          </div>
        </Html>
      </Billboard>
      {/* Depth dimension along side */}
      <Line points={[[width / 2 + 1.4, y, -depth / 2], [width / 2 + 1.4, y, depth / 2]]} color="#FF7518" lineWidth={2} />
      <Line points={[[width / 2 + 1.1, 0.05, -depth / 2], [width / 2 + 1.4, y, -depth / 2]]} color="#FF7518" lineWidth={1} />
      <Line points={[[width / 2 + 1.1, 0.05, depth / 2], [width / 2 + 1.4, y, depth / 2]]} color="#FF7518" lineWidth={1} />
      <Billboard position={[width / 2 + 1.4, y + 0.25, 0]}>
        <Html center distanceFactor={16} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-md bg-[#101828] px-2 py-0.5 text-[10px] font-bold text-white shadow">
            Depth {formatLength(depth, unit)}
          </div>
        </Html>
      </Billboard>
      {/* Height */}
      <Line points={[[-width / 2 - 1.2, 0, -depth / 2], [-width / 2 - 1.2, floors * floorHeight, -depth / 2]]} color="#0ea5e9" lineWidth={2} />
      <Billboard position={[-width / 2 - 1.2, lift / 2, -depth / 2]}>
        <Html center distanceFactor={16} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-md bg-sky-700 px-2 py-0.5 text-[10px] font-bold text-white shadow">
            Height {formatLength(floors * floorHeight, unit)} · {floors} floor{floors === 1 ? '' : 's'}
          </div>
        </Html>
      </Billboard>
    </group>
  );
}

function MainEntrance({ width, depth, floorHeight, matProps }) {
  const doorW = Math.min(2.4, width * 0.18);
  const doorH = floorHeight * 0.78;
  return (
    <group position={[0, doorH / 2, depth / 2 + 0.08]}>
      <mesh castShadow>
        <boxGeometry args={[doorW + 0.35, doorH + 0.25, 0.12]} />
        <meshStandardMaterial {...matProps({ color: '#292524', metalness: 0.4, roughness: 0.45 })} />
      </mesh>
      <mesh position={[-doorW * 0.26, 0, 0.05]} castShadow>
        <boxGeometry args={[doorW * 0.45, doorH * 0.92, 0.06]} />
        <meshPhysicalMaterial {...matProps({ color: '#93c5fd', roughness: 0.08, transmission: 0.7, transparent: true, opacity: 0.55, thickness: 0.2 })} />
      </mesh>
      <mesh position={[doorW * 0.26, 0, 0.05]} castShadow>
        <boxGeometry args={[doorW * 0.45, doorH * 0.92, 0.06]} />
        <meshPhysicalMaterial {...matProps({ color: '#93c5fd', roughness: 0.08, transmission: 0.7, transparent: true, opacity: 0.55, thickness: 0.2 })} />
      </mesh>
      <mesh position={[0, doorH / 2 + 0.28, 0.55]} castShadow>
        <boxGeometry args={[doorW + 1.4, 0.12, 1.2]} />
        <meshStandardMaterial {...matProps({ color: '#57534e', metalness: 0.35, roughness: 0.4 })} />
      </mesh>
      <Billboard position={[0, doorH / 2 + 0.55, 0.8]}>
        <Html center distanceFactor={18} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-800 shadow">Main entrance</div>
        </Html>
      </Billboard>
    </group>
  );
}

function BuildingGeometry({
  config,
  floor,
  viewMode,
  selection,
  onSelect,
  sectionCut = false,
  hideExterior = false,
  measureMode = false,
  measurePoints = [],
  onMeasure,
}) {
  const width = Math.max(6, Number(config.width) || 18);
  const depth = Math.max(6, Number(config.depth) || 14);
  const drawing = buildDrawing(config, floor);
  const floorHeight = drawing.floorHeight;
  const stairX = config.stairsPosition === 'left' ? -width * 0.31 : config.stairsPosition === 'rear' ? 0 : width * 0.31;
  const exterior = SURFACE_MATERIALS[config.exteriorMaterial] || SURFACE_MATERIALS.concrete;
  const clipPlanes = useMemo(() => (
    sectionCut ? [new THREE.Plane(new THREE.Vector3(0, 0, -1), depth * 0.08)] : []
  ), [sectionCut, depth]);

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
    </group>;
  }

  const floorsToDraw = viewMode === 'Interior' ? [floor] : Array.from({ length: config.floors }, (_, index) => index);
  const choose = (payload) => (event) => {
    event.stopPropagation();
    if (measureMode) {
      onMeasure?.([event.point.x, event.point.y, event.point.z]);
      return;
    }
    onSelect?.(payload);
  };
  const matProps = (extra = {}) => ({
    ...extra,
    clippingPlanes: clipPlanes,
    clipShadows: true,
  });

  const unit = config.unit === 'feet' ? 'feet' : 'meters';
  const showLabels = viewMode !== 'Interior';
  const labelFloor = viewMode === 'Interior' ? floor : floor;

  return (
    <group position={[0, 0, 0]}>
      <SiteContext width={width} depth={depth} floors={config.floors} floorHeight={floorHeight} night={config.lighting === 'night'} garden={config.garden !== false} parking={config.parking !== false} />
      {floorsToDraw.map((floorIndex) => {
        const level = buildDrawing(config, floorIndex);
        return (
          <group key={floorIndex}>
            <mesh position={[0, floorIndex * floorHeight + 0.08, 0]} receiveShadow onClick={choose({ kind: 'slab', floor: floorIndex })}>
              <boxGeometry args={[width, 0.18, depth]} />
              <meshStandardMaterial {...matProps({ color: '#d8d3cb', roughness: 0.78, metalness: 0.05, envMapIntensity: 0.4 })} />
            </mesh>
            {/* Floor slab edge band for a finished facade look */}
            <mesh position={[0, floorIndex * floorHeight + 0.02, 0]} receiveShadow>
              <boxGeometry args={[width + 0.12, 0.12, depth + 0.12]} />
              <meshStandardMaterial {...matProps({ color: exterior.color, roughness: exterior.roughness, metalness: exterior.metalness, envMapIntensity: exterior.envMapIntensity })} />
            </mesh>
            {level.rooms.map((room) => {
              const active = selection?.kind === 'room' && selection.name === room.name && selection.floor === floorIndex;
              return (
                <mesh
                  key={room.id || room.name}
                  position={[room.x + room.width / 2 - width / 2, floorIndex * floorHeight + 0.2, room.y + room.depth / 2 - depth / 2]}
                  onClick={choose({ kind: 'room', name: room.name, floor: floorIndex, width: room.width, depth: room.depth })}
                >
                  <boxGeometry args={[Math.max(room.width * 0.92, 0.4), 0.05, Math.max(room.depth * 0.92, 0.4)]} />
                  <meshStandardMaterial {...matProps({ color: active ? '#fdba74' : '#efeae3', roughness: 0.88 })} />
                </mesh>
              );
            })}
            {level.walls
              .filter((wall) => !(hideExterior && wall.kind === 'external'))
              .filter((wall) => viewMode !== 'Interior' || wall.kind === 'internal' || wall.y1 > 0.2)
              .map((wall, index) => {
                const length = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
                const angle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1);
                const wallId = `${floorIndex}-${index}`;
                const active = selection?.kind === 'wall' && selection.id === wallId;
                const isExternal = wall.kind === 'external';
                return (
                  <mesh
                    key={wallId}
                    position={[(wall.x1 + wall.x2) / 2 - width / 2, floorIndex * floorHeight + floorHeight / 2, (wall.y1 + wall.y2) / 2 - depth / 2]}
                    rotation={[0, -angle, 0]}
                    castShadow
                    receiveShadow
                    onClick={choose({ kind: 'wall', id: wallId, floor: floorIndex, length: Number(length.toFixed(2)), thickness: wall.thickness, role: wall.kind })}
                  >
                    <boxGeometry args={[length, floorHeight * 0.98, isExternal ? wall.thickness * 1.15 : wall.thickness]} />
                    <meshStandardMaterial {...matProps({
                      color: active ? '#fb923c' : isExternal ? exterior.color : '#f8fafc',
                      roughness: isExternal ? exterior.roughness : 0.9,
                      metalness: isExternal ? exterior.metalness : 0,
                      envMapIntensity: isExternal ? exterior.envMapIntensity : 0.25,
                    })} />
                  </mesh>
                );
              })}
            <RoomLabels
              rooms={level.rooms}
              width={width}
              depth={depth}
              floorIndex={floorIndex}
              floorHeight={floorHeight}
              unit={unit}
              visible={showLabels && floorIndex === labelFloor}
            />
          </group>
        );
      })}

      <FacadeWindows
        width={width}
        depth={depth}
        floors={config.floors}
        floorHeight={floorHeight}
        hideExterior={hideExterior}
        night={config.lighting === 'night'}
        matProps={matProps}
      />
      <MainEntrance width={width} depth={depth} floorHeight={floorHeight} matProps={matProps} />
      {showLabels && (
        <BuildingDimensions width={width} depth={depth} floors={config.floors} floorHeight={floorHeight} unit={unit} />
      )}

      {/* Roof + parapet */}
      <mesh position={[0, config.floors * floorHeight + 0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.35, 0.22, depth + 0.35]} />
        <meshStandardMaterial {...matProps({ color: '#3f3f46', roughness: 0.5, metalness: 0.28, envMapIntensity: 0.75 })} />
      </mesh>
      <mesh position={[0, config.floors * floorHeight + 0.42, 0]}>
        <boxGeometry args={[width + 0.55, 0.35, depth + 0.55]} />
        <meshStandardMaterial {...matProps({ color: exterior.color, roughness: exterior.roughness, metalness: exterior.metalness, transparent: true, opacity: 0.35, envMapIntensity: exterior.envMapIntensity })} />
      </mesh>
      {/* Parapet walls */}
      {[[0, depth / 2 + 0.18], [0, -depth / 2 - 0.18]].map(([x, z], index) => (
        <mesh key={`para-z-${index}`} position={[x, config.floors * floorHeight + 0.55, z]} castShadow>
          <boxGeometry args={[width + 0.55, 0.55, 0.12]} />
          <meshStandardMaterial {...matProps({ color: exterior.color, roughness: exterior.roughness, metalness: exterior.metalness })} />
        </mesh>
      ))}
      {[[width / 2 + 0.18, 0], [-width / 2 - 0.18, 0]].map(([x, z], index) => (
        <mesh key={`para-x-${index}`} position={[x, config.floors * floorHeight + 0.55, z]} castShadow>
          <boxGeometry args={[0.12, 0.55, depth + 0.55]} />
          <meshStandardMaterial {...matProps({ color: exterior.color, roughness: exterior.roughness, metalness: exterior.metalness })} />
        </mesh>
      ))}

      {config.balconies && Array.from({ length: Math.max(config.floors - 1, 0) }, (_, index) => (
        <group key={`balcony-${index}`} position={[0, (index + 1) * floorHeight + 0.16, depth / 2 + 1.15]}>
          <mesh castShadow receiveShadow><boxGeometry args={[width * 0.48, 0.12, 2.3]} /><meshStandardMaterial {...matProps({ color: '#d6d3d1', roughness: 0.7, metalness: 0.08 })} /></mesh>
          <mesh position={[0, 0.55, 1.05]}><boxGeometry args={[width * 0.48, 0.08, 0.08]} /><meshStandardMaterial {...matProps({ color: '#94a3b8', metalness: 0.7, roughness: 0.3 })} /></mesh>
          <mesh position={[-width * 0.22, 0.45, 0]}><boxGeometry args={[0.06, 0.9, 2.1]} /><meshStandardMaterial {...matProps({ color: '#94a3b8', metalness: 0.65, roughness: 0.3 })} /></mesh>
          <mesh position={[width * 0.22, 0.45, 0]}><boxGeometry args={[0.06, 0.9, 2.1]} /><meshStandardMaterial {...matProps({ color: '#94a3b8', metalness: 0.65, roughness: 0.3 })} /></mesh>
        </group>
      ))}
      {config.roofUtility !== false && (
        <mesh position={[width * 0.22, config.floors * floorHeight + 0.95, -depth * 0.15]} castShadow>
          <boxGeometry args={[width * 0.22, 1.2, depth * 0.18]} />
          <meshStandardMaterial {...matProps({ color: '#71717a', roughness: 0.42, metalness: 0.4 })} />
        </mesh>
      )}
      {config.lighting === 'night' && (
        <>
          <pointLight position={[0, floor * floorHeight + 2.2, 0]} intensity={10} distance={Math.max(width, depth) * 1.4} color="#fdba74" />
          <pointLight position={[width / 2 + 2, 3.2, depth / 2 + 2]} intensity={6} distance={18} color="#fde68a" />
        </>
      )}
      <InteriorStairs x={stairX} y={floor * floorHeight} z={config.stairsPosition === 'rear' ? -depth * 0.25 : 0} />
      {measurePoints.map((point, index) => (
        <mesh key={`measure-${index}`} position={point}><sphereGeometry args={[0.18, 12, 12]} /><meshStandardMaterial color="#FF7518" emissive="#9a3412" /></mesh>
      ))}
      {measurePoints.length === 2 && <Line points={measurePoints} color="#FF7518" lineWidth={2} />}
      {measurePoints.length === 2 && (
        <Billboard position={[
          (measurePoints[0][0] + measurePoints[1][0]) / 2,
          (measurePoints[0][1] + measurePoints[1][1]) / 2 + 0.4,
          (measurePoints[0][2] + measurePoints[1][2]) / 2,
        ]}
        >
          <Html center distanceFactor={14} style={{ pointerEvents: 'none' }}>
            <div className="rounded bg-[#FF7518] px-2 py-0.5 text-[10px] font-bold text-white shadow">
              {formatLength(Math.hypot(
                measurePoints[1][0] - measurePoints[0][0],
                measurePoints[1][1] - measurePoints[0][1],
                measurePoints[1][2] - measurePoints[0][2],
              ), unit)}
            </div>
          </Html>
        </Billboard>
      )}
    </group>
  );
}

function SiteContext({ width, depth, floors, floorHeight, night, garden, parking }) {
  const pad = Math.max(width, depth) * 0.55;
  return (
    <group>
      <mesh position={[0, -0.12, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[width + pad * 2.4, depth + pad * 2.4]} /><meshStandardMaterial color="#7c8b5a" roughness={0.95} /></mesh>
      <mesh position={[0, -0.05, depth / 2 + pad * 0.55]} receiveShadow><boxGeometry args={[width + pad * 1.6, 0.1, 5.5]} /><meshStandardMaterial color="#57534e" roughness={0.9} /></mesh>
      {[-1.6, 0, 1.6].map((offset) => <mesh key={offset} position={[offset, 0.01, depth / 2 + pad * 0.55]}><boxGeometry args={[0.12, 0.02, 4.2]} /><meshStandardMaterial color="#f8fafc" /></mesh>)}
      <mesh position={[0, -0.04, -depth / 2 - 2.2]} receiveShadow><boxGeometry args={[width + 4, 0.08, 2.4]} /><meshStandardMaterial color="#a8a29e" roughness={0.92} /></mesh>
      {[[-width / 2 - 0.2, 0], [width / 2 + 0.2, 0], [0, -depth / 2 - 0.2], [0, depth / 2 + 0.2]].map(([x, z], index) => (
        <mesh key={`boundary-${index}`} position={[x === 0 ? 0 : x + Math.sign(x) * 1.4, 0.85, z === 0 ? 0 : z + Math.sign(z) * 1.2]}>
          <boxGeometry args={[x === 0 ? width + 4.5 : 0.25, 1.7, z === 0 ? depth + 4.5 : 0.25]} />
          <meshStandardMaterial color="#d6d3d1" roughness={0.88} />
        </mesh>
      ))}
      <mesh position={[0, 1.05, depth / 2 + 2.1]}><boxGeometry args={[3.2, 2.1, 0.18]} /><meshStandardMaterial color="#78716c" metalness={0.35} roughness={0.4} /></mesh>
      {garden && <mesh position={[-width / 2 - 3.2, 0.02, 0]} receiveShadow><boxGeometry args={[3.4, 0.1, depth + 2]} /><meshStandardMaterial color="#4d7c0f" roughness={0.92} /></mesh>}
      {parking && <ParkingArea width={width} depth={depth} />}
      <Trees width={width} depth={depth} />
      {night && Array.from({ length: 4 }, (_, index) => {
        const angle = (index / 4) * Math.PI * 2;
        const x = Math.cos(angle) * (width / 2 + 4);
        const z = Math.sin(angle) * (depth / 2 + 4);
        return <group key={`lamp-${index}`} position={[x, 0, z]}>
          <mesh position={[0, 1.4, 0]}><cylinderGeometry args={[0.08, 0.1, 2.8]} /><meshStandardMaterial color="#44403c" metalness={0.5} /></mesh>
          <pointLight position={[0, 2.9, 0]} intensity={5} distance={12} color="#fde68a" />
        </group>;
      })}
      <mesh position={[0, -0.55, 0]}><boxGeometry args={[width + 1.2, 0.9, depth + 1.2]} /><meshStandardMaterial color="#78716c" roughness={0.95} /></mesh>
      <mesh visible={false} position={[0, floors * floorHeight * 0.5, 0]} />
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
  const materials = ['concrete', 'brick', 'stone', 'wood', 'plaster', 'stone-glass', 'metal'];
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
