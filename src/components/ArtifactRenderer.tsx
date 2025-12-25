import React, { useMemo, useEffect, useRef } from 'react'
import {
  SandpackProvider,
  SandpackPreview,
  useSandpack,
} from '@codesandbox/sandpack-react'

// ============================================================================
// TYPES
// ============================================================================

export interface FeedbackComment {
  id: string
  user_name: string
  x_percent: number
  y_percent: number
  message: string
  isMine: boolean
  isExpanded?: boolean
}

export interface PendingComment {
  x: number
  y: number
}

interface ArtifactRendererProps {
  code: string
  // Feedback props
  feedbackMode?: boolean
  comments?: FeedbackComment[]
  pendingComment?: PendingComment | null
  userName?: string
  onCanvasClick?: (x: number, y: number) => void
  onPinClick?: (commentId: string) => void
  onClosePending?: () => void
}

// ============================================================================
// FEEDBACK SCRIPT - This gets injected into the iframe
// ============================================================================

const FEEDBACK_SCRIPT = `
(function() {
  // State
  let feedbackMode = false;
  let comments = [];
  let pendingComment = null;
  let userName = '';
  let expandedCommentId = null;
  
  // Container for feedback UI
  let feedbackContainer = null;
  let cursorIndicator = null;
  
  function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }
  
  function createFeedbackContainer() {
    if (feedbackContainer) return;
    
    feedbackContainer = document.createElement('div');
    feedbackContainer.id = 'gramola-feedback-container';
    feedbackContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 999999;';
    document.body.appendChild(feedbackContainer);
    
    // Make body relative if not already
    const bodyStyle = window.getComputedStyle(document.body);
    if (bodyStyle.position === 'static') {
      document.body.style.position = 'relative';
    }
    
    // Ensure min height covers viewport
    document.body.style.minHeight = '100vh';
  }
  
  function createCursorIndicator() {
    if (cursorIndicator) return;
    
    cursorIndicator = document.createElement('div');
    cursorIndicator.id = 'gramola-cursor';
    cursorIndicator.style.cssText = \`
      position: fixed;
      pointer-events: none;
      padding: 5px 10px;
      border-radius: 6px;
      background-color: rgba(20, 18, 15, 0.8);
      color: #fff;
      font-size: 12px;
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      white-space: nowrap;
      z-index: 9999999;
      display: none;
      transform: translate(12px, 12px);
    \`;
    cursorIndicator.textContent = '+ Click to comment';
    document.body.appendChild(cursorIndicator);
  }
  
  function renderPins() {
    if (!feedbackContainer) return;
    
    // Clear existing pins
    feedbackContainer.innerHTML = '';
    
    // Render comment pins
    comments.forEach(comment => {
      const pin = createPin(comment);
      feedbackContainer.appendChild(pin);
    });
    
    // Render pending comment pin
    if (pendingComment) {
      const pendingPin = createPendingPin(pendingComment);
      feedbackContainer.appendChild(pendingPin);
    }
  }
  
  function createPin(comment) {
    const container = document.createElement('div');
    container.style.cssText = \`
      position: absolute;
      left: \${comment.x_percent}%;
      top: \${comment.y_percent}%;
      transform: translate(-50%, -50%);
      pointer-events: auto;
      z-index: \${comment.isExpanded ? 100 : 10};
    \`;
    
    const pin = document.createElement('div');
    pin.style.cssText = \`
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      cursor: pointer;
      border: 2px solid #fff;
      background-color: \${comment.isMine ? '#6b7cff' : '#14120f'};
      color: #fff;
      box-shadow: 0 2px 8px \${comment.isMine ? 'rgba(107, 124, 255, 0.4)' : 'rgba(20, 18, 15, 0.3)'};
      transition: transform 0.15s, box-shadow 0.15s;
      \${comment.isExpanded ? 'transform: scale(1.1); box-shadow: 0 4px 12px rgba(107, 124, 255, 0.5);' : ''}
    \`;
    pin.textContent = getInitials(comment.user_name);
    pin.onclick = (e) => {
      e.stopPropagation();
      window.parent.postMessage({ type: 'gramola-pin-click', commentId: comment.id }, '*');
    };
    
    container.appendChild(pin);
    
    // Render expanded card
    if (comment.isExpanded) {
      const card = createCommentCard(comment);
      container.appendChild(card);
    }
    
    return container;
  }
  
  function createCommentCard(comment) {
    const isNearRight = comment.x_percent > 65;
    const isNearBottom = comment.y_percent > 70;
    
    const card = document.createElement('div');
    card.style.cssText = \`
      position: absolute;
      \${isNearRight ? 'right: 40px;' : 'left: 40px;'}
      \${isNearBottom ? 'bottom: -10px;' : 'top: -10px;'}
      width: 240px;
      padding: 14px;
      border-radius: 12px;
      background-color: #fff;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      border: 1px solid rgba(20, 18, 15, 0.1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      pointer-events: auto;
    \`;
    
    card.innerHTML = \`
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div style="font-size: 13px; font-weight: 600; color: #14120f;">\${comment.user_name}</div>
        <button id="close-\${comment.id}" style="
          width: 22px; height: 22px; border-radius: 6px; border: none;
          background-color: rgba(20, 18, 15, 0.06); color: rgba(20, 18, 15, 0.5);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          font-size: 14px; line-height: 1;
        ">×</button>
      </div>
      <div style="font-size: 13px; color: rgba(20, 18, 15, 0.75); line-height: 1.5;">\${comment.message}</div>
    \`;
    
    card.onclick = (e) => e.stopPropagation();
    
    // Close button handler
    setTimeout(() => {
      const closeBtn = card.querySelector('#close-' + comment.id);
      if (closeBtn) {
        closeBtn.onclick = (e) => {
          e.stopPropagation();
          window.parent.postMessage({ type: 'gramola-close-expanded' }, '*');
        };
      }
    }, 0);
    
    return card;
  }
  
  function createPendingPin(pending) {
    const isNearRight = pending.x > 65;
    const isNearBottom = pending.y > 70;
    
    const container = document.createElement('div');
    container.style.cssText = \`
      position: absolute;
      left: \${pending.x}%;
      top: \${pending.y}%;
      transform: translate(-50%, -50%);
      pointer-events: auto;
      z-index: 200;
    \`;
    
    const pin = document.createElement('div');
    pin.style.cssText = \`
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      cursor: pointer;
      border: 2px solid #fff;
      background-color: #6b7cff;
      color: #fff;
      box-shadow: 0 2px 8px rgba(107, 124, 255, 0.4);
      animation: gramola-pop 0.2s ease-out;
    \`;
    pin.textContent = getInitials(userName);
    
    const card = document.createElement('div');
    card.style.cssText = \`
      position: absolute;
      \${isNearRight ? 'right: 40px;' : 'left: 40px;'}
      \${isNearBottom ? 'bottom: -10px;' : 'top: -10px;'}
      width: 260px;
      padding: 14px;
      border-radius: 12px;
      background-color: #fff;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
      border: 1px solid rgba(107, 124, 255, 0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    \`;
    
    card.innerHTML = \`
      <div style="margin-bottom: 10px;">
        <span style="font-size: 13px; font-weight: 600; color: #14120f;">\${userName}</span>
      </div>
      <textarea id="gramola-input" style="
        width: 100%; padding: 10px 12px; border-radius: 8px;
        border: 1px solid rgba(20, 18, 15, 0.14); background-color: #fafafa;
        font-size: 13px; line-height: 1.5; resize: none; outline: none;
        font-family: inherit; box-sizing: border-box;
      " placeholder="Add your feedback..." rows="2"></textarea>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
        <span style="font-size: 11px; color: rgba(20, 18, 15, 0.4);">Enter ↵</span>
        <div style="display: flex; gap: 6px;">
          <button id="gramola-cancel" style="
            padding: 6px 10px; border-radius: 6px;
            border: 1px solid rgba(20, 18, 15, 0.14); background-color: #fff;
            color: rgba(20, 18, 15, 0.6); font-size: 12px; cursor: pointer;
          ">Cancel</button>
          <button id="gramola-send" style="
            display: flex; align-items: center; justify-content: center;
            width: 32px; height: 32px; border-radius: 8px; border: none;
            background-color: #6b7cff; color: #fff; cursor: pointer;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/>
            </svg>
          </button>
        </div>
      </div>
    \`;
    
    card.onclick = (e) => e.stopPropagation();
    
    container.appendChild(pin);
    container.appendChild(card);
    
    // Setup handlers after append
    setTimeout(() => {
      const input = document.getElementById('gramola-input');
      const cancelBtn = document.getElementById('gramola-cancel');
      const sendBtn = document.getElementById('gramola-send');
      
      if (input) {
        input.focus();
        input.onkeydown = (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const message = input.value.trim();
            if (message) {
              window.parent.postMessage({ type: 'gramola-submit', message, x: pending.x, y: pending.y }, '*');
            }
          } else if (e.key === 'Escape') {
            window.parent.postMessage({ type: 'gramola-cancel' }, '*');
          }
        };
      }
      
      if (cancelBtn) {
        cancelBtn.onclick = () => {
          window.parent.postMessage({ type: 'gramola-cancel' }, '*');
        };
      }
      
      if (sendBtn) {
        sendBtn.onclick = () => {
          const input = document.getElementById('gramola-input');
          const message = input?.value?.trim();
          if (message) {
            window.parent.postMessage({ type: 'gramola-submit', message, x: pending.x, y: pending.y }, '*');
          }
        };
      }
    }, 0);
    
    return container;
  }
  
  function handleDocumentClick(e) {
    if (!feedbackMode) return;
    
    // Ignore clicks on pins/cards
    if (e.target.closest('#gramola-feedback-container')) return;
    
    // Get coordinates relative to document (not viewport)
    const x = ((e.pageX) / document.documentElement.scrollWidth) * 100;
    const y = ((e.pageY) / document.documentElement.scrollHeight) * 100;
    
    window.parent.postMessage({ type: 'gramola-click', x, y }, '*');
  }
  
  function handleMouseMove(e) {
    if (!feedbackMode || !cursorIndicator) return;
    if (pendingComment) {
      cursorIndicator.style.display = 'none';
      return;
    }
    
    // Hide if over a pin or card
    if (e.target.closest('#gramola-feedback-container')) {
      cursorIndicator.style.display = 'none';
      return;
    }
    
    cursorIndicator.style.display = 'block';
    cursorIndicator.style.left = e.clientX + 'px';
    cursorIndicator.style.top = e.clientY + 'px';
  }
  
  function handleMouseLeave() {
    if (cursorIndicator) {
      cursorIndicator.style.display = 'none';
    }
  }
  
  function updateFeedbackMode(enabled) {
    feedbackMode = enabled;
    document.body.style.cursor = enabled ? 'crosshair' : 'default';
    
    if (enabled) {
      createFeedbackContainer();
      createCursorIndicator();
      renderPins();
    } else {
      if (feedbackContainer) {
        feedbackContainer.innerHTML = '';
      }
      if (cursorIndicator) {
        cursorIndicator.style.display = 'none';
      }
    }
  }
  
  // Add animation keyframes
  const style = document.createElement('style');
  style.textContent = \`
    @keyframes gramola-pop {
      0% { transform: scale(0); }
      70% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }
  \`;
  document.head.appendChild(style);
  
  // Listen for messages from parent
  window.addEventListener('message', (e) => {
    if (!e.data || !e.data.type) return;
    
    switch (e.data.type) {
      case 'gramola-update':
        feedbackMode = e.data.feedbackMode;
        comments = e.data.comments || [];
        pendingComment = e.data.pendingComment;
        userName = e.data.userName || '';
        updateFeedbackMode(feedbackMode);
        if (feedbackMode) renderPins();
        break;
    }
  });
  
  // Setup event listeners
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseleave', handleMouseLeave);
  
  // Notify parent we're ready
  window.parent.postMessage({ type: 'gramola-ready' }, '*');
})();
`;

// ============================================================================
// FEEDBACK BRIDGE COMPONENT
// ============================================================================

interface FeedbackBridgeProps {
  feedbackMode: boolean
  comments: FeedbackComment[]
  pendingComment: PendingComment | null
  userName: string
  onCanvasClick: (x: number, y: number) => void
  onPinClick: (commentId: string) => void
  onClosePending: () => void
  onSubmitComment: (message: string, x: number, y: number) => void
  onCloseExpanded: () => void
}

function FeedbackBridge({
  feedbackMode,
  comments,
  pendingComment,
  userName,
  onCanvasClick,
  onPinClick,
  onClosePending,
  onSubmitComment,
  onCloseExpanded,
}: FeedbackBridgeProps) {
  const { sandpack } = useSandpack()
  const lastUpdateRef = useRef<string>('')
  
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data || !e.data.type) return
      
      switch (e.data.type) {
        case 'gramola-ready':
          // Send initial state
          sendUpdate()
          break
        case 'gramola-click':
          onCanvasClick(e.data.x, e.data.y)
          break
        case 'gramola-pin-click':
          onPinClick(e.data.commentId)
          break
        case 'gramola-cancel':
          onClosePending()
          break
        case 'gramola-submit':
          onSubmitComment(e.data.message, e.data.x, e.data.y)
          break
        case 'gramola-close-expanded':
          onCloseExpanded()
          break
      }
    }
    
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onCanvasClick, onPinClick, onClosePending, onSubmitComment, onCloseExpanded])
  
  const sendUpdate = () => {
    const iframe = document.querySelector('.sp-preview-iframe') as HTMLIFrameElement
    if (iframe?.contentWindow) {
      const update = {
        type: 'gramola-update',
        feedbackMode,
        comments,
        pendingComment,
        userName,
      }
      
      // Avoid sending duplicate updates
      const updateKey = JSON.stringify(update)
      if (updateKey !== lastUpdateRef.current) {
        lastUpdateRef.current = updateKey
        iframe.contentWindow.postMessage(update, '*')
      }
    }
  }
  
  useEffect(() => {
    sendUpdate()
  }, [feedbackMode, comments, pendingComment, userName])
  
  // Re-send when sandpack status changes
  useEffect(() => {
    if (sandpack.status === 'running') {
      // Wait a bit for iframe to be ready
      const timer = setTimeout(sendUpdate, 500)
      return () => clearTimeout(timer)
    }
  }, [sandpack.status])
  
  return null
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ArtifactRenderer({
  code,
  feedbackMode = false,
  comments = [],
  pendingComment = null,
  userName = '',
  onCanvasClick = () => {},
  onPinClick = () => {},
  onClosePending = () => {},
}: ArtifactRendererProps) {
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
    
    // Inject feedback script into index.html
    if (files['/index.html']) {
      files['/index.html'] = files['/index.html'].replace(
        '</body>',
        `<script>${FEEDBACK_SCRIPT}</script></body>`
      )
    } else {
      // Create index.html with script
      files['/index.html'] = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <div id="root"></div>
  <script>${FEEDBACK_SCRIPT}</script>
</body>
</html>`
    }

    return { files, dependencies }
  }, [code])
  
  // Callbacks for FeedbackBridge
  const handleSubmitComment = (message: string, x: number, y: number) => {
    // This will be handled by ViewerPage
    window.dispatchEvent(new CustomEvent('gramola-submit-comment', {
      detail: { message, x, y }
    }))
  }
  
  const handleCloseExpanded = () => {
    window.dispatchEvent(new CustomEvent('gramola-close-expanded'))
  }

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
        <FeedbackBridge
          feedbackMode={feedbackMode}
          comments={comments}
          pendingComment={pendingComment}
          userName={userName}
          onCanvasClick={onCanvasClick}
          onPinClick={onPinClick}
          onClosePending={onClosePending}
          onSubmitComment={handleSubmitComment}
          onCloseExpanded={handleCloseExpanded}
        />
      </SandpackProvider>
    </div>
  )
}

// ============================================================================
// STYLES
// ============================================================================

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
// CODE ANALYSIS (keep existing implementation)
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

function fixReturnStatements(code: string): string {
  return code.replace(/return\s*['"]([^'"]*\$\{[^'"]*)['"]/g, (_match, content) => {
    return 'return `' + content + '`'
  })
}

function fixAssignments(code: string): string {
  return code.replace(/=\s*['"]([^'"]*\$\{[^'"]*)['"]/g, (_match, content) => {
    return '= `' + content + '`'
  })
}

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