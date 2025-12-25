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

function findMatchingBrace(code: string, startIdx: number): number {
  let depth = 0
  let inString = false
  let stringChar = ''
  
  for (let i = startIdx; i < code.length; i++) {
    const ch = code[i]
    const prev = i > 0 ? code[i - 1] : ''
    
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
    
    result += code.slice(i, idx + pattern.length)
    i = idx + pattern.length
    
    const closeIdx = findMatchingBrace(code, idx + pattern.length - 1)
    if (closeIdx === -1) {
      result += code.slice(i)
      break
    }
    
    const content = code.slice(i, closeIdx)
    const trimmed = content.trim()
    
    const hasBackticks = trimmed.startsWith('`') && trimmed.endsWith('`')
    if (hasBackticks) {
      result += content
      i = closeIdx
      continue
    }
    
    if (/^\s*\w+\s*\(/.test(trimmed) && trimmed.endsWith(')')) {
      result += content
      i = closeIdx
      continue
    }
    
    const hasInterpolation = trimmed.includes('${')
    if (!hasInterpolation && /^[a-zA-Z_]\w*$/.test(trimmed)) {
      result += content
      i = closeIdx
      continue
    }
    
    if (!hasInterpolation && trimmed.includes('?') && !trimmed.includes('${')) {
      result += content
      i = closeIdx
      continue
    }
    
    if (hasInterpolation && !hasBackticks) {
      result += '`' + trimmed + '`'
    } else {
      result += content
    }
    
    i = closeIdx
  }
  
  return result
}

function fixReturnStatements(code: string): string {
  return code.replace(/return\s*['"]([^'"]*\$\{[^'"]*)['"]/g, (_m, content) => {
    return 'return `' + content + '`'
  })
}

function fixAssignments(code: string): string {
  return code.replace(/=\s*['"]([^'"]*\$\{[^'"]*)['"]/g, (_m, content) => {
    return '= `' + content + '`'
  })
}

function fixBrokenTemplateLiterals(code: string): string {
  const allInterpolations = (code.match(/\$\{/g) || []).length
  const validMatches = code.match(/`[^`]*\$\{[^`]*`/g) || []
  let validInterpolations = 0
  validMatches.forEach(m => {
    validInterpolations += (m.match(/\$\{/g) || []).length
  })
  
  if (allInterpolations === validInterpolations) {
    return code
  }
  
  let fixed = code
  fixed = fixReturnStatements(fixed)
  fixed = fixAssignments(fixed)
  fixed = fixClassNameAttributes(fixed)
  
  return fixed
}

export default function ArtifactRenderer({ code }: ArtifactRendererProps) {
  const sandpackConfig = useMemo(() => {
    const trimmedCode = code.trim()

    if (!trimmedCode) {
      return null
    }

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

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100%',
    minHeight: '400px',
  },
  error: {
    padding: '20px',
    color: '#dc2626',
    textAlign: 'center',
  },
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

  const importRegex = /import\s+(?:(\w+)(?:\s*,\s*)?)?(?:\{([^}]+)\})?\s+from\s+['"]([^'"]+)['"]/g
  let importMatch

  while ((importMatch = importRegex.exec(code)) !== null) {
    const source = importMatch[3]
    const isShadcn = source.startsWith('@/components/ui/')

    imports.push({ full: importMatch[0], source, isShadcn })

    if (isShadcn) {
      const componentFile = source.replace('@/components/ui/', '')
      shadcnComponents.push(componentFile)
    } else if (!source.startsWith('.') && !source.startsWith('@/')) {
      const pkgName = source.startsWith('@')
        ? source.split('/').slice(0, 2).join('/')
        : source.split('/')[0]
      npmPackages.add(pkgName)
    }
  }

  if (/\buseState\b|\buseEffect\b|\buseRef\b|\buseMemo\b/.test(code)) {
    npmPackages.add('react')
  }

  return { imports, shadcnComponents, npmPackages, isMarkdown: false, isPlainHTML, isFullDocument }
}

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

  if (analysis.shadcnComponents.length > 0) {
    analysis.imports.forEach(imp => {
      if (imp.isShadcn) {
        const newSource = imp.source.replace('@/components/ui/', './components/ui/')
        processedCode = processedCode.replace(imp.full, imp.full.replace(imp.source, newSource))
      }
    })

    analysis.shadcnComponents.forEach(comp => {
      const content = getShadcnComponent(comp)
      if (content) {
        files[`/components/ui/${comp}.jsx`] = content
      }
    })
  }

  if (/\bcn\(/.test(code) || analysis.shadcnComponents.length > 0) {
    files['/lib/utils.js'] = `export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
`
    if (!/import.*cn.*from/.test(processedCode) && /\bcn\(/.test(processedCode) && !/function\s+cn\s*\(/.test(processedCode)) {
      processedCode = `import { cn } from './lib/utils';\n` + processedCode
    }
  }

  if (!/export\s+default/.test(processedCode)) {
    const componentMatch = processedCode.match(/(?:function|const)\s+([A-Z]\w*)\s*(?:=|\()/)
    if (componentMatch) {
      processedCode += `\n\nexport default ${componentMatch[1]};`
    }
  }

  files['/App.tsx'] = processedCode

  return files
}

function buildDependencies(analysis: CodeAnalysis): Record<string, string> {
  const deps: Record<string, string> = {}
  
  if (analysis.isMarkdown) {
    deps['marked'] = 'latest'
  }
  
  analysis.npmPackages.forEach(pkg => {
    if (pkg !== 'react' && pkg !== 'react-dom') {
      deps[pkg] = 'latest'
    }
  })
  
  return deps
}

function getShadcnComponent(name: string): string | null {
  const components: Record<string, string> = {
    'button': `import React from 'react';
import { cn } from '../../lib/utils';

const variants = {
  default: "bg-neutral-900 text-neutral-50 hover:bg-neutral-900/90",
  destructive: "bg-red-500 text-neutral-50 hover:bg-red-500/90",
  outline: "border border-neutral-200 bg-white hover:bg-neutral-100",
  secondary: "bg-neutral-100 text-neutral-900 hover:bg-neutral-100/80",
  ghost: "hover:bg-neutral-100",
  link: "text-neutral-900 underline-offset-4 hover:underline",
};

const sizes = {
  default: "h-10 px-4 py-2",
  sm: "h-9 px-3",
  lg: "h-11 px-8",
  icon: "h-10 w-10",
};

export const Button = React.forwardRef(({ className, variant = "default", size = "default", ...props }, ref) => (
  <button ref={ref} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50", variants[variant], sizes[size], className)} {...props} />
));
`,
    'card': `import React from 'react';
import { cn } from '../../lib/utils';

export const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-lg border bg-white text-neutral-950 shadow-sm", className)} {...props} />
));

export const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
));

export const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
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
    'input': `import React from 'react';
import { cn } from '../../lib/utils';

export const Input = React.forwardRef(({ className, type, ...props }, ref) => (
  <input type={type} className={cn("flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50", className)} ref={ref} {...props} />
));
`,
    'badge': `import React from 'react';
import { cn } from '../../lib/utils';

const variants = {
  default: "bg-neutral-900 text-neutral-50",
  secondary: "bg-neutral-100 text-neutral-900",
  destructive: "bg-red-500 text-neutral-50",
  outline: "text-neutral-950 border border-neutral-200",
};

export const Badge = ({ className, variant = "default", ...props }) => (
  <div className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors", variants[variant], className)} {...props} />
);
`,
  }
  
  return components[name] || null
}