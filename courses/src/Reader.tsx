import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchPage, type Session } from './api'
import { ChevronUp, ChevronDown, ExitIcon } from './icons'

/** Load pages a little before they scroll into view. */
const ROOT_MARGIN = '900px 0px'

export function Reader({
  session,
  onLock,
}: {
  session: Session
  onLock: () => void
}) {
  const { guide, buyer } = session
  const total = guide.pageCount
  const [urls, setUrls] = useState<Record<number, string>>({})
  const [failed, setFailed] = useState<Record<number, boolean>>({})
  const [current, setCurrent] = useState(1)
  const [veiled, setVeiled] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef(new Map<number, HTMLDivElement>())
  const loading = useRef(new Set<number>())
  const urlsRef = useRef<Record<number, string>>({})
  urlsRef.current = urls

  // --- fetch a single page -------------------------------------------------
  const load = useCallback(
    async (n: number) => {
      if (urlsRef.current[n] || loading.current.has(n)) return
      loading.current.add(n)
      try {
        const url = await fetchPage(n)
        setUrls((prev) => (prev[n] ? prev : { ...prev, [n]: url }))
      } catch {
        setFailed((prev) => ({ ...prev, [n]: true }))
      } finally {
        loading.current.delete(n)
      }
    },
    [],
  )

  // --- lazy loading + current-page tracking --------------------------------
  useEffect(() => {
    const nodes = [...pageRefs.current.entries()]
    if (!nodes.length) return

    const loader = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const n = Number((e.target as HTMLElement).dataset.page)
          if (n) void load(n)
        }
      },
      { rootMargin: ROOT_MARGIN },
    )

    const tracker = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) {
          const n = Number((visible.target as HTMLElement).dataset.page)
          if (n) setCurrent(n)
        }
      },
      { threshold: [0.25, 0.6] },
    )

    for (const [, node] of nodes) {
      loader.observe(node)
      tracker.observe(node)
    }
    return () => {
      loader.disconnect()
      tracker.disconnect()
    }
  }, [total, load])

  // Always have page 1 ready, even before any observer fires.
  useEffect(() => {
    if (total > 0) void load(1)
  }, [total, load])

  // Release blob URLs when leaving the reader.
  useEffect(
    () => () => {
      for (const url of Object.values(urlsRef.current)) URL.revokeObjectURL(url)
    },
    [],
  )

  // --- content protection ---------------------------------------------------
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault()

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      // Save, print, view-source, devtools, select-all, copy.
      if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'u', 'a', 'c'].includes(k)) {
        e.preventDefault()
      }
      if (e.key === 'F12') e.preventDefault()
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(k)) {
        e.preventDefault()
      }
      // Windows: PrintScreen can't be blocked, but we can blank the clipboard.
      if (e.key === 'PrintScreen') {
        navigator.clipboard?.writeText('').catch(() => undefined)
      }
    }

    // Hide content while the tab is backgrounded (app switcher previews).
    const onVisibility = () => setVeiled(document.visibilityState === 'hidden')
    const onBlur = () => setVeiled(true)
    const onFocus = () => setVeiled(false)

    document.addEventListener('contextmenu', stop)
    document.addEventListener('copy', stop)
    document.addEventListener('cut', stop)
    document.addEventListener('dragstart', stop)
    document.addEventListener('keydown', onKey)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)

    return () => {
      document.removeEventListener('contextmenu', stop)
      document.removeEventListener('copy', stop)
      document.removeEventListener('cut', stop)
      document.removeEventListener('dragstart', stop)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const jump = (n: number) => {
    const target = Math.min(total, Math.max(1, n))
    pageRefs.current.get(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!guide.ready || total === 0) {
    return (
      <div className="aurora">
        <div className="center">
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>📚</div>
            <h2 className="card-title">Almost there</h2>
            <p className="card-sub">
              <strong>{guide.title}</strong> is being prepared. Please check back
              shortly — your access is already saved on this device.
            </p>
            <button className="btn btn-ghost" onClick={() => location.reload()}>
              Refresh
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`reader${veiled ? ' veiled' : ''}`}>
      <header className="reader-bar">
        <a className="brand" href="/" onClick={(e) => e.preventDefault()}>
          <img src="/tc-icon.png" alt="" />
        </a>
        <div className="reader-title">
          <div className="reader-course">{guide.courseCode}</div>
          <div className="reader-name">{guide.title}</div>
        </div>
        <button
          className="icon-btn"
          title="Sign out on this device"
          aria-label="Sign out on this device"
          onClick={() => {
            if (
              confirm(
                'Sign out on this device? You will need your access code (or a recovery request) to get back in.',
              )
            ) {
              onLock()
            }
          }}
        >
          <ExitIcon size={17} />
        </button>
      </header>

      <div className="pages" ref={containerRef}>
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
          <div
            className="page-wrap"
            key={n}
            data-page={n}
            ref={(el) => {
              if (el) pageRefs.current.set(n, el)
              else pageRefs.current.delete(n)
            }}
          >
            {urls[n] ? (
              <>
                <img
                  className="page-img"
                  src={urls[n]}
                  alt={`Page ${n}`}
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                />
                <span className="page-tag">
                  {n} / {total}
                </span>
              </>
            ) : (
              <div className="page-skeleton">
                {failed[n] ? (
                  <button
                    className="top-help"
                    onClick={() => {
                      setFailed((f) => ({ ...f, [n]: false }))
                      void load(n)
                    }}
                  >
                    Retry page {n}
                  </button>
                ) : (
                  `Loading page ${n}…`
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <nav className="pager" aria-label="Page navigation">
        <button
          onClick={() => jump(current - 1)}
          disabled={current <= 1}
          aria-label="Previous page"
        >
          <ChevronUp size={17} />
        </button>
        <span className="pager-label">
          {current} / {total}
        </span>
        <button
          onClick={() => jump(current + 1)}
          disabled={current >= total}
          aria-label="Next page"
        >
          <ChevronDown size={17} />
        </button>
      </nav>

      {veiled && (
        <div className="veil">
          <div className="veil-title">Content hidden</div>
          <div className="veil-sub">
            Your guide is hidden while this tab is in the background. Tap anywhere
            to continue reading.
          </div>
          <div className="veil-sub" style={{ fontSize: 12 }}>
            Licensed to {buyer.name} · {buyer.phone}
          </div>
        </div>
      )}
    </div>
  )
}
