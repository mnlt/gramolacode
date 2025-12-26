import React, { useMemo, useEffect, useRef, useCallback } from 'react'
import {
  SandpackProvider,
  SandpackPreview,
} from '@codesandbox/sandpack-react'

interface ArtifactRendererProps {
  code: string
  onHeightChange?: (height: number) => void
}

// ============================================================================
// TIPO DE CÓDIGO
// ============================================================================

type CodeType = 'html' | 'react' | 'markdown'

function detectCodeType(code: string): CodeType {
  const trimmed = code.trim()
  
  // HTML completo (DOCTYPE o <html>)
  if (/^<!doctype\s+html/i.test(trimmed) || /^<html/i.test(trimmed)) {
    return 'html'
  }
  
  // HTML parcial (tags minúsculas, sin imports/exports de JS)
  if (/^<[a-z]/i.test(trimmed) && !/<[A-Z]/.test(trimmed) && !/import\s/.test(trimmed) && !/export\s/.test(trimmed)) {
    return 'html'
  }
  
  // Markdown
  const firstLine = trimmed.split('\n')[0]
  if (/^#{1,6}\s/.test(trimmed) || /^\s*[-*+]\s[^\s]/.test(trimmed) || /^```/m.test(trimmed) || /^---\s*$/.test(firstLine)) {
    return 'markdown'
  }
  
  // Todo lo demás es React/JSX
  return 'react'
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function ArtifactRenderer({ code, onHeightChange }: ArtifactRendererProps) {
  const codeType = useMemo(() => detectCodeType(code.trim()), [code])
  
  if (codeType === 'html' || codeType === 'markdown') {
    return <HtmlRenderer code={code} onHeightChange={onHeightChange} codeType={codeType} />
  }
  
  return <ReactRenderer code={code} onHeightChange={onHeightChange} />
}

// ============================================================================
// HTML/MARKDOWN RENDERER (iframe directo - control total)
// ============================================================================

function HtmlRenderer({ code, codeType, onHeightChange }: { 
  code: string
  codeType: 'html' | 'markdown'
  onHeightChange?: (height: number) => void 
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  
  const htmlContent = useMemo(() => {
    const trimmed = code.trim()
    
    if (codeType === 'markdown') {
      return generateMarkdownHtml(trimmed)
    }
    
    // HTML completo
    if (/^<!doctype\s+html/i.test(trimmed) || /^<html/i.test(trimmed)) {
      return injectHeightReporter(trimmed)
    }
    
    // HTML parcial
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>html,body{margin:0;padding:0;overflow:hidden !important}body{font-family:system-ui,-apple-system,sans-serif}</style>
</head><body>${trimmed}</body></html>`
  }, [code, codeType])

  const measureAndExpand = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (!doc?.body) return

      // Forzar reflow
      doc.body.style.overflow = 'hidden'
      doc.documentElement.style.overflow = 'hidden'

      const height = Math.max(
        doc.body.scrollHeight,
        doc.body.offsetHeight,
        doc.documentElement?.scrollHeight || 0,
        doc.documentElement?.offsetHeight || 0,
        400
      )

      iframe.style.height = `${height}px`
      onHeightChange?.(height)
    } catch (e) {
      console.error('Error measuring iframe:', e)
      onHeightChange?.(600)
    }
  }, [onHeightChange])

  // Medir cuando carga y periódicamente (para imágenes, etc)
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const handleLoad = () => {
      measureAndExpand()
      // Re-medir varias veces para contenido dinámico
      setTimeout(measureAndExpand, 100)
      setTimeout(measureAndExpand, 300)
      setTimeout(measureAndExpand, 600)
      setTimeout(measureAndExpand, 1200)
      setTimeout(measureAndExpand, 2500)
    }

    iframe.addEventListener('load', handleLoad)
    return () => iframe.removeEventListener('load', handleLoad)
  }, [measureAndExpand])

  // Escuchar mensajes del iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'height-report' && typeof e.data.height === 'number') {
        const iframe = iframeRef.current
        if (iframe) {
          iframe.style.height = `${e.data.height}px`
          onHeightChange?.(e.data.height)
        }
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onHeightChange])

  return (
    <iframe
      ref={iframeRef}
      srcDoc={htmlContent}
      style={{
        width: '100%',
        minHeight: '400px',
        border: 'none',
        display: 'block',
      }}
      sandbox="allow-scripts allow-same-origin"
      title="HTML Preview"
    />
  )
}

// ============================================================================
// REACT RENDERER (Sandpack)
// ============================================================================

function ReactRenderer({ code, onHeightChange }: { 
  code: string
  onHeightChange?: (height: number) => void 
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  const sandpackConfig = useMemo(() => {
    const trimmedCode = code.trim()
    if (!trimmedCode) return null

    const fixedCode = fixBrokenTemplateLiterals(trimmedCode)
    const analysis = analyzeCode(fixedCode)
    const files = buildFiles(fixedCode, analysis)
    const dependencies = buildDependencies(analysis)

    return { files, dependencies }
  }, [code])

  // Intentar expandir Sandpack después de que cargue
  const attemptExpansion = useCallback(() => {
    if (!containerRef.current) return

    const iframe = containerRef.current.querySelector('iframe') as HTMLIFrameElement
    if (!iframe) return

    let height = 600 // altura por defecto para React

    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (doc?.body) {
        height = Math.max(
          doc.body.scrollHeight,
          doc.body.offsetHeight,
          doc.documentElement?.scrollHeight || 0,
          doc.documentElement?.offsetHeight || 0,
          600
        )
      }
    } catch {
      // CORS - usar altura por defecto
    }

    // Aplicar altura al iframe y contenedores
    iframe.style.setProperty('height', `${height}px`, 'important')
    iframe.style.setProperty('min-height', `${height}px`, 'important')

    // Intentar expandir contenedores padre de Sandpack
    let el = iframe.parentElement
    while (el && el !== containerRef.current) {
      el.style.setProperty('height', 'auto', 'important')
      el.style.setProperty('min-height', `${height}px`, 'important')
      el.style.setProperty('max-height', 'none', 'important')
      el = el.parentElement
    }

    onHeightChange?.(height)
  }, [onHeightChange])

  // Intentar expandir periódicamente
  useEffect(() => {
    const timers = [
      setTimeout(attemptExpansion, 500),
      setTimeout(attemptExpansion, 1000),
      setTimeout(attemptExpansion, 2000),
      setTimeout(attemptExpansion, 4000),
    ]
    return () => timers.forEach(clearTimeout)
  }, [attemptExpansion])

  if (!sandpackConfig) {
    return <div style={styles.error}>No code provided</div>
  }

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%',
        minHeight: '600px',
      }}
    >
      <SandpackProvider
        template="react-ts"
        files={sandpackConfig.files}
        customSetup={{ dependencies: sandpackConfig.dependencies }}
        options={{ 
          externalResources: ['https://cdn.tailwindcss.com'],
        }}
      >
        <SandpackPreview
          showNavigator={false}
          showRefreshButton={false}
          showOpenInCodeSandbox={false}
          style={{ 
            height: '100%', 
            minHeight: '600px',
          }}
        />
      </SandpackProvider>
    </div>
  )
}

// ============================================================================
// HELPERS HTML
// ============================================================================

function injectHeightReporter(html: string): string {
  const script = `
<style>html,body{overflow:hidden !important}</style>
<script>
function reportHeight() {
  const h = Math.max(document.body.scrollHeight, document.body.offsetHeight, 
    document.documentElement.scrollHeight, document.documentElement.offsetHeight);
  window.parent.postMessage({ type: 'height-report', height: h }, '*');
}
window.addEventListener('load', function() {
  reportHeight();
  setTimeout(reportHeight, 500);
  setTimeout(reportHeight, 1500);
  // Observer para cambios
  new MutationObserver(reportHeight).observe(document.body, {childList:true, subtree:true});
  // Para imágenes
  document.querySelectorAll('img').forEach(function(img) {
    img.addEventListener('load', reportHeight);
  });
});
</script>`

  if (html.includes('</head>')) {
    return html.replace('</head>', script + '</head>')
  } else if (html.includes('<body')) {
    return html.replace(/<body([^>]*)>/, '<body$1>' + script)
  }
  return script + html
}

function generateMarkdownHtml(markdown: string): string {
  let html = markdown
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^\s*[-*+]\s+(.*)$/gim, '<li>$1</li>')
    .replace(/\n/gim, '<br>')

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
html,body{overflow:hidden !important;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;padding:24px;line-height:1.6;color:#1a1a1a;max-width:800px}
h1,h2,h3{margin:1em 0 0.5em;line-height:1.3}
li{margin:0.25em 0}
</style>
</head><body>${html}</body></html>`
}

// ============================================================================
// HELPERS REACT/SANDPACK
// ============================================================================

function fixBrokenTemplateLiterals(code: string): string {
  let fixed = code
  fixed = fixed.replace(/return\s*['"]([^'"]*\$\{[^'"]*)['"]/g, (_m, c) => 'return `' + c + '`')
  fixed = fixed.replace(/=\s*['"]([^'"]*\$\{[^'"]*)['"]/g, (_m, c) => '= `' + c + '`')
  return fixed
}

interface CodeAnalysis {
  imports: { full: string; source: string; isShadcn: boolean }[]
  shadcnComponents: string[]
  npmPackages: Set<string>
}

function analyzeCode(code: string): CodeAnalysis {
  const imports: CodeAnalysis['imports'] = []
  const shadcnComponents: string[] = []
  const npmPackages = new Set<string>()

  const importRegex = /import\s+(?:(\w+)(?:\s*,\s*)?)?(?:\{([^}]+)\})?\s+from\s+['"]([^'"]+)['"]/g
  let match
  while ((match = importRegex.exec(code)) !== null) {
    const source = match[3]
    const isShadcn = source.startsWith('@/components/ui/')
    imports.push({ full: match[0], source, isShadcn })
    if (isShadcn) {
      shadcnComponents.push(source.replace('@/components/ui/', ''))
    } else if (!source.startsWith('.') && !source.startsWith('@/')) {
      npmPackages.add(source.startsWith('@') ? source.split('/').slice(0, 2).join('/') : source.split('/')[0])
    }
  }

  if (/\buse[A-Z]\w*\b/.test(code)) npmPackages.add('react')

  return { imports, shadcnComponents, npmPackages }
}

function buildFiles(code: string, analysis: CodeAnalysis): Record<string, string> {
  const files: Record<string, string> = {}
  let processedCode = code

  // Procesar shadcn imports
  if (analysis.shadcnComponents.length > 0) {
    analysis.imports.forEach(imp => {
      if (imp.isShadcn) {
        processedCode = processedCode.replace(
          imp.full, 
          imp.full.replace(imp.source, imp.source.replace('@/components/ui/', './components/ui/'))
        )
      }
    })
    analysis.shadcnComponents.forEach(comp => {
      const content = getShadcnComponent(comp)
      if (content) files[`/components/ui/${comp}.jsx`] = content
    })
  }

  // Agregar cn helper si se usa
  if (/\bcn\(/.test(code) || analysis.shadcnComponents.length > 0) {
    files['/lib/utils.js'] = `export function cn(...classes) { return classes.filter(Boolean).join(' '); }`
    if (!/import.*cn.*from/.test(processedCode) && /\bcn\(/.test(processedCode) && !/function\s+cn\s*\(/.test(processedCode)) {
      processedCode = `import { cn } from './lib/utils';\n` + processedCode
    }
  }

  // Agregar helpers comunes si se usan
  if (/\bclamp\(/.test(code) && !/function\s+clamp\s*\(/.test(code)) {
    processedCode = `function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }\n` + processedCode
  }
  
  if (/\bmulberry32\(/.test(code) && !/function\s+mulberry32\s*\(/.test(code)) {
    processedCode = `function mulberry32(seed) { let t = seed >>> 0; return function() { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }\n` + processedCode
  }

  // Asegurar export default
  if (!/export\s+default/.test(processedCode)) {
    const m = processedCode.match(/(?:function|const)\s+([A-Z]\w*)\s*(?:=|\()/)
    if (m) processedCode += `\n\nexport default ${m[1]};`
  }

  files['/App.tsx'] = processedCode
  return files
}

function buildDependencies(analysis: CodeAnalysis): Record<string, string> {
  const deps: Record<string, string> = {}
  analysis.npmPackages.forEach(pkg => {
    if (pkg !== 'react' && pkg !== 'react-dom') {
      deps[pkg] = 'latest'
    }
  })
  return deps
}

function getShadcnComponent(name: string): string | null {
  const components: Record<string, string> = {
    'button': `import React from 'react';\nimport { cn } from '../../lib/utils';\nconst variants = { default: "bg-neutral-900 text-neutral-50 hover:bg-neutral-900/90", destructive: "bg-red-500 text-neutral-50 hover:bg-red-500/90", outline: "border border-neutral-200 bg-white hover:bg-neutral-100", secondary: "bg-neutral-100 text-neutral-900 hover:bg-neutral-100/80", ghost: "hover:bg-neutral-100", link: "text-neutral-900 underline-offset-4 hover:underline" };\nconst sizes = { default: "h-10 px-4 py-2", sm: "h-9 px-3", lg: "h-11 px-8", icon: "h-10 w-10" };\nexport const Button = React.forwardRef(({ className, variant = "default", size = "default", ...props }, ref) => (<button ref={ref} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50", variants[variant], sizes[size], className)} {...props} />));`,
    'card': `import React from 'react';\nimport { cn } from '../../lib/utils';\nexport const Card = React.forwardRef(({ className, ...props }, ref) => (<div ref={ref} className={cn("rounded-lg border bg-white text-neutral-950 shadow-sm", className)} {...props} />));\nexport const CardHeader = React.forwardRef(({ className, ...props }, ref) => (<div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />));\nexport const CardTitle = React.forwardRef(({ className, ...props }, ref) => (<h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />));\nexport const CardDescription = React.forwardRef(({ className, ...props }, ref) => (<p ref={ref} className={cn("text-sm text-neutral-500", className)} {...props} />));\nexport const CardContent = React.forwardRef(({ className, ...props }, ref) => (<div ref={ref} className={cn("p-6 pt-0", className)} {...props} />));\nexport const CardFooter = React.forwardRef(({ className, ...props }, ref) => (<div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />));`,
    'input': `import React from 'react';\nimport { cn } from '../../lib/utils';\nexport const Input = React.forwardRef(({ className, type, ...props }, ref) => (<input type={type} className={cn("flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50", className)} ref={ref} {...props} />));`,
    'badge': `import React from 'react';\nimport { cn } from '../../lib/utils';\nconst variants = { default: "bg-neutral-900 text-neutral-50", secondary: "bg-neutral-100 text-neutral-900", destructive: "bg-red-500 text-neutral-50", outline: "text-neutral-950 border border-neutral-200" };\nexport const Badge = ({ className, variant = "default", ...props }) => (<div className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors", variants[variant], className)} {...props} />);`,
  }
  return components[name] || null
}

const styles: Record<string, React.CSSProperties> = {
  error: {
    padding: '24px',
    color: '#dc2626',
    textAlign: 'center',
  },
}