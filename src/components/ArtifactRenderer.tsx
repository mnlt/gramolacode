import { useMemo } from 'react'

interface ArtifactRendererProps {
  code: string
}

export default function ArtifactRenderer({ code }: ArtifactRendererProps) {

  const iframeContent = useMemo(() => {
    try {
      const trimmedCode = code.trim()
      
      if (!trimmedCode) {
        return generateErrorHTML('No code provided')
      }

      const codeType = detectCodeType(trimmedCode)
      
      switch (codeType) {
        case 'html':
          return generatePlainHTML(trimmedCode)
        case 'react':
          return generateReactHTML(trimmedCode)
        case 'jsx-fragment':
          return generateReactHTML(wrapJSXFragment(trimmedCode))
        case 'svg':
          return generateSVGHTML(trimmedCode)
        case 'markdown':
          return generateMarkdownHTML(trimmedCode)
        default:
          // Intentar como React primero, luego como HTML
          return generateReactHTML(trimmedCode)
      }
    } catch (err) {
      return generateErrorHTML(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [code])

  return (
    <iframe
      srcDoc={iframeContent}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        borderRadius: '8px',
        backgroundColor: '#fff',
      }}
      sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
      title="Artifact Preview"
    />
  )
}

// ============================================================================
// DETECCIÓN DE TIPO DE CÓDIGO
// ============================================================================

type CodeType = 'html' | 'react' | 'jsx-fragment' | 'svg' | 'markdown' | 'unknown'

function detectCodeType(code: string): CodeType {
  const trimmed = code.trim()
  
  // SVG puro
  if (/^<svg[\s>]/i.test(trimmed) && /<\/svg>\s*$/i.test(trimmed)) {
    return 'svg'
  }
  
  // HTML completo
  if (/^<!doctype\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return 'html'
  }
  
  // Markdown
  if (/^#{1,6}\s/.test(trimmed) || /^\*\*.*\*\*/.test(trimmed) || /^-\s/.test(trimmed)) {
    // Verificar que no sea código mezclado
    if (!/<[A-Z]/.test(trimmed) && !/{/.test(trimmed)) {
      return 'markdown'
    }
  }

  // React patterns
  const reactPatterns = [
    /export\s+default/,                           // export default
    /export\s+function/,                          // export function
    /export\s+const/,                             // export const
    /^import\s+/m,                                // imports
    /\bReact\./,                                  // React.
    /\buseState\b/,                               // hooks
    /\buseEffect\b/,
    /\buseRef\b/,
    /\buseMemo\b/,
    /\buseCallback\b/,
    /\buseContext\b/,
    /\buseReducer\b/,
    /\bconst\s+\[\w+,\s*set\w+\]\s*=/,           // const [state, setState] =
    /className\s*=/,                              // className=
    /onClick\s*=/,                                // onClick=
    /onChange\s*=/,                               // onChange=
    /\bfunction\s+[A-Z]\w*\s*\(/,                // function ComponentName(
    /\bconst\s+[A-Z]\w*\s*=\s*\(/,               // const ComponentName = (
    /\bconst\s+[A-Z]\w*\s*=\s*\(\)\s*=>/,        // const ComponentName = () =>
    /\bconst\s+[A-Z]\w*:\s*React\.FC/,           // const ComponentName: React.FC
  ]
  
  const isReact = reactPatterns.some(pattern => pattern.test(trimmed))
  
  if (isReact) {
    return 'react'
  }
  
  // JSX fragment (componente sin export, solo JSX)
  const hasJSX = /<[A-Z][a-zA-Z]*[\s/>]/.test(trimmed) || 
                 /className=/.test(trimmed) ||
                 /{.*}/.test(trimmed)
  
  if (hasJSX && !/<\/?(html|head|body|script|style|link|meta)[\s>]/i.test(trimmed)) {
    return 'jsx-fragment'
  }
  
  // HTML simple (fragmentos HTML sin React)
  if (/<[a-z][\w-]*[\s>]/i.test(trimmed)) {
    return 'html'
  }
  
  return 'unknown'
}

// ============================================================================
// LIMPIEZA Y PROCESAMIENTO DE CÓDIGO REACT
// ============================================================================

interface CleanedCode {
  cleanCode: string
  componentName: string
  usedLibraries: Set<string>
}

function cleanReactCode(code: string): CleanedCode {
  let componentName = 'App'
  const usedLibraries = new Set<string>()
  
  // Detectar librerías usadas analizando imports
  const importMatches = code.matchAll(/import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g)
  for (const match of importMatches) {
    usedLibraries.add(match[1])
  }
  
  // También detectar por uso directo (sin import)
  if (/\b(LineChart|BarChart|PieChart|AreaChart|XAxis|YAxis|Tooltip|Legend|ResponsiveContainer)\b/.test(code)) {
    usedLibraries.add('recharts')
  }
  if (/\b(motion\.|AnimatePresence|useAnimation|useSpring)\b/.test(code)) {
    usedLibraries.add('framer-motion')
  }
  // Detección ampliada de iconos de Lucide
  if (/\b(ChevronRight|ChevronLeft|ChevronDown|ChevronUp|Menu|X|Search|User|Settings|Home|Star|Heart|Check|Plus|Minus|Edit|Trash|Download|Upload|Mail|Phone|Calendar|Clock|MapPin|Globe|Lock|Unlock|Eye|EyeOff|Bell|AlertCircle|Info|HelpCircle|ArrowRight|ArrowLeft|ArrowUp|ArrowDown|ExternalLink|Copy|Share|Filter|Grid|List|MoreHorizontal|MoreVertical|Loader|RefreshCw|Save|Send|Image|File|Folder|Video|Music|Camera|Mic|Volume|Play|Pause|SkipForward|SkipBack|Maximize|Minimize|Sun|Moon|Cloud|Zap|Award|Gift|ShoppingCart|ShoppingBag|CreditCard|DollarSign|TrendingUp|TrendingDown|Activity|PieChart|BarChart2|LineChart|Brain|Network|MessageSquare|Shield|Sparkles|Radio|Mic2|Wand2|Headphones|Users)\b/.test(code)) {
    usedLibraries.add('lucide-react')
  }
  if (/\b_\.(\w+)\(/.test(code) || /\blodash\b/.test(code)) {
    usedLibraries.add('lodash')
  }
  if (/\bformat\s*\(|parseISO|addDays|subDays|differenceIn/.test(code)) {
    usedLibraries.add('date-fns')
  }
  if (/\buuid\b|v4\(\)/.test(code)) {
    usedLibraries.add('uuid')
  }
  if (/\baxios\b/.test(code)) {
    usedLibraries.add('axios')
  }
  // Detectar shadcn/ui
  if (/@\/components\/ui\//.test(code) || /\b(Card|CardContent|CardHeader|CardTitle|CardDescription|CardFooter|Button|Badge|Input|Switch|Accordion|AccordionItem|AccordionTrigger|AccordionContent|Dialog|DialogTrigger|DialogContent|DialogHeader|DialogTitle|DialogDescription|Tabs|TabsList|TabsTrigger|TabsContent|Select|SelectTrigger|SelectValue|SelectContent|SelectItem|Slider|Progress|Avatar|AvatarImage|AvatarFallback|Tooltip|TooltipTrigger|TooltipContent|TooltipProvider|Alert|AlertTitle|AlertDescription|Checkbox|Label|Textarea|Separator|ScrollArea|Sheet|SheetTrigger|SheetContent|DropdownMenu|DropdownMenuTrigger|DropdownMenuContent|DropdownMenuItem)\b/.test(code)) {
    usedLibraries.add('shadcn-ui')
  }
  
  // Extraer nombre del componente - múltiples patrones
  const patterns = [
    /export\s+default\s+function\s+(\w+)/,                    // export default function Name
    /export\s+default\s+(?:const|let|var)\s+(\w+)/,          // export default const Name
    /export\s+default\s+(?:React\.)?memo\(\s*(\w+)/,         // export default memo(Name)
    /export\s+default\s+(?:React\.)?forwardRef\([^)]*(\w+)/, // export default forwardRef
    /function\s+([A-Z]\w*)\s*\([^)]*\)\s*{[\s\S]*return/,    // function Name() { return
    /const\s+([A-Z]\w*)\s*=\s*\([^)]*\)\s*=>/,               // const Name = () =>
    /const\s+([A-Z]\w*)\s*=\s*function/,                      // const Name = function
    /const\s+([A-Z]\w*)\s*:\s*React\.FC/,                    // const Name: React.FC
    /class\s+([A-Z]\w*)\s+extends\s+(?:React\.)?Component/,  // class Name extends Component
    /export\s+default\s+(\w+)\s*;?\s*$/m,                    // export default Name (al final)
  ]
  
  for (const pattern of patterns) {
    const match = code.match(pattern)
    if (match && match[1]) {
      componentName = match[1]
      break
    }
  }
  
  // Limpiar código
  let cleanCode = code
  
  // Eliminar imports (multilínea también)
  cleanCode = cleanCode
    // Import simple de una línea
    .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '')
    // Import multilínea
    .replace(/^import\s+\{[\s\S]*?\}\s+from\s+['"].*?['"];?\s*$/gm, '')
    // Import de side effects
    .replace(/^import\s+['"].*?['"];?\s*$/gm, '')
    // Import type
    .replace(/^import\s+type\s+.*?from\s+['"].*?['"];?\s*$/gm, '')
  
  // Limpiar exports pero mantener la función/componente
  cleanCode = cleanCode
    .replace(/export\s+default\s+function\s+/, 'function ')
    .replace(/export\s+default\s+class\s+/, 'class ')
    .replace(/export\s+default\s+(?:const|let|var)\s+/, 'const ')
    .replace(/export\s+default\s+(?:React\.)?memo\(/, 'const MemoizedComponent = React.memo(')
    .replace(/export\s+default\s+(?:React\.)?forwardRef\(/, 'const ForwardedComponent = React.forwardRef(')
    // Export default al final (ej: export default App;)
    .replace(/export\s+default\s+(\w+)\s*;?\s*$/m, '')
    // Named exports
    .replace(/export\s+(?:const|let|var|function|class)\s+/g, (match) => {
      return match.replace('export ', '')
    })
  
  // Limpiar líneas vacías excesivas
  cleanCode = cleanCode.replace(/\n{3,}/g, '\n\n').trim()
  
  return { cleanCode, componentName, usedLibraries }
}

function wrapJSXFragment(code: string): string {
  // Envolver JSX suelto en un componente
  return `
export default function App() {
  return (
    ${code}
  );
}
`
}

// ============================================================================
// GENERADORES DE HTML
// ============================================================================

function generateReactHTML(code: string): string {
  const { cleanCode, componentName, usedLibraries } = cleanReactCode(code)
  
  // Encoding seguro para Unicode
  const encodedCode = safeBase64Encode(cleanCode)
  
  // Generar scripts de librerías necesarias
  const libraryScripts = generateLibraryScripts(usedLibraries)
  const librarySetup = generateLibrarySetup(usedLibraries)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  ${libraryScripts}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
    #root { min-height: 100vh; }
    
    /* Error styles */
    .error-container {
      padding: 20px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      margin: 20px;
    }
    .error-title {
      color: #dc2626;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .error-message {
      color: #7f1d1d;
      font-family: monospace;
      font-size: 14px;
      white-space: pre-wrap;
      overflow-x: auto;
    }
    .error-stack {
      margin-top: 12px;
      padding: 12px;
      background: #fff;
      border-radius: 4px;
      font-size: 12px;
      color: #666;
      max-height: 200px;
      overflow-y: auto;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    // Error Boundary global
    window.onerror = function(message, source, lineno, colno, error) {
      showError('Runtime Error', message, error?.stack);
      return true;
    };
    
    window.onunhandledrejection = function(event) {
      showError('Unhandled Promise Rejection', event.reason?.message || event.reason, event.reason?.stack);
    };
    
    function showError(title, message, stack) {
      const root = document.getElementById('root');
      root.innerHTML = \`
        <div class="error-container">
          <div class="error-title">\${escapeHtml(title)}</div>
          <div class="error-message">\${escapeHtml(String(message))}</div>
          \${stack ? \`<div class="error-stack">\${escapeHtml(stack)}</div>\` : ''}
        </div>
      \`;
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    try {
      const encodedCode = "${encodedCode}";
      const userCode = decodeURIComponent(escape(atob(encodedCode)));
      
      ${librarySetup}
      
      const fullCode = \`
        // React hooks y utilidades
        const { 
          useState, useEffect, useRef, useMemo, useCallback, 
          createContext, useContext, Fragment, useReducer, 
          useId, useLayoutEffect, useImperativeHandle,
          forwardRef, memo, lazy, Suspense, startTransition,
          useTransition, useDeferredValue, useSyncExternalStore
        } = React;
        
        // Error Boundary Component
        class ErrorBoundary extends React.Component {
          constructor(props) {
            super(props);
            this.state = { hasError: false, error: null };
          }
          static getDerivedStateFromError(error) {
            return { hasError: true, error };
          }
          componentDidCatch(error, errorInfo) {
            console.error('Component Error:', error, errorInfo);
          }
          render() {
            if (this.state.hasError) {
              return React.createElement('div', { className: 'error-container' },
                React.createElement('div', { className: 'error-title' }, 'Component Error'),
                React.createElement('div', { className: 'error-message' }, this.state.error?.message || 'Unknown error'),
                this.state.error?.stack ? React.createElement('div', { className: 'error-stack' }, this.state.error.stack) : null
              );
            }
            return this.props.children;
          }
        }
        
        \${userCode}
        
        // Render con Error Boundary
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(
          React.createElement(ErrorBoundary, null,
            React.createElement(${componentName})
          )
        );
      \`;
      
      const transformed = Babel.transform(fullCode, { 
        filename: 'artifact.tsx',
        presets: ['react', 'typescript'],
        plugins: []
      }).code;
      
      eval(transformed);
    } catch (err) {
      showError('Compilation Error', err.message, err.stack);
    }
  </script>
</body>
</html>`
}

function generateLibraryScripts(libraries: Set<string>): string {
  const scripts: string[] = []
  
  // Prop-types (dependencia común)
  scripts.push('<script src="https://unpkg.com/prop-types@15/prop-types.min.js"></script>')
  
  // Recharts
  if (libraries.has('recharts')) {
    scripts.push('<script src="https://unpkg.com/recharts@2.12.7/umd/Recharts.min.js"></script>')
  }
  
  // Framer Motion
  if (libraries.has('framer-motion')) {
    scripts.push('<script src="https://cdn.jsdelivr.net/npm/framer-motion@11.0.0/dist/framer-motion.min.js"></script>')
  }
  
  // Lodash
  if (libraries.has('lodash')) {
    scripts.push('<script src="https://unpkg.com/lodash@4.17.21/lodash.min.js"></script>')
  }
  
  // date-fns
  if (libraries.has('date-fns')) {
    scripts.push('<script src="https://cdn.jsdelivr.net/npm/date-fns@3.6.0/cdn.min.js"></script>')
  }
  
  // Axios
  if (libraries.has('axios')) {
    scripts.push('<script src="https://unpkg.com/axios@1.6.8/dist/axios.min.js"></script>')
  }
  
  // UUID
  if (libraries.has('uuid')) {
    scripts.push('<script src="https://unpkg.com/uuid@9.0.1/dist/umd/uuid.min.js"></script>')
  }
  
  // Chart.js
  scripts.push('<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.2"></script>')
  
  // Lucide React
  if (libraries.has('lucide-react')) {
    scripts.push('<script src="https://unpkg.com/lucide@0.263.1/dist/umd/lucide.js"></script>')
  }
  
  return scripts.join('\n  ')
}

function generateLibrarySetup(libraries: Set<string>): string {
  const setup: string[] = []
  
  // ============================================================================
  // LUCIDE ICONS - Lista completa de iconos
  // ============================================================================
  if (libraries.has('lucide-react')) {
    setup.push(`
    // Lucide React icons setup - COMPREHENSIVE VERSION
    const createLucideIcon = (iconName) => {
      return (props = {}) => {
        const { size = 24, color, strokeWidth = 2, className, style, ...rest } = props;
        
        // Crear elemento SVG usando lucide.createElement
        if (window.lucide && window.lucide.createElement) {
          const svgElement = window.lucide.createElement(iconName);
          if (svgElement) {
            const clonedSvg = svgElement.cloneNode(true);
            clonedSvg.setAttribute('width', size);
            clonedSvg.setAttribute('height', size);
            if (color) clonedSvg.setAttribute('stroke', color);
            if (strokeWidth) clonedSvg.setAttribute('stroke-width', strokeWidth);
            if (className) clonedSvg.setAttribute('class', className);
            
            return React.createElement('span', {
              dangerouslySetInnerHTML: { __html: clonedSvg.outerHTML },
              style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style },
              ...rest
            });
          }
        }
        
        // Fallback: SVG placeholder
        return React.createElement('svg', {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: color || 'currentColor',
          strokeWidth: strokeWidth,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          className,
          style,
          ...rest
        }, React.createElement('circle', { cx: 12, cy: 12, r: 10 }));
      };
    };
    
    // Lista COMPLETA de iconos de Lucide
    const iconNames = [
      // Navigation & Arrows
      'ChevronRight', 'ChevronLeft', 'ChevronDown', 'ChevronUp',
      'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown',
      'ArrowUpRight', 'ArrowDownRight', 'ArrowUpLeft', 'ArrowDownLeft',
      'ChevronsUp', 'ChevronsDown', 'ChevronsLeft', 'ChevronsRight',
      'CornerDownLeft', 'CornerDownRight', 'CornerUpLeft', 'CornerUpRight',
      'MoveUp', 'MoveDown', 'MoveLeft', 'MoveRight',
      
      // Common UI
      'Menu', 'X', 'Search', 'User', 'Settings', 'Home',
      'Star', 'Heart', 'Check', 'Plus', 'Minus', 'Edit', 'Trash', 'Trash2',
      'Download', 'Upload', 'Mail', 'Phone', 'Calendar', 'Clock',
      'MapPin', 'Globe', 'Lock', 'Unlock', 'Eye', 'EyeOff',
      'Bell', 'BellOff', 'AlertCircle', 'AlertTriangle', 'Info', 'HelpCircle',
      'ExternalLink', 'Copy', 'Share', 'Share2', 'Filter', 'Grid', 'List',
      'MoreHorizontal', 'MoreVertical', 'Loader', 'Loader2', 'RefreshCw', 'RefreshCcw',
      'Save', 'Send', 'Image', 'File', 'FileText', 'Folder', 'FolderOpen',
      'Video', 'Music', 'Music2', 'Music3', 'Music4',
      'Camera', 'Mic', 'Mic2', 'MicOff', 'Volume', 'Volume1', 'Volume2', 'VolumeX',
      'Play', 'Pause', 'Square', 'Circle', 'SkipForward', 'SkipBack',
      'FastForward', 'Rewind', 'Repeat', 'Shuffle',
      'Maximize', 'Maximize2', 'Minimize', 'Minimize2', 'Expand', 'Shrink',
      'Sun', 'Moon', 'Cloud', 'CloudRain', 'CloudSnow', 'Wind', 'Umbrella',
      
      // Business & Finance
      'Zap', 'Award', 'Gift', 'ShoppingCart', 'ShoppingBag', 'CreditCard', 'DollarSign',
      'TrendingUp', 'TrendingDown', 'Activity', 'PieChart', 'BarChart', 'BarChart2', 'BarChart3', 'LineChart',
      'Briefcase', 'Building', 'Building2', 'Store', 'Wallet', 'Receipt', 'Tag', 'Tags', 'Percent',
      
      // Technology & AI
      'Brain', 'Network', 'Cpu', 'Database', 'Server', 'HardDrive', 'Wifi', 'WifiOff',
      'Bluetooth', 'Cast', 'Smartphone', 'Tablet', 'Laptop', 'Monitor', 'Tv', 'Speaker',
      'Code', 'Code2', 'Terminal', 'GitBranch', 'GitCommit', 'GitMerge', 'GitPullRequest',
      
      // Communication
      'MessageSquare', 'MessageCircle', 'Mail', 'Inbox', 'Send', 'AtSign',
      'Phone', 'PhoneCall', 'PhoneOff', 'PhoneIncoming', 'PhoneOutgoing',
      'Video', 'VideoOff', 'Voicemail',
      
      // Media & Audio
      'Radio', 'Headphones', 'Disc', 'Film', 'Clapperboard', 'Aperture',
      'ImagePlus', 'ImageMinus', 'Images', 'Palette', 'Pipette', 'Brush', 'PenTool',
      
      // Security & Privacy
      'Shield', 'ShieldCheck', 'ShieldAlert', 'ShieldOff', 'ShieldQuestion',
      'Key', 'KeyRound', 'Fingerprint', 'Scan', 'ScanLine',
      
      // People & Social
      'Users', 'UserPlus', 'UserMinus', 'UserCheck', 'UserX', 'UserCog',
      'Contact', 'Contact2', 'PersonStanding', 'Accessibility',
      'ThumbsUp', 'ThumbsDown', 'Smile', 'Frown', 'Meh', 'Angry', 'Laugh',
      
      // Objects
      'Lightbulb', 'Lamp', 'LampDesk', 'LampFloor',
      'Book', 'BookOpen', 'BookMarked', 'Bookmark', 'BookmarkPlus', 'BookmarkMinus',
      'Newspaper', 'Scroll', 'FileSignature', 'ClipboardList', 'ClipboardCheck',
      'Package', 'Box', 'Archive', 'Truck', 'Plane', 'Car', 'Train', 'Ship', 'Bike',
      'Coffee', 'Utensils', 'Pizza', 'Apple', 'Cake', 'Wine', 'Beer', 'Martini',
      
      // Shapes & Design
      'Circle', 'Square', 'Triangle', 'Hexagon', 'Octagon', 'Pentagon',
      'Diamond', 'Heart', 'Star', 'Sparkle', 'Sparkles', 'Wand', 'Wand2',
      'Flag', 'Bookmark', 'Pin', 'MapPin',
      
      // Actions
      'CheckCircle', 'CheckCircle2', 'XCircle', 'PlusCircle', 'MinusCircle',
      'CheckSquare', 'XSquare', 'PlusSquare', 'MinusSquare',
      'RotateCw', 'RotateCcw', 'FlipHorizontal', 'FlipVertical',
      'ZoomIn', 'ZoomOut', 'Move', 'Grab', 'Hand', 'Pointer', 'MousePointer',
      
      // Misc
      'Hash', 'Link', 'Link2', 'Unlink', 'Paperclip', 'Scissors', 'Slice',
      'Type', 'Bold', 'Italic', 'Underline', 'Strikethrough',
      'AlignLeft', 'AlignCenter', 'AlignRight', 'AlignJustify',
      'ListOrdered', 'ListTodo', 'ListChecks', 'ListX',
      'Table', 'Table2', 'Columns', 'Rows', 'LayoutGrid', 'LayoutList',
      'Layers', 'Component', 'Box', 'Boxes', 'Package', 'Puzzle',
      'Timer', 'TimerOff', 'TimerReset', 'Hourglass', 'History', 'Undo', 'Redo',
      'Slash', 'Asterisk', 'Command', 'Option', 'Delete', 'CornerUpLeft',
      'LogIn', 'LogOut', 'Power', 'PowerOff', 'ToggleLeft', 'ToggleRight',
      'QrCode', 'Barcode', 'Binary', 'Braces', 'Parentheses', 'Brackets'
    ];
    
    // Crear componentes React para cada icono
    iconNames.forEach(name => {
      const kebabName = name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      window[name] = createLucideIcon(kebabName);
    });
  `)
  }
  
  // ============================================================================
  // SHADCN/UI COMPONENTS - Implementaciones completas
  // ============================================================================
  if (libraries.has('shadcn-ui')) {
    setup.push(`
    // ============================================================================
    // SHADCN/UI COMPONENTS - Full Implementation
    // ============================================================================
    
    // Utility function for className merging
    const cn = (...classes) => classes.filter(Boolean).join(' ');
    window.cn = cn;
    
    // ----------------------------------------------------------------------------
    // CARD COMPONENTS
    // ----------------------------------------------------------------------------
    const Card = React.forwardRef(({ className, ...props }, ref) => {
      return React.createElement('div', {
        ref,
        className: cn(
          'rounded-xl border border-neutral-200 bg-white text-neutral-950 shadow dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50',
          className
        ),
        ...props
      });
    });
    Card.displayName = 'Card';
    window.Card = Card;
    
    const CardHeader = React.forwardRef(({ className, ...props }, ref) => {
      return React.createElement('div', {
        ref,
        className: cn('flex flex-col space-y-1.5 p-6', className),
        ...props
      });
    });
    CardHeader.displayName = 'CardHeader';
    window.CardHeader = CardHeader;
    
    const CardTitle = React.forwardRef(({ className, ...props }, ref) => {
      return React.createElement('h3', {
        ref,
        className: cn('font-semibold leading-none tracking-tight', className),
        ...props
      });
    });
    CardTitle.displayName = 'CardTitle';
    window.CardTitle = CardTitle;
    
    const CardDescription = React.forwardRef(({ className, ...props }, ref) => {
      return React.createElement('p', {
        ref,
        className: cn('text-sm text-neutral-500 dark:text-neutral-400', className),
        ...props
      });
    });
    CardDescription.displayName = 'CardDescription';
    window.CardDescription = CardDescription;
    
    const CardContent = React.forwardRef(({ className, ...props }, ref) => {
      return React.createElement('div', {
        ref,
        className: cn('p-6 pt-0', className),
        ...props
      });
    });
    CardContent.displayName = 'CardContent';
    window.CardContent = CardContent;
    
    const CardFooter = React.forwardRef(({ className, ...props }, ref) => {
      return React.createElement('div', {
        ref,
        className: cn('flex items-center p-6 pt-0', className),
        ...props
      });
    });
    CardFooter.displayName = 'CardFooter';
    window.CardFooter = CardFooter;
    
    // ----------------------------------------------------------------------------
    // BUTTON COMPONENT
    // ----------------------------------------------------------------------------
    const buttonVariants = {
      default: 'bg-neutral-900 text-neutral-50 shadow hover:bg-neutral-900/90 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-50/90',
      destructive: 'bg-red-500 text-neutral-50 shadow-sm hover:bg-red-500/90 dark:bg-red-900 dark:text-neutral-50 dark:hover:bg-red-900/90',
      outline: 'border border-neutral-200 bg-white shadow-sm hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-800 dark:hover:text-neutral-50',
      secondary: 'bg-neutral-100 text-neutral-900 shadow-sm hover:bg-neutral-100/80 dark:bg-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-800/80',
      ghost: 'hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-50',
      link: 'text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-50',
    };
    
    const buttonSizes = {
      default: 'h-9 px-4 py-2',
      sm: 'h-8 rounded-md px-3 text-xs',
      lg: 'h-10 rounded-md px-8',
      icon: 'h-9 w-9',
    };
    
    const Button = React.forwardRef(({ 
      className, 
      variant = 'default', 
      size = 'default', 
      asChild = false,
      ...props 
    }, ref) => {
      return React.createElement('button', {
        ref,
        className: cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-950 disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-neutral-300',
          buttonVariants[variant] || buttonVariants.default,
          buttonSizes[size] || buttonSizes.default,
          className
        ),
        ...props
      });
    });
    Button.displayName = 'Button';
    window.Button = Button;
    
    // ----------------------------------------------------------------------------
    // BADGE COMPONENT
    // ----------------------------------------------------------------------------
    const badgeVariants = {
      default: 'border-transparent bg-neutral-900 text-neutral-50 shadow hover:bg-neutral-900/80 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-50/80',
      secondary: 'border-transparent bg-neutral-100 text-neutral-900 hover:bg-neutral-100/80 dark:bg-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-800/80',
      destructive: 'border-transparent bg-red-500 text-neutral-50 shadow hover:bg-red-500/80 dark:bg-red-900 dark:text-neutral-50 dark:hover:bg-red-900/80',
      outline: 'text-neutral-950 dark:text-neutral-50',
    };
    
    const Badge = React.forwardRef(({ className, variant = 'default', ...props }, ref) => {
      return React.createElement('div', {
        ref,
        className: cn(
          'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:ring-offset-2 dark:focus:ring-neutral-300',
          badgeVariants[variant] || badgeVariants.default,
          className
        ),
        ...props
      });
    });
    Badge.displayName = 'Badge';
    window.Badge = Badge;
    
    // ----------------------------------------------------------------------------
    // INPUT COMPONENT
    // ----------------------------------------------------------------------------
    const Input = React.forwardRef(({ className, type = 'text', ...props }, ref) => {
      return React.createElement('input', {
        ref,
        type,
        className: cn(
          'flex h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-neutral-950 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:file:text-neutral-50 dark:placeholder:text-neutral-400 dark:focus-visible:ring-neutral-300',
          className
        ),
        ...props
      });
    });
    Input.displayName = 'Input';
    window.Input = Input;
    
    // ----------------------------------------------------------------------------
    // TEXTAREA COMPONENT
    // ----------------------------------------------------------------------------
    const Textarea = React.forwardRef(({ className, ...props }, ref) => {
      return React.createElement('textarea', {
        ref,
        className: cn(
          'flex min-h-[60px] w-full rounded-md border border-neutral-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:placeholder:text-neutral-400 dark:focus-visible:ring-neutral-300',
          className
        ),
        ...props
      });
    });
    Textarea.displayName = 'Textarea';
    window.Textarea = Textarea;
    
    // ----------------------------------------------------------------------------
    // LABEL COMPONENT
    // ----------------------------------------------------------------------------
    const Label = React.forwardRef(({ className, ...props }, ref) => {
      return React.createElement('label', {
        ref,
        className: cn(
          'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
          className
        ),
        ...props
      });
    });
    Label.displayName = 'Label';
    window.Label = Label;
    
    // ----------------------------------------------------------------------------
    // SWITCH COMPONENT
    // ----------------------------------------------------------------------------
    const Switch = React.forwardRef(({ className, checked, onCheckedChange, ...props }, ref) => {
      return React.createElement('button', {
        ref,
        role: 'switch',
        'aria-checked': checked,
        onClick: () => onCheckedChange && onCheckedChange(!checked),
        className: cn(
          'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-neutral-900 dark:bg-neutral-50' : 'bg-neutral-200 dark:bg-neutral-800',
          className
        ),
        ...props
      }, React.createElement('span', {
        className: cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform dark:bg-neutral-950',
          checked ? 'translate-x-4' : 'translate-x-0'
        )
      }));
    });
    Switch.displayName = 'Switch';
    window.Switch = Switch;
    
    // ----------------------------------------------------------------------------
    // CHECKBOX COMPONENT
    // ----------------------------------------------------------------------------
    const Checkbox = React.forwardRef(({ className, checked, onCheckedChange, ...props }, ref) => {
      return React.createElement('button', {
        ref,
        role: 'checkbox',
        'aria-checked': checked,
        onClick: () => onCheckedChange && onCheckedChange(!checked),
        className: cn(
          'peer h-4 w-4 shrink-0 rounded-sm border border-neutral-900 shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-50 dark:focus-visible:ring-neutral-300',
          checked && 'bg-neutral-900 text-neutral-50 dark:bg-neutral-50 dark:text-neutral-900',
          className
        ),
        ...props
      }, checked && React.createElement('span', { className: 'flex items-center justify-center text-current' },
        React.createElement('svg', { 
          width: 10, 
          height: 10, 
          viewBox: '0 0 24 24', 
          fill: 'none', 
          stroke: 'currentColor', 
          strokeWidth: 3 
        }, React.createElement('polyline', { points: '20 6 9 17 4 12' }))
      ));
    });
    Checkbox.displayName = 'Checkbox';
    window.Checkbox = Checkbox;
    
    // ----------------------------------------------------------------------------
    // SEPARATOR COMPONENT
    // ----------------------------------------------------------------------------
    const Separator = React.forwardRef(({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => {
      return React.createElement('div', {
        ref,
        role: decorative ? 'none' : 'separator',
        'aria-orientation': decorative ? undefined : orientation,
        className: cn(
          'shrink-0 bg-neutral-200 dark:bg-neutral-800',
          orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
          className
        ),
        ...props
      });
    });
    Separator.displayName = 'Separator';
    window.Separator = Separator;
    
    // ----------------------------------------------------------------------------
    // PROGRESS COMPONENT
    // ----------------------------------------------------------------------------
    const Progress = React.forwardRef(({ className, value = 0, ...props }, ref) => {
      return React.createElement('div', {
        ref,
        className: cn('relative h-2 w-full overflow-hidden rounded-full bg-neutral-900/20 dark:bg-neutral-50/20', className),
        ...props
      }, React.createElement('div', {
        className: 'h-full w-full flex-1 bg-neutral-900 transition-all dark:bg-neutral-50',
        style: { transform: \`translateX(-\${100 - (value || 0)}%)\` }
      }));
    });
    Progress.displayName = 'Progress';
    window.Progress = Progress;
    
    // ----------------------------------------------------------------------------
    // SLIDER COMPONENT
    // ----------------------------------------------------------------------------
    const Slider = React.forwardRef(({ className, value = [0], onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => {
      const percentage = ((value[0] - min) / (max - min)) * 100;
      
      return React.createElement('div', {
        ref,
        className: cn('relative flex w-full touch-none select-none items-center', className),
        ...props
      },
        React.createElement('div', {
          className: 'relative h-1.5 w-full grow overflow-hidden rounded-full bg-neutral-900/20 dark:bg-neutral-50/20'
        },
          React.createElement('div', {
            className: 'absolute h-full bg-neutral-900 dark:bg-neutral-50',
            style: { width: \`\${percentage}%\` }
          })
        ),
        React.createElement('input', {
          type: 'range',
          min,
          max,
          step,
          value: value[0],
          onChange: (e) => onValueChange && onValueChange([parseFloat(e.target.value)]),
          className: 'absolute w-full h-full opacity-0 cursor-pointer'
        })
      );
    });
    Slider.displayName = 'Slider';
    window.Slider = Slider;
    
    // ----------------------------------------------------------------------------
    // ACCORDION COMPONENTS
    // ----------------------------------------------------------------------------
    const AccordionContext = React.createContext({ openItems: [], toggleItem: () => {}, type: 'single' });
    
    const Accordion = ({ children, type = 'single', collapsible = false, defaultValue, className, ...props }) => {
      const [openItems, setOpenItems] = React.useState(
        defaultValue ? (Array.isArray(defaultValue) ? defaultValue : [defaultValue]) : []
      );
      
      const toggleItem = (value) => {
        if (type === 'single') {
          setOpenItems(prev => {
            if (prev.includes(value)) {
              return collapsible ? [] : prev;
            }
            return [value];
          });
        } else {
          setOpenItems(prev => 
            prev.includes(value) 
              ? prev.filter(v => v !== value)
              : [...prev, value]
          );
        }
      };
      
      return React.createElement(AccordionContext.Provider, {
        value: { openItems, toggleItem, type }
      }, React.createElement('div', { className: cn('', className), ...props }, children));
    };
    window.Accordion = Accordion;
    
    const AccordionItem = React.forwardRef(({ children, value, className, ...props }, ref) => {
      return React.createElement('div', {
        ref,
        'data-value': value,
        className: cn('border-b', className),
        ...props
      }, React.Children.map(children, child => 
        React.isValidElement(child) ? React.cloneElement(child, { itemValue: value }) : child
      ));
    });
    AccordionItem.displayName = 'AccordionItem';
    window.AccordionItem = AccordionItem;
    
    const AccordionTrigger = React.forwardRef(({ children, className, itemValue, ...props }, ref) => {
      const { openItems, toggleItem } = React.useContext(AccordionContext);
      const isOpen = openItems.includes(itemValue);
      
      return React.createElement('h3', { className: 'flex' },
        React.createElement('button', {
          ref,
          type: 'button',
          onClick: () => toggleItem(itemValue),
          'aria-expanded': isOpen,
          className: cn(
            'flex flex-1 items-center justify-between py-4 text-sm font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180',
            className
          ),
          'data-state': isOpen ? 'open' : 'closed',
          ...props
        }, children, 
          React.createElement('svg', {
            width: 16,
            height: 16,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            className: cn('h-4 w-4 shrink-0 text-neutral-500 transition-transform duration-200', isOpen && 'rotate-180')
          }, React.createElement('path', { d: 'M6 9l6 6 6-6' }))
        )
      );
    });
    AccordionTrigger.displayName = 'AccordionTrigger';
    window.AccordionTrigger = AccordionTrigger;
    
    const AccordionContent = React.forwardRef(({ children, className, itemValue, ...props }, ref) => {
      const { openItems } = React.useContext(AccordionContext);
      const isOpen = openItems.includes(itemValue);
      
      if (!isOpen) return null;
      
      return React.createElement('div', {
        ref,
        className: cn('overflow-hidden text-sm', className),
        'data-state': isOpen ? 'open' : 'closed',
        ...props
      }, React.createElement('div', { className: 'pb-4 pt-0' }, children));
    });
    AccordionContent.displayName = 'AccordionContent';
    window.AccordionContent = AccordionContent;
    
    // ----------------------------------------------------------------------------
    // AVATAR COMPONENTS
    // ----------------------------------------------------------------------------
    const Avatar = React.forwardRef(({ className, ...props }, ref) => {
      return React.createElement('span', {
        ref,
        className: cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className),
        ...props
      });
    });
    Avatar.displayName = 'Avatar';
    window.Avatar = Avatar;
    
    const AvatarImage = React.forwardRef(({ className, src, alt, ...props }, ref) => {
      const [hasError, setHasError] = React.useState(false);
      
      if (hasError || !src) return null;
      
      return React.createElement('img', {
        ref,
        src,
        alt,
        onError: () => setHasError(true),
        className: cn('aspect-square h-full w-full', className),
        ...props
      });
    });
    AvatarImage.displayName = 'AvatarImage';
    window.AvatarImage = AvatarImage;
    
    const AvatarFallback = React.forwardRef(({ className, ...props }, ref) => {
      return React.createElement('span', {
        ref,
        className: cn('flex h-full w-full items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800', className),
        ...props
      });
    });
    AvatarFallback.displayName = 'AvatarFallback';
    window.AvatarFallback = AvatarFallback;
    
    // ----------------------------------------------------------------------------
    // ALERT COMPONENTS
    // ----------------------------------------------------------------------------
    const alertVariants = {
      default: 'bg-white text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50',
      destructive: 'border-red-500/50 text-red-500 dark:border-red-500 [&>svg]:text-red-500 dark:border-red-900/50 dark:text-red-900 dark:dark:border-red-900 dark:[&>svg]:text-red-900',
    };
    
    const Alert = React.forwardRef(({ className, variant = 'default', ...props }, ref) => {
      return React.createElement('div', {
        ref,
        role: 'alert',
        className: cn(
          'relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-neutral-950 [&>svg~*]:pl-7 dark:[&>svg]:text-neutral-50',
          alertVariants[variant],
          className
        ),
        ...props
      });
    });
    Alert.displayName = 'Alert';
    window.Alert = Alert;
    
    const AlertTitle = React.forwardRef(({ className, ...props }, ref) => {
      return React.createElement('h5', {
        ref,
        className: cn('mb-1 font-medium leading-none tracking-tight', className),
        ...props
      });
    });
    AlertTitle.displayName = 'AlertTitle';
    window.AlertTitle = AlertTitle;
    
    const AlertDescription = React.forwardRef(({ className, ...props }, ref) => {
      return React.createElement('div', {
        ref,
        className: cn('text-sm [&_p]:leading-relaxed', className),
        ...props
      });
    });
    AlertDescription.displayName = 'AlertDescription';
    window.AlertDescription = AlertDescription;
    
    // ----------------------------------------------------------------------------
    // TABS COMPONENTS
    // ----------------------------------------------------------------------------
    const TabsContext = React.createContext({ value: '', onValueChange: () => {} });
    
    const Tabs = ({ children, defaultValue, value: controlledValue, onValueChange, className, ...props }) => {
      const [internalValue, setInternalValue] = React.useState(defaultValue || '');
      const value = controlledValue !== undefined ? controlledValue : internalValue;
      
      const handleValueChange = (newValue) => {
        if (controlledValue === undefined) {
          setInternalValue(newValue);
        }
        onValueChange && onValueChange(newValue);
      };
      
      return React.createElement(TabsContext.Provider, {
        value: { value, onValueChange: handleValueChange }
      }, React.createElement('div', { className: cn('', className), ...props }, children));
    };
    window.Tabs = Tabs;
    
    const TabsList = React.forwardRef(({ className, ...props }, ref) => {
      return React.createElement('div', {
        ref,
        className: cn(
          'inline-flex h-9 items-center justify-center rounded-lg bg-neutral-100 p-1 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
          className
        ),
        ...props
      });
    });
    TabsList.displayName = 'TabsList';
    window.TabsList = TabsList;
    
    const TabsTrigger = React.forwardRef(({ className, value: triggerValue, ...props }, ref) => {
      const { value, onValueChange } = React.useContext(TabsContext);
      const isActive = value === triggerValue;
      
      return React.createElement('button', {
        ref,
        onClick: () => onValueChange(triggerValue),
        className: cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-neutral-950 dark:focus-visible:ring-neutral-300',
          isActive && 'bg-white text-neutral-950 shadow dark:bg-neutral-950 dark:text-neutral-50',
          className
        ),
        'data-state': isActive ? 'active' : 'inactive',
        ...props
      });
    });
    TabsTrigger.displayName = 'TabsTrigger';
    window.TabsTrigger = TabsTrigger;
    
    const TabsContent = React.forwardRef(({ className, value: contentValue, ...props }, ref) => {
      const { value } = React.useContext(TabsContext);
      
      if (value !== contentValue) return null;
      
      return React.createElement('div', {
        ref,
        className: cn(
          'mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 dark:ring-offset-neutral-950 dark:focus-visible:ring-neutral-300',
          className
        ),
        ...props
      });
    });
    TabsContent.displayName = 'TabsContent';
    window.TabsContent = TabsContent;
    
    // ----------------------------------------------------------------------------
    // TOOLTIP COMPONENTS (simplified)
    // ----------------------------------------------------------------------------
    const TooltipProvider = ({ children }) => children;
    window.TooltipProvider = TooltipProvider;
    
    const Tooltip = ({ children }) => children;
    window.Tooltip = Tooltip;
    
    const TooltipTrigger = React.forwardRef(({ children, asChild, ...props }, ref) => {
      return React.createElement('span', { ref, ...props }, children);
    });
    TooltipTrigger.displayName = 'TooltipTrigger';
    window.TooltipTrigger = TooltipTrigger;
    
    const TooltipContent = React.forwardRef(({ className, sideOffset = 4, ...props }, ref) => {
      // Simplified: just render nothing or a span (real implementation needs positioning)
      return null;
    });
    TooltipContent.displayName = 'TooltipContent';
    window.TooltipContent = TooltipContent;
    
    // ----------------------------------------------------------------------------
    // SCROLL AREA (simplified)
    // ----------------------------------------------------------------------------
    const ScrollArea = React.forwardRef(({ className, children, ...props }, ref) => {
      return React.createElement('div', {
        ref,
        className: cn('relative overflow-auto', className),
        ...props
      }, children);
    });
    ScrollArea.displayName = 'ScrollArea';
    window.ScrollArea = ScrollArea;
    
    // ----------------------------------------------------------------------------
    // SELECT COMPONENTS (simplified)
    // ----------------------------------------------------------------------------
    const SelectContext = React.createContext({ value: '', onValueChange: () => {}, open: false, setOpen: () => {} });
    
    const Select = ({ children, value, onValueChange, defaultValue }) => {
      const [internalValue, setInternalValue] = React.useState(defaultValue || '');
      const [open, setOpen] = React.useState(false);
      const currentValue = value !== undefined ? value : internalValue;
      
      const handleValueChange = (newValue) => {
        if (value === undefined) {
          setInternalValue(newValue);
        }
        onValueChange && onValueChange(newValue);
        setOpen(false);
      };
      
      return React.createElement(SelectContext.Provider, {
        value: { value: currentValue, onValueChange: handleValueChange, open, setOpen }
      }, React.createElement('div', { className: 'relative inline-block' }, children));
    };
    window.Select = Select;
    
    const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
      const { setOpen, open } = React.useContext(SelectContext);
      
      return React.createElement('button', {
        ref,
        type: 'button',
        onClick: () => setOpen(!open),
        className: cn(
          'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-neutral-200 bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:ring-offset-neutral-950 dark:placeholder:text-neutral-400 dark:focus:ring-neutral-300 [&>span]:line-clamp-1',
          className
        ),
        ...props
      }, children,
        React.createElement('svg', {
          width: 16,
          height: 16,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          className: 'h-4 w-4 opacity-50'
        }, React.createElement('path', { d: 'M6 9l6 6 6-6' }))
      );
    });
    SelectTrigger.displayName = 'SelectTrigger';
    window.SelectTrigger = SelectTrigger;
    
    const SelectValue = ({ placeholder }) => {
      const { value } = React.useContext(SelectContext);
      return React.createElement('span', {}, value || placeholder);
    };
    window.SelectValue = SelectValue;
    
    const SelectContent = React.forwardRef(({ className, children, ...props }, ref) => {
      const { open } = React.useContext(SelectContext);
      
      if (!open) return null;
      
      return React.createElement('div', {
        ref,
        className: cn(
          'absolute z-50 mt-1 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-white text-neutral-950 shadow-md dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50',
          className
        ),
        ...props
      }, React.createElement('div', { className: 'p-1' }, children));
    });
    SelectContent.displayName = 'SelectContent';
    window.SelectContent = SelectContent;
    
    const SelectItem = React.forwardRef(({ className, children, value: itemValue, ...props }, ref) => {
      const { value, onValueChange } = React.useContext(SelectContext);
      const isSelected = value === itemValue;
      
      return React.createElement('div', {
        ref,
        onClick: () => onValueChange(itemValue),
        className: cn(
          'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-neutral-100 focus:bg-neutral-100 dark:hover:bg-neutral-800 dark:focus:bg-neutral-800',
          isSelected && 'bg-neutral-100 dark:bg-neutral-800',
          className
        ),
        ...props
      }, children,
        isSelected && React.createElement('span', {
          className: 'absolute right-2 flex h-3.5 w-3.5 items-center justify-center'
        }, React.createElement('svg', {
          width: 12,
          height: 12,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 3
        }, React.createElement('polyline', { points: '20 6 9 17 4 12' })))
      );
    });
    SelectItem.displayName = 'SelectItem';
    window.SelectItem = SelectItem;
    
    console.log('shadcn/ui components loaded successfully');
  `)
  }
  
  // ============================================================================
  // RECHARTS
  // ============================================================================
  setup.push(`
    // Recharts setup
    const Recharts = window.Recharts || {};
    const rechartsComponents = [
      'LineChart', 'Line', 'BarChart', 'Bar', 'PieChart', 'Pie', 'Cell',
      'AreaChart', 'Area', 'XAxis', 'YAxis', 'CartesianGrid', 'Tooltip',
      'Legend', 'ResponsiveContainer', 'ComposedChart', 'Scatter', 'ScatterChart',
      'RadarChart', 'Radar', 'PolarGrid', 'PolarAngleAxis', 'PolarRadiusAxis',
      'RadialBarChart', 'RadialBar', 'Treemap', 'Sankey', 'FunnelChart', 'Funnel',
      'Brush', 'ReferenceLine', 'ReferenceArea', 'ReferenceDot', 'ErrorBar',
      'LabelList', 'Label', 'Text'
    ];
    rechartsComponents.forEach(name => {
      if (!window[name] && Recharts[name]) {
        window[name] = Recharts[name];
      }
    });
  `)
  
  // ============================================================================
  // FRAMER MOTION
  // ============================================================================
  setup.push(`
    // Framer Motion setup
    const FramerMotion = window.Motion || {};
    if (FramerMotion.motion) {
      window.motion = FramerMotion.motion;
      window.AnimatePresence = FramerMotion.AnimatePresence;
      window.useAnimation = FramerMotion.useAnimation;
      window.useMotionValue = FramerMotion.useMotionValue;
      window.useSpring = FramerMotion.useSpring;
      window.useTransform = FramerMotion.useTransform;
    } else {
      // Fallback: crear motion como componente normal sin animación
      const createMotionComponent = (tag) => {
        return React.forwardRef((props, ref) => {
          const { 
            initial, animate, exit, whileHover, whileTap, whileFocus, whileInView,
            transition, variants, drag, dragConstraints, onDragStart, onDragEnd,
            layout, layoutId,
            ...rest 
          } = props;
          return React.createElement(tag, { ref, ...rest });
        });
      };
      
      const motionProxy = new Proxy({}, {
        get: (target, prop) => {
          if (typeof prop === 'string') {
            return createMotionComponent(prop);
          }
          return undefined;
        }
      });
      
      window.motion = motionProxy;
      window.AnimatePresence = ({ children, mode, initial }) => children;
      window.useAnimation = () => ({ start: () => Promise.resolve(), stop: () => {} });
      window.useMotionValue = (initial) => ({ get: () => initial, set: () => {} });
      window.useSpring = (value) => value;
      window.useTransform = (value, input, output) => value;
    }
  `)
  
  // ============================================================================
  // OTHER UTILITIES
  // ============================================================================
  setup.push(`
    // Lodash setup
    if (window._) {
      window.lodash = window._;
    }
    
    // date-fns setup
    if (window.dateFns) {
      window.format = window.dateFns.format;
      window.parseISO = window.dateFns.parseISO;
      window.addDays = window.dateFns.addDays;
      window.subDays = window.dateFns.subDays;
      window.addMonths = window.dateFns.addMonths;
      window.subMonths = window.dateFns.subMonths;
      window.differenceInDays = window.dateFns.differenceInDays;
      window.isValid = window.dateFns.isValid;
      window.formatDistance = window.dateFns.formatDistance;
      window.formatRelative = window.dateFns.formatRelative;
    }
    
    // UUID setup  
    if (window.uuid) {
      window.v4 = window.uuid.v4;
      window.uuidv4 = window.uuid.v4;
    } else {
      window.v4 = window.uuidv4 = () => 
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }
    
    // cn utility (shadcn pattern)
    if (!window.cn) {
      window.cn = (...classes) => classes.filter(Boolean).join(' ');
    }
    window.clsx = window.cn;
    window.classNames = window.cn;
    
    // twMerge simple implementation
    window.twMerge = (...classes) => classes.filter(Boolean).join(' ');
  `)
  
  return setup.join('\n')
}

function generatePlainHTML(code: string): string {
  // Si ya es HTML completo
  if (/^<!doctype/i.test(code) || /^<html/i.test(code)) {
    let html = code
    
    // Inyectar Tailwind si no está presente
    if (!html.includes('tailwindcss') && !html.includes('tailwind.')) {
      html = html.replace(/<head>/i, `<head>\n    <script src="https://cdn.tailwindcss.com"><\/script>`)
    }
    
    // Inyectar fuentes si no están presentes
    if (!html.includes('fonts.googleapis.com')) {
      html = html.replace(/<head>/i, `<head>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">`)
    }
    
    return html
  }

  // Fragmento HTML
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; min-height: 100vh; }
  </style>
</head>
<body>
  ${code}
</body>
</html>`
}

function generateSVGHTML(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
    }
    svg {
      max-width: 100%;
      max-height: 100vh;
    }
  </style>
</head>
<body>
  ${code}
</body>
</html>`
}

function generateMarkdownHTML(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
    .prose h1 { font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
    .prose h2 { font-size: 1.5rem; font-weight: 600; margin: 1.5rem 0 0.75rem; }
    .prose h3 { font-size: 1.25rem; font-weight: 600; margin: 1.25rem 0 0.5rem; }
    .prose p { margin-bottom: 1rem; line-height: 1.7; }
    .prose ul, .prose ol { margin: 1rem 0; padding-left: 1.5rem; }
    .prose li { margin-bottom: 0.5rem; }
    .prose code { background: #f3f4f6; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.9em; }
    .prose pre { background: #1f2937; color: #f9fafb; padding: 1rem; border-radius: 8px; overflow-x: auto; margin: 1rem 0; }
    .prose pre code { background: none; padding: 0; }
    .prose blockquote { border-left: 4px solid #e5e7eb; padding-left: 1rem; margin: 1rem 0; color: #6b7280; }
    .prose a { color: #2563eb; text-decoration: underline; }
    .prose img { max-width: 100%; border-radius: 8px; margin: 1rem 0; }
  </style>
</head>
<body>
  <div id="content" class="prose"></div>
  <script>
    const markdown = ${JSON.stringify(code)};
    document.getElementById('content').innerHTML = marked.parse(markdown);
  </script>
</body>
</html>`
}

function generateErrorHTML(message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #fef2f2;
    }
    .error {
      padding: 24px;
      background: white;
      border-radius: 8px;
      border: 1px solid #fecaca;
      max-width: 500px;
      text-align: center;
    }
    .error h2 {
      color: #dc2626;
      margin: 0 0 12px;
    }
    .error p {
      color: #7f1d1d;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="error">
    <h2>⚠️ Error</h2>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`
}

// ============================================================================
// UTILIDADES
// ============================================================================

function safeBase64Encode(str: string): string {
  try {
    // Usar TextEncoder para manejar Unicode correctamente
    const bytes = new TextEncoder().encode(str)
    const binString = Array.from(bytes, (x) => String.fromCodePoint(x)).join('')
    return btoa(binString)
  } catch {
    // Fallback al método anterior
    return btoa(unescape(encodeURIComponent(str)))
  }
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}