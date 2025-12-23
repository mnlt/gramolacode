import React, { useMemo } from 'react'
import {
  SandpackProvider,
  SandpackPreview,
} from '@codesandbox/sandpack-react'

interface ArtifactRendererProps {
  code: string
}

// ============================================================================
// FIX DE TEMPLATE LITERALS ROTOS - VERSIÓN COMPLETA
// ============================================================================

/**
 * Encuentra el índice del } que cierra el { en startIdx
 */
function findMatchingBrace(code: string, startIdx: number): number {
  let depth = 0
  let inString = false
  let stringChar = ''
  
  for (let i = startIdx; i < code.length; i++) {
    const ch = code[i]
    const prev = i > 0 ? code[i - 1] : ''
    
    // Detectar inicio/fin de strings
    if ((ch === '"' || ch === "'" || ch === '`') && prev !== '\\') {
      if (!inString) {
        inString = true
        stringChar = ch
      } else if (ch === stringChar) {
        inString = false
        stringChar = ''
      }
      continue
    }
    
    if (inString) continue
    
    if (ch === '{') {
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0) {
        return i
      }
    }
  }
  
  return -1
}

/**
 * Arregla className={...} que contienen ${} sin backticks
 */
function fixClassNameAttributes(code: string): string {
  let result = ''
  let i = 0
  const pattern = 'className={'
  
  while (i < code.length) {
    const idx = code.indexOf(pattern, i)
    if (idx === -1) {
      result += code.slice(i)
      break
    }
    
    // Copiar todo hasta className={
    result += code.slice(i, idx + pattern.length)
    i = idx + pattern.length
    
    // Encontrar el } que cierra
    const closeIdx = findMatchingBrace(code, idx + pattern.length - 1)
    if (closeIdx === -1) {
      result += code.slice(i)
      break
    }
    
    const content = code.slice(i, closeIdx)
    const trimmed = content.trim()
    
    // Ya tiene backticks - no tocar
    const hasBackticks = trimmed.startsWith('`') && trimmed.endsWith('`')
    if (hasBackticks) {
      result += content
      i = closeIdx
      continue
    }
    
    // Es una llamada a función como cn(...) - no tocar
    if (/^\s*\w+\s*\(/.test(trimmed) && trimmed.endsWith(')')) {
      result += content
      i = closeIdx
      continue
    }
    
    // Es solo una variable - no tocar
    const hasInterpolation = trimmed.includes('${')
    if (!hasInterpolation && /^[a-zA-Z_]\w*$/.test(trimmed)) {
      result += content
      i = closeIdx
      continue
    }
    
    // Es un ternario sin interpolación - no tocar
    if (!hasInterpolation && trimmed.includes('?') && trimmed.includes(':')) {
      result += content
      i = closeIdx
      continue
    }
    
    // Tiene interpolación sin backticks - arreglar
    if (hasInterpolation) {
      result += '`' + content + '`'
    } else {
      result += content
    }
    
    i = closeIdx
  }
  
  return result || code
}

/**
 * Arregla return ${...}; sin backticks
 */
function fixReturnStatements(code: string): string {
  const lines = code.split('\n')
  const fixedLines = lines.map((line) => {
    let fixedLine = line
    let searchStart = 0
    
    while (true) {
      const returnMatch = fixedLine.slice(searchStart).match(/\breturn\s+/)
      if (!returnMatch) break
      
      const returnIdx = searchStart + returnMatch.index!
      const contentStart = returnIdx + returnMatch[0].length
      
      const afterReturn = fixedLine.slice(contentStart).trim()
      
      // Si empieza con ( o < es JSX/expresión - no tocar
      if (afterReturn.startsWith('(') || afterReturn.startsWith('<')) {
        searchStart = contentStart
        continue
      }
      
      // Si no tiene interpolación - no tocar
      if (!afterReturn.includes('${')) {
        searchStart = contentStart
        continue
      }
      
      // Buscar el ; en la misma línea
      let semicolonIdx = -1
      let depth = 0
      let inStr = false
      let strChar = ''
      
      for (let i = contentStart; i < fixedLine.length; i++) {
        const ch = fixedLine[i]
        const prev = i > 0 ? fixedLine[i-1] : ''
        
        if ((ch === '"' || ch === "'" || ch === '`') && prev !== '\\') {
          if (!inStr) { inStr = true; strChar = ch }
          else if (ch === strChar) { inStr = false }
          continue
        }
        if (inStr) continue
        
        if (ch === '(' || ch === '{' || ch === '[') depth++
        else if (ch === ')' || ch === '}' || ch === ']') depth--
        else if (ch === ';' && depth === 0) {
          semicolonIdx = i
          break
        }
      }
      
      if (semicolonIdx === -1) {
        searchStart = contentStart
        continue
      }
      
      const content = fixedLine.slice(contentStart, semicolonIdx)
      const trimmedContent = content.trim()
      
      // Ya tiene backticks - no tocar
      if (trimmedContent.startsWith('`') && trimmedContent.endsWith('`')) {
        searchStart = semicolonIdx
        continue
      }
      
      // Si ya tiene backticks en algún lugar, no tocar
      if (content.includes('`')) {
        searchStart = semicolonIdx
        continue
      }
      
      // Tiene ${} sin backticks - arreglar
      if (content.includes('${')) {
        const before = fixedLine.slice(0, contentStart)
        const after = fixedLine.slice(semicolonIdx)
        fixedLine = before + '`' + content + '`' + after
        searchStart = contentStart + content.length + 2
      } else {
        searchStart = semicolonIdx
      }
    }
    
    return fixedLine
  })
  
  return fixedLines.join('\n')
}

/**
 * Arregla asignaciones como: label = ${mins}m;
 */
function fixAssignments(code: string): string {
  const lines = code.split('\n')
  const fixedLines = lines.map((line) => {
    let fixedLine = line
    const assignPattern = /\b(let|const|var)\s+(\w+)\s*=\s*|\b(\w+)\s*=\s*(?!=|>)/g
    let match
    let offset = 0
    
    while ((match = assignPattern.exec(line)) !== null) {
      const fullMatch = match[0]
      const matchStart = match.index
      const contentStart = matchStart + fullMatch.length
      
      // Verificar que no estamos dentro de paréntesis
      const beforeMatch = line.slice(0, matchStart)
      const openParens = (beforeMatch.match(/\(/g) || []).length
      const closeParens = (beforeMatch.match(/\)/g) || []).length
      if (openParens > closeParens) continue
      
      // Verificar que no es == o =>
      const afterEqual = line.slice(contentStart).trim()
      if (afterEqual.startsWith('=') || afterEqual.startsWith('>')) continue
      
      // Buscar el ; que termina la asignación
      let endIdx = -1
      let depth = 0
      let inString = false
      let stringChar = ''
      
      for (let i = contentStart; i < line.length; i++) {
        const ch = line[i]
        const prev = i > 0 ? line[i-1] : ''
        
        if ((ch === '"' || ch === "'" || ch === '`') && prev !== '\\') {
          if (!inString) { inString = true; stringChar = ch }
          else if (ch === stringChar) { inString = false }
          continue
        }
        if (inString) continue
        
        if (ch === '(' || ch === '{' || ch === '[') depth++
        else if (ch === ')' || ch === '}' || ch === ']') depth--
        else if (ch === ';' && depth === 0) {
          endIdx = i
          break
        }
      }
      
      if (endIdx === -1) continue
      
      const content = line.slice(contentStart, endIdx)
      const trimmed = content.trim()
      
      // Si empieza con ( { [ < " ' - no es template literal roto
      if (/^[\(\{\[\<\"\']/.test(trimmed)) continue
      
      // Si no tiene interpolación - no tocar
      if (!content.includes('${')) continue
      
      // Ya tiene backticks - no tocar
      if (trimmed.startsWith('`') && trimmed.endsWith('`')) continue
      
      // Arreglar
      const before = fixedLine.slice(0, contentStart + offset)
      const after = fixedLine.slice(endIdx + offset)
      fixedLine = before + '`' + content + '`' + after
      offset += 2
    }
    
    return fixedLine
  })
  
  return fixedLines.join('\n')
}

/**
 * Función principal que aplica todos los fixes
 */
 function fixBrokenTemplateLiterals(code: string): string {
  const BACKTICK = "`"
  let fixed = code

  // Si ya hay backticks, no tocamos para evitar falsos positivos
  if (fixed.includes(BACKTICK)) return fixed

  // ---------- helpers internos (NO generan TS6133) ----------
  const isQuoted = (s: string) => {
    const t = s.trim()
    return t.startsWith('"') || t.startsWith("'") || t.startsWith("`")
  }

  const looksLikeBrokenTemplate = (expr: string) => {
    const t = expr.trim()
    if (!t) return false
    if (isQuoted(t)) return false

    // Si es algo que claramente no es “texto tailwind”
    if (t.startsWith("(") || t.startsWith("{") || t.startsWith("["))
      return false

    // Señales típicas: ${...} o clases tailwind con espacios/guiones
    if (t.includes("${")) return true
    if (/[a-z0-9]-[a-z0-9]/i.test(t)) return true // bg-zinc-900
    if (/\s/.test(t) && /[a-z]/i.test(t)) return true // px-3 py-2
    return false
  }

  const wrapWithBackticks = (expr: string) => {
    const escaped = expr.replace(/`/g, "\\`")
    return `\`${escaped}\``
  }

  // ---------- 1) arreglar return ...; ----------
  fixed = fixed.replace(/\breturn\s+([^;\n]+);/g, (m, expr) => {
    if (!looksLikeBrokenTemplate(expr)) return m
    return `return ${wrapWithBackticks(expr)};`
  })

  // ---------- 2) arreglar asignaciones simples x = ...; ----------
  fixed = fixed.replace(
    /(^|[;\n]\s*)([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+);/g,
    (m, prefix, name, expr) => {
      if (!looksLikeBrokenTemplate(expr)) return m
      return `${prefix}${name} = ${wrapWithBackticks(expr)};`
    }
  )

  // ---------- 3) arreglar className={...} con escaneo y balanceo de llaves ----------
  const src = fixed
  let out = ""
  let i = 0

  while (i < src.length) {
    const idx = src.indexOf("className={", i)
    if (idx === -1) {
      out += src.slice(i)
      break
    }

    out += src.slice(i, idx)
    let j = idx + "className={".length

    // balanceo de llaves (para sobrevivir a ${ ... } dentro)
    let depth = 1
    let inSingle = false
    let inDouble = false
    let inLineComment = false
    let inBlockComment = false

    while (j < src.length && depth > 0) {
      const ch = src[j]
      const next = src[j + 1]

      // comentarios
      if (!inSingle && !inDouble) {
        if (!inBlockComment && !inLineComment && ch === "/" && next === "/") {
          inLineComment = true
          j += 2
          continue
        }
        if (!inBlockComment && !inLineComment && ch === "/" && next === "*") {
          inBlockComment = true
          j += 2
          continue
        }
        if (inLineComment && ch === "\n") {
          inLineComment = false
          j++
          continue
        }
        if (inBlockComment && ch === "*" && next === "/") {
          inBlockComment = false
          j += 2
          continue
        }
      }
      if (inLineComment || inBlockComment) {
        j++
        continue
      }

      // strings (no hay backticks en este modo)
      if (!inDouble && ch === "'" && src[j - 1] !== "\\") {
        inSingle = !inSingle
        j++
        continue
      }
      if (!inSingle && ch === '"' && src[j - 1] !== "\\") {
        inDouble = !inDouble
        j++
        continue
      }
      if (inSingle || inDouble) {
        j++
        continue
      }

      if (ch === "{") depth++
      else if (ch === "}") depth--

      j++
    }

    const expr = src.slice(idx + "className={".length, j - 1)

    if (looksLikeBrokenTemplate(expr)) {
      out += `className={${wrapWithBackticks(expr)}}`
    } else {
      out += `className={${expr}}`
    }

    i = j
  }

  return out
}


export default function ArtifactRenderer({ code }: ArtifactRendererProps) {
  const sandpackConfig = useMemo(() => {
    const trimmedCode = code.trim()

    if (!trimmedCode) {
      return null
    }

    // Aplicar fix de template literals rotos ANTES de analizar
    const fixedCode = fixBrokenTemplateLiterals(trimmedCode)

    const analysis = analyzeCode(fixedCode)
    const files = buildFiles(fixedCode, analysis)
    const dependencies = buildDependencies(analysis)

    return { files, dependencies }
  }, [code])

  if (!sandpackConfig) {
    return <div style={styles.error}>No code provided</div>
  }

  return (
    <div style={styles.container}>
      <SandpackProvider
        template="react-ts"
        files={sandpackConfig.files}
        customSetup={{
          dependencies: sandpackConfig.dependencies,
        }}
        options={{
          externalResources: [
            'https://cdn.tailwindcss.com',
          ],
        }}
        style={{ height: '100%' }}
      >
        <SandpackPreview
          style={{ height: '100%' }}
          showNavigator={false}
          showRefreshButton={false}
          showOpenInCodeSandbox={false}
        />
      </SandpackProvider>
    </div>
  )
}

// ============================================================================
// ANÁLISIS DE CÓDIGO
// ============================================================================

interface CodeAnalysis {
  imports: ImportInfo[]
  shadcnComponents: string[]
  npmPackages: Set<string>
  isMarkdown: boolean
  isPlainHTML: boolean
  isFullDocument: boolean
}

interface ImportInfo {
  full: string
  source: string
  isShadcn: boolean
}

function analyzeCode(code: string): CodeAnalysis {
  const imports: ImportInfo[] = []
  const shadcnComponents: string[] = []
  const npmPackages = new Set<string>()

  const firstLine = code.split('\n')[0]
  const isMarkdown = /^#{1,6}\s/.test(code) ||
                     /^\s*[-*+]\s[^\s]/.test(code) ||
                     /^\s*\d+\.\s/.test(code) ||
                     /^```/m.test(code) ||
                     /\[.+\]\(.+\)/.test(code) ||
                     /^>\s/.test(code) ||
                     /^---\s*$/.test(firstLine)

  const isPlainHTML = !isMarkdown && (
    /^<!doctype\s+html/i.test(code) ||
    (/^<[a-z]/i.test(code) && !/<[A-Z]/.test(code) && !/import\s/.test(code))
  )

  const isFullDocument = /^<!doctype\s+html/i.test(code) || /^<html/i.test(code)

  if (isMarkdown || isPlainHTML) {
    return { imports, shadcnComponents, npmPackages, isMarkdown, isPlainHTML, isFullDocument }
  }

  // Extraer imports
  const importRegex = /import\s+(?:(\w+)(?:\s*,\s*)?)?(?:\{([^}]+)\})?\s+from\s+['"]([^'"]+)['"]/g
  let importMatch

  while ((importMatch = importRegex.exec(code)) !== null) {
    const namedImports = importMatch[2]
    const source = importMatch[3]

    const isShadcn = source.startsWith('@/components/ui/')

    imports.push({ full: importMatch[0], source, isShadcn })

    if (isShadcn) {
      // Extraer nombre del componente del path
      const componentFile = source.replace('@/components/ui/', '')
      shadcnComponents.push(componentFile)

      // También extraer los nombres importados
      if (namedImports) {
        namedImports.split(',').forEach(c => {
          const name = c.trim().split(/\s+as\s+/)[0].trim()
          if (name && !shadcnComponents.includes(name.toLowerCase())) {
            // No añadir duplicados
          }
        })
      }
    } else if (!source.startsWith('.') && !source.startsWith('@/')) {
      const pkgName = source.startsWith('@')
        ? source.split('/').slice(0, 2).join('/')
        : source.split('/')[0]
      npmPackages.add(pkgName)
    }
  }

  // Detectar uso de hooks sin import explícito
  if (/\buseState\b|\buseEffect\b|\buseRef\b|\buseMemo\b/.test(code)) {
    npmPackages.add('react')
  }

  return { imports, shadcnComponents, npmPackages, isMarkdown: false, isPlainHTML, isFullDocument }
}

// ============================================================================
// CONSTRUCCIÓN DE ARCHIVOS
// ============================================================================

function buildFiles(code: string, analysis: CodeAnalysis): Record<string, string> {
  const files: Record<string, string> = {}

  if (analysis.isMarkdown) {
    files['/App.tsx'] = `
import { marked } from 'marked';

const markdown = ${JSON.stringify(code)};

export default function App() {
  const html = marked.parse(markdown);
  
  return (
    <article 
      className="prose prose-neutral max-w-none p-8"
      dangerouslySetInnerHTML={{ __html: html }} 
    />
  );
}
`
    return files
  }

  if (analysis.isPlainHTML) {
    if (analysis.isFullDocument) {
      files['/App.tsx'] = `
export default function App() {
  return (
    <iframe
      srcDoc={\`${code.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`}
      style={{ width: '100%', height: '100vh', border: 'none' }}
    />
  );
}
`
    } else {
      files['/App.tsx'] = `
export default function App() {
  return (
    <div dangerouslySetInnerHTML={{ __html: \`${code.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\` }} />
  );
}
`
    }
    return files
  }

  let processedCode = code

  // Reemplazar imports de shadcn
  if (analysis.shadcnComponents.length > 0) {
    analysis.imports.forEach(imp => {
      if (imp.isShadcn) {
        const newSource = imp.source.replace('@/components/ui/', './components/ui/')
        processedCode = processedCode.replace(imp.full, imp.full.replace(imp.source, newSource))
      }
    })

    // Generar archivos shadcn
    analysis.shadcnComponents.forEach(comp => {
      const content = getShadcnComponent(comp)
      if (content) {
        files[`/components/ui/${comp}.jsx`] = content
      }
    })
  }

  // Añadir utilidad cn
  if (/\bcn\(/.test(code) || analysis.shadcnComponents.length > 0) {
    files['/lib/utils.js'] = `export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
`
    if (!/import.*cn.*from/.test(processedCode) && /\bcn\(/.test(processedCode) && !/function\s+cn\s*\(/.test(processedCode)) {
      processedCode = `import { cn } from './lib/utils';\n` + processedCode
    }
  }

  // Asegurar export default
  if (!/export\s+default/.test(processedCode)) {
    const componentMatch = processedCode.match(/(?:function|const)\s+([A-Z]\w*)\s*(?:=|\()/)
    if (componentMatch) {
      processedCode += `\nexport default ${componentMatch[1]};`
    }
  }

  files['/App.tsx'] = processedCode

  return files
}

// ============================================================================
// CONSTRUCCIÓN DE DEPENDENCIAS
// ============================================================================

function buildDependencies(analysis: CodeAnalysis): Record<string, string> {
  const deps: Record<string, string> = {
    'react': '^18.2.0',
    'react-dom': '^18.2.0',
  }

  if (analysis.isMarkdown) {
    deps['marked'] = '^12.0.0'
  }

  const versionMap: Record<string, string> = {
    'lucide-react': '^0.263.1',
    'framer-motion': '^11.0.0',
    'recharts': '^2.12.7',
    '@mui/material': '^5.15.0',
    '@mui/icons-material': '^5.15.0',
    '@emotion/react': '^11.11.0',
    '@emotion/styled': '^11.11.0',
    '@chakra-ui/react': '^2.8.0',
    'antd': '^5.12.0',
    'lodash': '^4.17.21',
    'date-fns': '^3.0.0',
    'axios': '^1.6.0',
    'uuid': '^9.0.0',
    'clsx': '^2.1.0',
    'class-variance-authority': '^0.7.0',
    'tailwind-merge': '^2.2.0',
  }

  analysis.npmPackages.forEach(pkg => {
    if (pkg !== 'react' && pkg !== 'react-dom') {
      deps[pkg] = versionMap[pkg] || 'latest'
    }
  })

  // MUI necesita emotion
  if (analysis.npmPackages.has('@mui/material')) {
    deps['@emotion/react'] = versionMap['@emotion/react']
    deps['@emotion/styled'] = versionMap['@emotion/styled']
  }

  return deps
}

// ============================================================================
// COMPONENTES SHADCN
// ============================================================================

function getShadcnComponent(name: string): string | null {
  const components: Record<string, string> = {
    'card': `import React from 'react';
import { cn } from '../../lib/utils';

export const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-xl border bg-white text-neutral-950 shadow", className)} {...props} />
));

export const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
));

export const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn("font-semibold leading-none tracking-tight", className)} {...props} />
));

export const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-neutral-500", className)} {...props} />
));

export const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));

export const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
));
`,

    'button': `import React from 'react';
import { cn } from '../../lib/utils';

const variants = {
  default: "bg-neutral-900 text-neutral-50 shadow hover:bg-neutral-900/90",
  destructive: "bg-red-500 text-neutral-50 shadow-sm hover:bg-red-500/90",
  outline: "border border-neutral-200 bg-white shadow-sm hover:bg-neutral-100",
  secondary: "bg-neutral-100 text-neutral-900 shadow-sm hover:bg-neutral-100/80",
  ghost: "hover:bg-neutral-100 hover:text-neutral-900",
  link: "text-neutral-900 underline-offset-4 hover:underline",
};

const sizes = {
  default: "h-9 px-4 py-2",
  sm: "h-8 rounded-md px-3 text-xs",
  lg: "h-10 rounded-md px-8",
  icon: "h-9 w-9",
};

export const Button = React.forwardRef(({ className, variant = "default", size = "default", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50",
      variants[variant],
      sizes[size],
      className
    )}
    {...props}
  />
));
`,

    'badge': `import React from 'react';
import { cn } from '../../lib/utils';

const variants = {
  default: "border-transparent bg-neutral-900 text-neutral-50 shadow",
  secondary: "border-transparent bg-neutral-100 text-neutral-900",
  destructive: "border-transparent bg-red-500 text-neutral-50 shadow",
  outline: "text-neutral-950",
};

export const Badge = React.forwardRef(({ className, variant = "default", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors",
      variants[variant],
      className
    )}
    {...props}
  />
));
`,

    'input': `import React from 'react';
import { cn } from '../../lib/utils';

export const Input = React.forwardRef(({ className, type = "text", ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "flex h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-950 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
`,

    'textarea': `import React from 'react';
import { cn } from '../../lib/utils';

export const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[60px] w-full rounded-md border border-neutral-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
`,

    'label': `import React from 'react';
import { cn } from '../../lib/utils';

export const Label = React.forwardRef(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}
    {...props}
  />
));
`,

    'switch': `import React from 'react';
import { cn } from '../../lib/utils';

export const Switch = React.forwardRef(({ className, checked, onCheckedChange, ...props }, ref) => (
  <button
    ref={ref}
    role="switch"
    aria-checked={checked}
    onClick={() => onCheckedChange?.(!checked)}
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors",
      checked ? "bg-neutral-900" : "bg-neutral-200",
      className
    )}
    {...props}
  >
    <span className={cn("pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg transition-transform", checked ? "translate-x-4" : "translate-x-0")} />
  </button>
));
`,

    'checkbox': `import React from 'react';
import { cn } from '../../lib/utils';

export const Checkbox = React.forwardRef(({ className, checked, onCheckedChange, ...props }, ref) => (
  <button
    ref={ref}
    role="checkbox"
    aria-checked={checked}
    onClick={() => onCheckedChange?.(!checked)}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-neutral-900 shadow focus-visible:outline-none",
      checked && "bg-neutral-900 text-neutral-50",
      className
    )}
    {...props}
  >
    {checked && (
      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="mx-auto">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )}
  </button>
));
`,

    'separator': `import React from 'react';
import { cn } from '../../lib/utils';

export const Separator = React.forwardRef(({ className, orientation = "horizontal", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "shrink-0 bg-neutral-200",
      orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
      className
    )}
    {...props}
  />
));
`,

    'progress': `import React from 'react';
import { cn } from '../../lib/utils';

export const Progress = React.forwardRef(({ className, value = 0, ...props }, ref) => (
  <div ref={ref} className={cn("relative h-2 w-full overflow-hidden rounded-full bg-neutral-900/20", className)} {...props}>
    <div className="h-full bg-neutral-900 transition-all" style={{ width: \`\${value}%\` }} />
  </div>
));
`,

    'slider': `import React from 'react';
import { cn } from '../../lib/utils';

export const Slider = React.forwardRef(({ className, value = [0], onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => {
  const percentage = ((value[0] - min) / (max - min)) * 100;
  return (
    <div ref={ref} className={cn("relative flex w-full touch-none select-none items-center", className)} {...props}>
      <div className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-neutral-900/20">
        <div className="absolute h-full bg-neutral-900" style={{ width: \`\${percentage}%\` }} />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        onChange={(e) => onValueChange?.([parseFloat(e.target.value)])}
        className="absolute w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
});
`,

    'avatar': `import React from 'react';
import { cn } from '../../lib/utils';

export const Avatar = React.forwardRef(({ className, ...props }, ref) => (
  <span ref={ref} className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)} {...props} />
));

export const AvatarImage = React.forwardRef(({ className, src, alt, ...props }, ref) => {
  const [error, setError] = React.useState(false);
  if (error || !src) return null;
  return <img ref={ref} src={src} alt={alt} onError={() => setError(true)} className={cn("aspect-square h-full w-full", className)} {...props} />;
});

export const AvatarFallback = React.forwardRef(({ className, ...props }, ref) => (
  <span ref={ref} className={cn("flex h-full w-full items-center justify-center rounded-full bg-neutral-100", className)} {...props} />
));
`,

    'alert': `import React from 'react';
import { cn } from '../../lib/utils';

const variants = {
  default: "bg-white text-neutral-950",
  destructive: "border-red-500/50 text-red-500",
};

export const Alert = React.forwardRef(({ className, variant = "default", ...props }, ref) => (
  <div ref={ref} role="alert" className={cn("relative w-full rounded-lg border px-4 py-3 text-sm", variants[variant], className)} {...props} />
));

export const AlertTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h5 ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />
));

export const AlertDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
));
`,

    'accordion': `import React from 'react';
import { cn } from '../../lib/utils';

const AccordionContext = React.createContext({ openItems: [], toggle: () => {} });

export const Accordion = ({ children, type = 'single', collapsible, defaultValue, className }) => {
  const [openItems, setOpenItems] = React.useState(defaultValue ? [defaultValue].flat() : []);
  const toggle = (value) => {
    setOpenItems(prev => {
      if (type === 'single') {
        return prev.includes(value) ? (collapsible ? [] : prev) : [value];
      }
      return prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value];
    });
  };
  return (
    <AccordionContext.Provider value={{ openItems, toggle }}>
      <div className={className}>{children}</div>
    </AccordionContext.Provider>
  );
};

export const AccordionItem = React.forwardRef(({ children, value, className, ...props }, ref) => (
  <div ref={ref} className={cn("border-b", className)} {...props}>
    {React.Children.map(children, child => React.isValidElement(child) ? React.cloneElement(child, { _value: value }) : child)}
  </div>
));

export const AccordionTrigger = React.forwardRef(({ children, className, _value, ...props }, ref) => {
  const { openItems, toggle } = React.useContext(AccordionContext);
  const isOpen = openItems.includes(_value);
  return (
    <button
      ref={ref}
      onClick={() => toggle(_value)}
      className={cn("flex flex-1 w-full items-center justify-between py-4 text-sm font-medium transition-all hover:underline", className)}
      {...props}
    >
      {children}
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}>
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
});

export const AccordionContent = React.forwardRef(({ children, className, _value, ...props }, ref) => {
  const { openItems } = React.useContext(AccordionContext);
  if (!openItems.includes(_value)) return null;
  return <div ref={ref} className={cn("overflow-hidden text-sm pb-4", className)} {...props}>{children}</div>;
});
`,

    'tabs': `import React from 'react';
import { cn } from '../../lib/utils';

const TabsContext = React.createContext({ value: '', setValue: () => {} });

export const Tabs = ({ children, defaultValue, value: controlled, onValueChange, className }) => {
  const [internal, setInternal] = React.useState(defaultValue || '');
  const value = controlled !== undefined ? controlled : internal;
  const setValue = (v) => { controlled === undefined && setInternal(v); onValueChange?.(v); };
  return <TabsContext.Provider value={{ value, setValue }}><div className={className}>{children}</div></TabsContext.Provider>;
};

export const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("inline-flex h-9 items-center justify-center rounded-lg bg-neutral-100 p-1 text-neutral-500", className)} {...props} />
));

export const TabsTrigger = React.forwardRef(({ className, value: v, ...props }, ref) => {
  const { value, setValue } = React.useContext(TabsContext);
  return (
    <button
      ref={ref}
      onClick={() => setValue(v)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all",
        value === v && "bg-white text-neutral-950 shadow",
        className
      )}
      {...props}
    />
  );
});

export const TabsContent = React.forwardRef(({ className, value: v, ...props }, ref) => {
  const { value } = React.useContext(TabsContext);
  if (value !== v) return null;
  return <div ref={ref} className={cn("mt-2", className)} {...props} />;
});
`,

    'select': `import React from 'react';
import { cn } from '../../lib/utils';

const SelectContext = React.createContext({ value: '', setValue: () => {}, open: false, setOpen: () => {} });

export const Select = ({ children, value: controlled, onValueChange, defaultValue }) => {
  const [internal, setInternal] = React.useState(defaultValue || '');
  const [open, setOpen] = React.useState(false);
  const value = controlled !== undefined ? controlled : internal;
  const setValue = (v) => { controlled === undefined && setInternal(v); onValueChange?.(v); setOpen(false); };
  return <SelectContext.Provider value={{ value, setValue, open, setOpen }}><div className="relative inline-block">{children}</div></SelectContext.Provider>;
};

export const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
  const { setOpen, open } = React.useContext(SelectContext);
  return (
    <button
      ref={ref}
      onClick={() => setOpen(!open)}
      className={cn("flex h-9 w-full items-center justify-between rounded-md border border-neutral-200 bg-transparent px-3 py-2 text-sm shadow-sm", className)}
      {...props}
    >
      {children}
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 opacity-50"><path d="M6 9l6 6 6-6" /></svg>
    </button>
  );
});

export const SelectValue = ({ placeholder }) => {
  const { value } = React.useContext(SelectContext);
  return <span>{value || placeholder}</span>;
};

export const SelectContent = React.forwardRef(({ className, children, ...props }, ref) => {
  const { open } = React.useContext(SelectContext);
  if (!open) return null;
  return <div ref={ref} className={cn("absolute z-50 mt-1 min-w-[8rem] overflow-hidden rounded-md border bg-white shadow-md", className)} {...props}><div className="p-1">{children}</div></div>;
});

export const SelectItem = React.forwardRef(({ className, children, value: v, ...props }, ref) => {
  const { value, setValue } = React.useContext(SelectContext);
  return (
    <div
      ref={ref}
      onClick={() => setValue(v)}
      className={cn("relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm hover:bg-neutral-100", value === v && "bg-neutral-100", className)}
      {...props}
    >
      {children}
      {value === v && <span className="absolute right-2"><svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12" /></svg></span>}
    </div>
  );
});

export const SelectGroup = ({ children }) => <div>{children}</div>;
export const SelectLabel = ({ children, className }) => <div className={cn("px-2 py-1.5 text-sm font-semibold", className)}>{children}</div>;
`,

    'scroll-area': `import React from 'react';
import { cn } from '../../lib/utils';

export const ScrollArea = React.forwardRef(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn("relative overflow-auto", className)} {...props}>{children}</div>
));
`,

    'tooltip': `import React from 'react';

export const TooltipProvider = ({ children }) => children;
export const Tooltip = ({ children }) => children;
export const TooltipTrigger = React.forwardRef(({ children, ...props }, ref) => <span ref={ref} {...props}>{children}</span>);
export const TooltipContent = () => null;
`,

    'dialog': `import React from 'react';
import { cn } from '../../lib/utils';

const DialogContext = React.createContext({ open: false, setOpen: () => {} });

export const Dialog = ({ children, open: controlled, onOpenChange }) => {
  const [internal, setInternal] = React.useState(false);
  const open = controlled !== undefined ? controlled : internal;
  const setOpen = (v) => { controlled === undefined && setInternal(v); onOpenChange?.(v); };
  return <DialogContext.Provider value={{ open, setOpen }}>{children}</DialogContext.Provider>;
};

export const DialogTrigger = React.forwardRef(({ children, ...props }, ref) => {
  const { setOpen } = React.useContext(DialogContext);
  return <span ref={ref} onClick={() => setOpen(true)} {...props}>{children}</span>;
});

export const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => {
  const { open, setOpen } = React.useContext(DialogContext);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/80" onClick={() => setOpen(false)} />
      <div ref={ref} className={cn("relative z-50 w-full max-w-lg rounded-lg border bg-white p-6 shadow-lg", className)} {...props}>
        {children}
        <button onClick={() => setOpen(false)} className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
  );
});

export const DialogHeader = ({ className, ...props }) => <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />;
export const DialogFooter = ({ className, ...props }) => <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />;
export const DialogTitle = React.forwardRef(({ className, ...props }, ref) => <h2 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />);
export const DialogDescription = React.forwardRef(({ className, ...props }, ref) => <p ref={ref} className={cn("text-sm text-neutral-500", className)} {...props} />);
`,

    'dropdown-menu': `import React from 'react';
import { cn } from '../../lib/utils';

const DropdownContext = React.createContext({ open: false, setOpen: () => {} });

export const DropdownMenu = ({ children }) => {
  const [open, setOpen] = React.useState(false);
  return <DropdownContext.Provider value={{ open, setOpen }}><div className="relative inline-block">{children}</div></DropdownContext.Provider>;
};

export const DropdownMenuTrigger = React.forwardRef(({ children, ...props }, ref) => {
  const { open, setOpen } = React.useContext(DropdownContext);
  return <span ref={ref} onClick={() => setOpen(!open)} {...props}>{children}</span>;
});

export const DropdownMenuContent = React.forwardRef(({ className, children, ...props }, ref) => {
  const { open, setOpen } = React.useContext(DropdownContext);
  React.useEffect(() => {
    if (open) {
      const handler = () => setOpen(false);
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }
  }, [open, setOpen]);
  if (!open) return null;
  return <div ref={ref} className={cn("absolute right-0 z-50 mt-1 min-w-[8rem] overflow-hidden rounded-md border bg-white p-1 shadow-md", className)} {...props}>{children}</div>;
});

export const DropdownMenuItem = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-neutral-100", className)} {...props} />
));

export const DropdownMenuLabel = ({ className, ...props }) => <div className={cn("px-2 py-1.5 text-sm font-semibold", className)} {...props} />;
export const DropdownMenuSeparator = ({ className, ...props }) => <div className={cn("-mx-1 my-1 h-px bg-neutral-200", className)} {...props} />;
`,

    'popover': `import React from 'react';
import { cn } from '../../lib/utils';

const PopoverContext = React.createContext({ open: false, setOpen: () => {} });

export const Popover = ({ children, open: controlled, onOpenChange }) => {
  const [internal, setInternal] = React.useState(false);
  const open = controlled !== undefined ? controlled : internal;
  const setOpen = (v) => { controlled === undefined && setInternal(v); onOpenChange?.(v); };
  return <PopoverContext.Provider value={{ open, setOpen }}><div className="relative inline-block">{children}</div></PopoverContext.Provider>;
};

export const PopoverTrigger = React.forwardRef(({ children, ...props }, ref) => {
  const { setOpen, open } = React.useContext(PopoverContext);
  return <span ref={ref} onClick={() => setOpen(!open)} {...props}>{children}</span>;
});

export const PopoverContent = React.forwardRef(({ className, children, ...props }, ref) => {
  const { open } = React.useContext(PopoverContext);
  if (!open) return null;
  return <div ref={ref} className={cn("absolute z-50 mt-1 w-72 rounded-md border bg-white p-4 shadow-md outline-none", className)} {...props}>{children}</div>;
});
`,

    'table': `import React from 'react';
import { cn } from '../../lib/utils';

export const Table = React.forwardRef(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
  </div>
));

export const TableHeader = React.forwardRef(({ className, ...props }, ref) => <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />);
export const TableBody = React.forwardRef(({ className, ...props }, ref) => <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />);
export const TableFooter = React.forwardRef(({ className, ...props }, ref) => <tfoot ref={ref} className={cn("border-t bg-neutral-100/50 font-medium", className)} {...props} />);
export const TableRow = React.forwardRef(({ className, ...props }, ref) => <tr ref={ref} className={cn("border-b transition-colors hover:bg-neutral-100/50", className)} {...props} />);
export const TableHead = React.forwardRef(({ className, ...props }, ref) => <th ref={ref} className={cn("h-10 px-2 text-left align-middle font-medium text-neutral-500", className)} {...props} />);
export const TableCell = React.forwardRef(({ className, ...props }, ref) => <td ref={ref} className={cn("p-2 align-middle", className)} {...props} />);
export const TableCaption = React.forwardRef(({ className, ...props }, ref) => <caption ref={ref} className={cn("mt-4 text-sm text-neutral-500", className)} {...props} />);
`,
  }

  return components[name] || null
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  error: {
    padding: '20px',
    color: '#dc2626',
    textAlign: 'center',
  },
}