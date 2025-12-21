import { useMemo, useState, useEffect } from 'react'

interface ArtifactRendererProps {
  code: string
}

export default function ArtifactRenderer({ code }: ArtifactRendererProps) {
  const [error, setError] = useState<string | null>(null)

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
  if (/\b(ChevronRight|ChevronLeft|ChevronDown|ChevronUp|Menu|X|Search|User|Settings|Home|Star|Heart|Check|Plus|Minus|Edit|Trash|Download|Upload|Mail|Phone|Calendar|Clock|MapPin|Globe|Lock|Unlock|Eye|EyeOff|Bell|AlertCircle|Info|HelpCircle|ArrowRight|ArrowLeft|ArrowUp|ArrowDown|ExternalLink|Copy|Share|Filter|Grid|List|MoreHorizontal|MoreVertical|Loader|RefreshCw|Save|Send|Image|File|Folder|Video|Music|Camera|Mic|Volume|Play|Pause|SkipForward|SkipBack|Maximize|Minimize|Sun|Moon|Cloud|Zap|Award|Gift|ShoppingCart|ShoppingBag|CreditCard|DollarSign|TrendingUp|TrendingDown|Activity|PieChart|BarChart2|LineChart|Brain|Network|MessageSquare|Shield|Sparkles)\b/.test(code)) {
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
  
  // Lucide React - CORREGIDO: Ahora sí carga desde CDN
  if (libraries.has('lucide-react')) {
    scripts.push('<script src="https://unpkg.com/lucide@0.263.1/dist/umd/lucide.js"></script>')
  }
  
  return scripts.join('\n  ')
}

function generateLibrarySetup(libraries: Set<string>): string {
  const setup: string[] = []
  
  // Lucide icons - CORREGIDO: Crear wrappers de React para los iconos de Lucide
  if (libraries.has('lucide-react')) {
    setup.push(`
    // Lucide React icons setup - FIXED VERSION
    const createLucideIcon = (iconName) => {
      return (props = {}) => {
        const { size = 24, color, strokeWidth = 2, className, ...rest } = props;
        
        // Crear elemento SVG usando lucide.createElement
        if (window.lucide && window.lucide.createElement) {
          const svgElement = window.lucide.createElement(iconName);
          if (svgElement) {
            // Clonar y aplicar props
            const clonedSvg = svgElement.cloneNode(true);
            clonedSvg.setAttribute('width', size);
            clonedSvg.setAttribute('height', size);
            if (color) clonedSvg.setAttribute('stroke', color);
            if (strokeWidth) clonedSvg.setAttribute('stroke-width', strokeWidth);
            if (className) clonedSvg.setAttribute('class', className);
            
            // Convertir a React element
            return React.createElement('span', {
              dangerouslySetInnerHTML: { __html: clonedSvg.outerHTML },
              style: { display: 'inline-flex', ...rest.style }
            });
          }
        }
        
        // Fallback: cuadrado simple
        return React.createElement('span', {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: size,
            height: size,
            fontSize: '10px',
            color: color || '#888',
            ...rest.style
          },
          className
        }, '□');
      };
    };
    
    // Lista de iconos usados comúnmente
    const iconNames = [
      'Brain', 'Zap', 'Network', 'MessageSquare', 'TrendingUp', 'Shield', 'Sparkles',
      'ChevronRight', 'ChevronLeft', 'ChevronDown', 'ChevronUp',
      'Menu', 'X', 'Search', 'User', 'Settings', 'Home',
      'Star', 'Heart', 'Check', 'Plus', 'Minus', 'Edit', 'Trash',
      'Download', 'Upload', 'Mail', 'Phone', 'Calendar', 'Clock',
      'MapPin', 'Globe', 'Lock', 'Unlock', 'Eye', 'EyeOff',
      'Bell', 'AlertCircle', 'Info', 'HelpCircle',
      'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown',
      'ExternalLink', 'Copy', 'Share', 'Filter', 'Grid', 'List',
      'MoreHorizontal', 'MoreVertical', 'Loader', 'RefreshCw',
      'Save', 'Send', 'Image', 'File', 'Folder', 'Video', 'Music',
      'Camera', 'Mic', 'Volume', 'Play', 'Pause', 'SkipForward', 'SkipBack',
      'Maximize', 'Minimize', 'Sun', 'Moon', 'Cloud',
      'Award', 'Gift', 'ShoppingCart', 'ShoppingBag', 'CreditCard', 'DollarSign',
      'Activity', 'PieChart', 'BarChart2', 'LineChart',
      'Circle', 'Square', 'Triangle', 'Hexagon', 'Bookmark', 'Flag',
      'MessageCircle', 'ThumbsUp', 'ThumbsDown',
      'Smile', 'Frown', 'Meh', 'AlertTriangle', 'CheckCircle', 'XCircle'
    ];
    
    // Crear componentes React para cada icono
    iconNames.forEach(name => {
      // Convertir de PascalCase a kebab-case para lucide
      const kebabName = name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      window[name] = createLucideIcon(kebabName);
    });
  `)
  }
  
  // Recharts
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
  
  // Framer Motion
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
      window.motion = new Proxy({}, {
        get: (target, prop) => {
          return (props) => React.createElement(prop, {
            ...props,
            initial: undefined,
            animate: undefined,
            exit: undefined,
            whileHover: undefined,
            whileTap: undefined,
            transition: undefined
          });
        }
      });
      window.AnimatePresence = ({ children }) => children;
    }
  `)
  
  // Lodash
  setup.push(`
    // Lodash setup
    if (window._) {
      window.lodash = window._;
    }
  `)
  
  // date-fns
  setup.push(`
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
  `)
  
  // UUID
  setup.push(`
    // UUID setup  
    if (window.uuid) {
      window.v4 = window.uuid.v4;
      window.uuidv4 = window.uuid.v4;
    } else {
      // Fallback simple
      window.v4 = window.uuidv4 = () => 
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }
  `)
  
  // cn utility (shadcn pattern)
  setup.push(`
    // cn utility for className merging (common in shadcn/ui)
    window.cn = (...classes) => classes.filter(Boolean).join(' ');
    window.clsx = window.cn;
    window.classNames = window.cn;
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