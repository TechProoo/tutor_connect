import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ApiError,
  fetchOutline,
  fetchPage,
  fetchThumb,
  searchGuide,
  type OutlineEntry,
  type SearchHit,
  type Session,
} from './api'
import {
  BookmarkIcon,
  ChevronLeft,
  ChevronRight,
  ContentsIcon,
  ExitIcon,
  FitIcon,
  FocusIcon,
  FullscreenIcon,
  MenuIcon,
  MinusIcon,
  NotesIcon,
  PagesIcon,
  PlusIcon,
  SearchIcon,
  SinglePageIcon,
  ThemeIcon,
} from './icons'

const ROOT_MARGIN = '900px 0px'
const MAX_CACHED_PAGES = 14
const MIN_ZOOM = 50
const MAX_ZOOM = 320
const ZOOM_STEP = 10
/** Previews are small, so a whole navigator's worth can stay in memory. */
const MAX_CACHED_THUMBS = 240
/** Pause after typing before searching, so each keystroke isn't a request. */
const SEARCH_DEBOUNCE_MS = 250
/** Two taps within this window count as a double-tap zoom. */
const DOUBLE_TAP_MS = 300

type SidebarTab = 'contents' | 'pages' | 'search'

/** Flatten the outline tree for rendering, carrying depth for indentation. */
function flattenOutline(
  entries: OutlineEntry[],
  depth = 0,
): { entry: OutlineEntry; depth: number }[] {
  return entries.flatMap((entry) => [
    { entry, depth },
    ...flattenOutline(entry.children ?? [], depth + 1),
  ])
}

/** Works for both DOM and React touches, which differ only in extra fields. */
function distanceBetween(
  a: { clientX: number; clientY: number },
  b: { clientX: number; clientY: number },
) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}
const SUPPORT_EMAIL =
  import.meta.env.VITE_SUPPORT_EMAIL ?? 'support@tutorconnect.ng'
const SUPPORT_WHATSAPP = import.meta.env.VITE_SUPPORT_WHATSAPP ?? ''

type ViewMode = 'continuous' | 'single'
type ReaderTheme = 'cloud' | 'paper' | 'midnight'

function readNumber(key: string, fallback: number) {
  try {
    const value = Number(localStorage.getItem(key))
    return Number.isFinite(value) && value > 0 ? value : fallback
  } catch {
    return fallback
  }
}

function readBookmarks(key: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]')
    if (!Array.isArray(parsed)) return new Set<number>()
    return new Set(parsed.filter((n): n is number => Number.isInteger(n) && n > 0))
  } catch {
    return new Set<number>()
  }
}

function readNotes(key: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {} as Record<number, string>
    }
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([page, note]) => [Number(page), note] as const)
        .filter(
          ([page, note]) =>
            Number.isInteger(page) && page > 0 && typeof note === 'string',
        ),
    ) as Record<number, string>
  } catch {
    return {} as Record<number, string>
  }
}

function readTheme(): ReaderTheme {
  try {
    const theme = localStorage.getItem('tc-reader-theme')
    return theme === 'paper' || theme === 'midnight' ? theme : 'cloud'
  } catch {
    return 'cloud'
  }
}

export function Reader({
  session,
  onLock,
}: {
  session: Session
  onLock: () => void
}) {
  const { guide, buyer } = session
  const total = guide.pageCount
  const resumeKey = `tc-reader-page:${guide.id}`
  const bookmarkKey = `tc-reader-bookmarks:${guide.id}`
  const notesKey = `tc-reader-notes:${guide.id}`

  const [urls, setUrls] = useState<Record<number, string>>({})
  const [thumbs, setThumbs] = useState<Record<number, string>>({})
  const [failed, setFailed] = useState<Record<number, boolean>>({})
  const [current, setCurrent] = useState(() =>
    Math.min(total || 1, readNumber(resumeKey, 1)),
  )
  const [pageDraft, setPageDraft] = useState(String(current))
  const [viewMode, setViewMode] = useState<ViewMode>('continuous')
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.matchMedia('(min-width: 980px)').matches,
  )
  const [zoom, setZoom] = useState(100)
  const [fitWidth, setFitWidth] = useState(true)
  const [bookmarks, setBookmarks] = useState(() => readBookmarks(bookmarkKey))
  const [notes, setNotes] = useState(() => readNotes(notesKey))
  const [notesOpen, setNotesOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [theme, setTheme] = useState<ReaderTheme>(readTheme)
  const [studyMinutes, setStudyMinutes] = useState(0)
  const [veiled, setVeiled] = useState(false)
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement))
  const [showTips, setShowTips] = useState(false)
  const [showSignOut, setShowSignOut] = useState(false)
  const [toast, setToast] = useState('')
  const [loadRevision, setLoadRevision] = useState(0)
  const [scrubPage, setScrubPage] = useState<number | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [accessError, setAccessError] = useState('')
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('pages')
  const [outline, setOutline] = useState<OutlineEntry[]>([])
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [searchable, setSearchable] = useState<boolean | null>(null)
  const [searchRan, setSearchRan] = useState(false)
  const [activeHit, setActiveHit] = useState(-1)
  const [flashPage, setFlashPage] = useState(0)

  const pageRefs = useRef(new Map<number, HTMLDivElement>())
  const thumbRefs = useRef(new Map<number, HTMLElement>())
  const loading = useRef(new Set<number>())
  const loadingThumbs = useRef(new Set<number>())
  const urlsRef = useRef<Record<number, string>>({})
  const thumbsRef = useRef<Record<number, string>>({})
  const abortController = useRef(new AbortController())
  const searchAbort = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const pinch = useRef<{ distance: number; zoom: number } | null>(null)
  const lastTap = useRef(0)
  const searchInput = useRef<HTMLInputElement>(null)
  const sessionStarted = useRef(Date.now())
  const completionShown = useRef(false)
  urlsRef.current = urls
  thumbsRef.current = thumbs

  const load = useCallback(async (n: number) => {
    if (n < 1 || n > total || urlsRef.current[n] || loading.current.has(n)) return
    loading.current.add(n)
    try {
      // React Strict Mode runs effect cleanup once during development. Renew
      // the controller if that rehearsal aborted it before the real request.
      if (abortController.current.signal.aborted) {
        abortController.current = new AbortController()
      }
      const url = await fetchPage(n, abortController.current.signal)
      setFailed((prev) => {
        if (!prev[n]) return prev
        const next = { ...prev }
        delete next[n]
        return next
      })
      setUrls((prev) => {
        if (prev[n]) {
          URL.revokeObjectURL(url)
          return prev
        }

        const next = { ...prev, [n]: url }
        const pages = Object.keys(next).map(Number)
        if (pages.length > MAX_CACHED_PAGES) {
          const removable = pages
            .filter((page) => page !== n)
            .sort((a, b) => Math.abs(b - n) - Math.abs(a - n))
          while (Object.keys(next).length > MAX_CACHED_PAGES && removable.length) {
            const page = removable.shift()!
            const oldUrl = next[page]
            delete next[page]
            window.setTimeout(() => URL.revokeObjectURL(oldUrl), 0)
          }
        }
        return next
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (mounted.current) setLoadRevision((value) => value + 1)
        return
      }
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setAccessError(error.message)
        return
      }
      setFailed((prev) => ({ ...prev, [n]: true }))
    } finally {
      loading.current.delete(n)
    }
  }, [total])

  /**
   * Previews are a separate, much lighter fetch than the page itself. Loading
   * them independently keeps the navigator usable on a long guide without
   * pulling a full-resolution page for every row.
   */
  const loadThumb = useCallback(
    async (n: number) => {
      if (n < 1 || n > total) return
      if (thumbsRef.current[n] || loadingThumbs.current.has(n)) return
      loadingThumbs.current.add(n)
      try {
        if (abortController.current.signal.aborted) {
          abortController.current = new AbortController()
        }
        const url = await fetchThumb(n, abortController.current.signal)
        setThumbs((prev) => {
          if (prev[n]) {
            URL.revokeObjectURL(url)
            return prev
          }
          const next = { ...prev, [n]: url }
          const pages = Object.keys(next).map(Number)
          if (pages.length > MAX_CACHED_THUMBS) {
            const removable = pages
              .filter((page) => page !== n)
              .sort((a, b) => Math.abs(b - n) - Math.abs(a - n))
            while (
              Object.keys(next).length > MAX_CACHED_THUMBS &&
              removable.length
            ) {
              const page = removable.shift()!
              const oldUrl = next[page]
              delete next[page]
              window.setTimeout(() => URL.revokeObjectURL(oldUrl), 0)
            }
          }
          return next
        })
      } catch {
        // A guide rendered before previews existed simply has none; the
        // navigator falls back to showing the page number.
      } finally {
        loadingThumbs.current.delete(n)
      }
    },
    [total],
  )

  const jump = useCallback(
    (n: number, behavior: ScrollBehavior = 'smooth') => {
      const target = Math.min(total, Math.max(1, n))
      setCurrent(target)
      setPageDraft(String(target))
      void load(target)
      void load(target + 1)
      void load(target - 1)

      if (viewMode === 'continuous') {
        window.requestAnimationFrame(() => {
          pageRefs.current
            .get(target)
            ?.scrollIntoView({ behavior, block: 'start' })
        })
      } else {
        window.scrollTo({ top: 0, behavior })
      }
    },
    [load, total, viewMode],
  )

  const observerPageKey = viewMode === 'single' ? current : 0

  useEffect(() => {
    const nodes = [...pageRefs.current.entries()]
    if (!nodes.length) return

    const loader = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const n = Number((entry.target as HTMLElement).dataset.page)
          if (n) void load(n)
        }
      },
      { rootMargin: ROOT_MARGIN },
    )

    const tracker =
      viewMode === 'continuous'
        ? new IntersectionObserver(
            (entries) => {
              const visible = entries
                .filter((entry) => entry.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
              if (visible) {
                const n = Number((visible.target as HTMLElement).dataset.page)
                if (n) setCurrent(n)
              }
            },
            { threshold: [0.25, 0.6] },
          )
        : null

    for (const [, node] of nodes) {
      loader.observe(node)
      tracker?.observe(node)
    }
    return () => {
      loader.disconnect()
      tracker?.disconnect()
    }
  }, [load, observerPageKey, total, viewMode])

  useEffect(() => {
    if (total > 0) {
      void load(current)
      void load(current + 1)
    }
  }, [current, load, loadRevision, total])

  // Previews load only for the rows actually scrolled into the navigator.
  useEffect(() => {
    if (!sidebarOpen || sidebarTab !== 'pages') return
    const nodes = [...thumbRefs.current.values()]
    if (!nodes.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const n = Number((entry.target as HTMLElement).dataset.thumb)
          if (n) void loadThumb(n)
        }
      },
      { rootMargin: '400px 0px' },
    )
    for (const node of nodes) observer.observe(node)
    return () => observer.disconnect()
  }, [loadThumb, sidebarOpen, sidebarTab, total])

  useEffect(() => {
    let cancelled = false
    fetchOutline()
      .then((entries) => {
        if (!cancelled) setOutline(entries)
      })
      .catch(() => {
        /* Contents are optional; the PDF may carry no bookmarks. */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Debounced search. Each new query cancels the request still in flight.
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      searchAbort.current?.abort()
      setHits([])
      setSearching(false)
      setSearchRan(false)
      return
    }

    setSearching(true)
    const timer = window.setTimeout(() => {
      searchAbort.current?.abort()
      const controller = new AbortController()
      searchAbort.current = controller

      searchGuide(trimmed, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return
          setHits(result.hits)
          setSearchable(result.searchable)
          setSearchRan(true)
          setActiveHit(-1)
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setHits([])
          setSearchRan(true)
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false)
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [query])

  // Briefly mark a page the reader was sent to, so a jump is easy to follow.
  useEffect(() => {
    if (!flashPage) return
    const timer = window.setTimeout(() => setFlashPage(0), 1200)
    return () => window.clearTimeout(timer)
  }, [flashPage])

  useEffect(() => {
    setPageDraft(String(current))
    try {
      localStorage.setItem(resumeKey, String(current))
    } catch {
      /* Reading still works when storage is unavailable. */
    }
  }, [current, resumeKey])

  useEffect(() => {
    try {
      localStorage.setItem(bookmarkKey, JSON.stringify([...bookmarks].sort((a, b) => a - b)))
    } catch {
      /* Bookmarks are an optional browser-only convenience. */
    }
  }, [bookmarkKey, bookmarks])

  useEffect(() => {
    try {
      localStorage.setItem(notesKey, JSON.stringify(notes))
    } catch {
      /* Notes stay available for this session when storage is unavailable. */
    }
  }, [notes, notesKey])

  useEffect(() => {
    try {
      localStorage.setItem('tc-reader-theme', theme)
    } catch {
      /* Appearance preference is optional. */
    }
  }, [theme])

  useEffect(() => {
    const update = () => {
      setStudyMinutes(Math.floor((Date.now() - sessionStarted.current) / 60_000))
    }
    const timer = window.setInterval(update, 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const connected = () => {
      setOnline(true)
      setFailed({})
      setLoadRevision((value) => value + 1)
      setToast('Back online. Reloading your page')
    }
    const disconnected = () => setOnline(false)
    window.addEventListener('online', connected)
    window.addEventListener('offline', disconnected)
    return () => {
      window.removeEventListener('online', connected)
      window.removeEventListener('offline', disconnected)
    }
  }, [])

  useEffect(() => {
    if (current <= 1) return
    const timer = window.setTimeout(
      () => setToast(`Welcome back. Resumed at page ${current}`),
      500,
    )
    return () => window.clearTimeout(timer)
    // Only announce the restored page on initial mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (current !== total || completionShown.current) return
    completionShown.current = true
    setToast('You reached the end of this guide. Great work!')
  }, [current, total])

  useEffect(
    () => {
      mounted.current = true
      return () => {
        mounted.current = false
        abortController.current.abort()
        searchAbort.current?.abort()
        for (const url of Object.values(urlsRef.current)) URL.revokeObjectURL(url)
        for (const url of Object.values(thumbsRef.current)) URL.revokeObjectURL(url)
      }
    },
    [],
  )

  const openSearch = useCallback(() => {
    setSidebarOpen(true)
    setSidebarTab('search')
    setNotesOpen(false)
    // The panel animates in, so focus after it exists.
    window.requestAnimationFrame(() => searchInput.current?.focus())
  }, [])

  const goToHit = useCallback(
    (index: number) => {
      const hit = hits[index]
      if (!hit) return
      setActiveHit(index)
      setFlashPage(hit.page)
      jump(hit.page)
    },
    [hits, jump],
  )

  const toggleBookmark = useCallback(() => {
    const removing = bookmarks.has(current)
    setBookmarks((prev) => {
      const next = new Set(prev)
      if (next.has(current)) next.delete(current)
      else next.add(current)
      return next
    })
    setToast(removing ? `Bookmark removed from page ${current}` : `Page ${current} bookmarked`)
  }, [bookmarks, current])

  const cycleTheme = useCallback(() => {
    setTheme((value) =>
      value === 'cloud' ? 'paper' : value === 'paper' ? 'midnight' : 'cloud',
    )
  }, [])

  const updateCurrentNote = (value: string) => {
    setNotes((prev) => {
      const next = { ...prev }
      if (value.trim()) next[current] = value.slice(0, 4000)
      else delete next[current]
      return next
    })
  }

  const enterFocusMode = () => {
    setSidebarOpen(false)
    setNotesOpen(false)
    setShowTips(false)
    setFocusMode(true)
  }

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      /* Fullscreen may be unavailable in embedded or older mobile browsers. */
    }
  }, [])

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  useEffect(() => {
    const stop = (e: Event) => e.preventDefault()

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      const target = e.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'

      // Take over the browser's find bar: it can only search the page chrome,
      // never the guide, so pointing it at our own search is strictly better.
      if ((e.ctrlKey || e.metaKey) && k === 'f') {
        e.preventDefault()
        openSearch()
        return
      }
      if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'u', 'a', 'c'].includes(k)) {
        e.preventDefault()
      }
      if (e.key === 'F12') e.preventDefault()
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(k)) {
        e.preventDefault()
      }
      if (e.key === 'PrintScreen') {
        navigator.clipboard?.writeText('').catch(() => undefined)
      }
      if (e.key === 'Escape') {
        setFocusMode(false)
        setSidebarOpen(false)
        setNotesOpen(false)
        setShowTips(false)
        setShowSignOut(false)
        return
      }
      // Enter steps through results while the search box has focus.
      if (typing && e.key === 'Enter' && hits.length) {
        e.preventDefault()
        goToHit(e.shiftKey ? Math.max(0, activeHit - 1) : activeHit + 1 >= hits.length ? 0 : activeHit + 1)
        return
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return

      if (e.key === '/') {
        e.preventDefault()
        openSearch()
        return
      }

      if (
        ['ArrowRight', 'PageDown'].includes(e.key) ||
        (viewMode === 'single' && e.key === 'ArrowDown')
      ) {
        e.preventDefault()
        jump(current + 1)
      } else if (
        ['ArrowLeft', 'PageUp'].includes(e.key) ||
        (viewMode === 'single' && e.key === 'ArrowUp')
      ) {
        e.preventDefault()
        jump(current - 1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        jump(1)
      } else if (e.key === 'End') {
        e.preventDefault()
        jump(total)
      } else if (k === 'b') {
        toggleBookmark()
      } else if (k === 'f') {
        void toggleFullscreen()
      } else if (k === 'm') {
        setViewMode((mode) => (mode === 'continuous' ? 'single' : 'continuous'))
      } else if (k === 'n') {
        setNotesOpen((open) => !open)
      } else if (k === 't') {
        cycleTheme()
      } else if (['+', '='].includes(e.key)) {
        setFitWidth(false)
        setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP))
      } else if (e.key === '-') {
        setFitWidth(false)
        setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP))
      }
    }

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
  }, [
    activeHit,
    current,
    cycleTheme,
    goToHit,
    hits.length,
    jump,
    openSearch,
    toggleBookmark,
    toggleFullscreen,
    total,
    viewMode,
  ])

  const zoomBy = (amount: number) => {
    setFitWidth(false)
    setZoom((value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value + amount)))
  }

  const submitPage = (e: React.FormEvent) => {
    e.preventDefault()
    const page = Number(pageDraft)
    if (Number.isInteger(page)) jump(page)
    else setPageDraft(String(current))
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
              shortly. Your access is already saved on this device.
            </p>
            <button className="btn btn-ghost" onClick={() => location.reload()}>
              Refresh
            </button>
          </div>
        </div>
      </div>
    )
  }

  const pageNumbers =
    viewMode === 'single'
      ? [current]
      : Array.from({ length: total }, (_, index) => index + 1)
  const progress = Math.round((current / total) * 100)
  const notedPages = Object.keys(notes)
    .map(Number)
    .filter((page) => notes[page]?.trim())
    .sort((a, b) => a - b)
  const themeLabel =
    theme === 'cloud' ? 'Cloud' : theme === 'paper' ? 'Warm paper' : 'Midnight'

  const toggleZoom = () => {
    if (fitWidth) {
      setFitWidth(false)
      setZoom(160)
    } else {
      setFitWidth(true)
      setZoom(100)
    }
  }

  const startTouch = (event: React.TouchEvent) => {
    if (event.touches.length === 2) {
      // Two fingers down: begin a pinch and stop tracking the swipe.
      touchStart.current = null
      pinch.current = {
        distance: distanceBetween(event.touches[0], event.touches[1]),
        zoom: fitWidth ? 100 : zoom,
      }
      return
    }
    const touch = event.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }

  const moveTouch = (event: React.TouchEvent) => {
    const start = pinch.current
    if (!start || event.touches.length !== 2) return
    const distance = distanceBetween(event.touches[0], event.touches[1])
    if (!start.distance) return
    // The browser would otherwise pinch-zoom the whole page chrome with it.
    event.preventDefault()
    const next = Math.round((start.zoom * distance) / start.distance)
    setFitWidth(false)
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)))
  }

  const finishSwipe = (event: React.TouchEvent) => {
    if (pinch.current) {
      // Wait for both fingers to leave before swipes count again.
      if (event.touches.length === 0) pinch.current = null
      touchStart.current = null
      return
    }

    const start = touchStart.current
    touchStart.current = null

    // Double-tap zooms, matching the desktop double-click.
    const now = Date.now()
    if (start && now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0
      toggleZoom()
      return
    }
    lastTap.current = now

    if (!start || viewMode !== 'single' || !fitWidth) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) < 58 || Math.abs(dx) < Math.abs(dy) * 1.25) return
    jump(dx < 0 ? current + 1 : current - 1)
  }

  const outlineRows = flattenOutline(outline)

  const commitScrub = (page = scrubPage) => {
    if (page !== null) jump(page, 'auto')
    setScrubPage(null)
  }

  return (
    <div
      className={[
        'reader',
        veiled ? 'veiled' : '',
        sidebarOpen ? 'sidebar-open' : '',
        notesOpen ? 'notes-open' : '',
        focusMode ? 'focus-mode' : '',
        `theme-${theme}`,
      ].filter(Boolean).join(' ')}
      style={{ '--reader-scale': zoom / 100 } as React.CSSProperties}
    >
      <header className="reader-bar">
        <div className="reader-primary">
          <button
            className={`icon-btn${sidebarOpen ? ' active' : ''}`}
            title="Open page navigator"
            aria-label="Open page navigator"
            aria-expanded={sidebarOpen}
            aria-pressed={sidebarOpen}
            aria-controls="reader-pages-panel"
            onClick={() => setSidebarOpen((open) => !open)}
          >
            <MenuIcon size={18} />
          </button>

          <div className="reader-brand" aria-hidden="true">
            <img src="/tc-icon.png" alt="" />
          </div>

          <div className="reader-title">
            <div className="reader-course">{guide.courseCode}</div>
            <div className="reader-name">{guide.title}</div>
          </div>

          <div className="reader-security">
            <span className="security-dot" />
            Protected copy
          </div>

          <button
            className={`icon-btn${bookmarks.has(current) ? ' active' : ''}`}
            title={bookmarks.has(current) ? 'Remove bookmark' : 'Bookmark this page'}
            aria-label={bookmarks.has(current) ? 'Remove bookmark' : 'Bookmark this page'}
            aria-pressed={bookmarks.has(current)}
            onClick={toggleBookmark}
          >
            <BookmarkIcon size={17} filled={bookmarks.has(current)} />
          </button>

          <button
            className="icon-btn reader-exit"
            title="Sign out on this device"
            aria-label="Sign out on this device"
            onClick={() => setShowSignOut(true)}
          >
            <ExitIcon size={17} />
          </button>
        </div>

        <div className="reader-tools" role="toolbar" aria-label="Reader tools">
          <div className="tool-group">
            <button
              className="tool-btn"
              onClick={() => zoomBy(-ZOOM_STEP)}
              disabled={!fitWidth && zoom <= MIN_ZOOM}
              title="Zoom out"
              aria-label="Zoom out"
            >
              <MinusIcon size={16} />
            </button>
            <span className="zoom-label">{fitWidth ? 'Fit' : `${zoom}%`}</span>
            <button
              className="tool-btn"
              onClick={() => zoomBy(ZOOM_STEP)}
              disabled={!fitWidth && zoom >= MAX_ZOOM}
              title="Zoom in"
              aria-label="Zoom in"
            >
              <PlusIcon size={16} />
            </button>
            <button
              className={`tool-btn${fitWidth ? ' selected' : ''}`}
              onClick={() => {
                setFitWidth(true)
                setZoom(100)
              }}
              title="Fit page to width"
              aria-label="Fit page to width"
              aria-pressed={fitWidth}
            >
              <FitIcon size={16} />
            </button>
          </div>

          <div className="tool-group">
            <button
              className={`tool-btn${viewMode === 'continuous' ? ' selected' : ''}`}
              onClick={() => setViewMode('continuous')}
              title="Continuous reading"
              aria-label="Continuous reading"
              aria-pressed={viewMode === 'continuous'}
            >
              <PagesIcon size={16} />
            </button>
            <button
              className={`tool-btn${viewMode === 'single' ? ' selected' : ''}`}
              onClick={() => setViewMode('single')}
              title="Single-page reading"
              aria-label="Single-page reading"
              aria-pressed={viewMode === 'single'}
            >
              <SinglePageIcon size={16} />
            </button>
          </div>

          <div className="tool-group">
            <button
              className={`tool-btn${sidebarOpen && sidebarTab === 'search' ? ' selected' : ''}`}
              onClick={openSearch}
              title="Search this guide"
              aria-label="Search this guide"
            >
              <SearchIcon size={16} />
            </button>
            <button
              className="tool-btn"
              onClick={cycleTheme}
              title={`Reading background: ${themeLabel}`}
              aria-label={`Reading background: ${themeLabel}. Change theme`}
            >
              <ThemeIcon size={16} theme={theme} />
            </button>
            <button
              className={`tool-btn tool-with-badge${notesOpen ? ' selected' : ''}`}
              onClick={() => {
                setNotesOpen((open) => !open)
                setSidebarOpen(false)
              }}
              title="Study notes"
              aria-label={`Study notes, ${notedPages.length} saved`}
              aria-pressed={notesOpen}
              aria-controls="reader-notes-panel"
            >
              <NotesIcon size={16} />
              {notedPages.length > 0 && <span>{notedPages.length}</span>}
            </button>
            <button
              className={`tool-btn${focusMode ? ' selected' : ''}`}
              onClick={enterFocusMode}
              title="Focus mode"
              aria-label="Enter focus mode"
              aria-pressed={focusMode}
            >
              <FocusIcon size={16} />
            </button>
          </div>

          <button
            className={`tool-btn standalone${fullscreen ? ' selected' : ''}`}
            onClick={() => void toggleFullscreen()}
            title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            aria-pressed={fullscreen}
          >
            <FullscreenIcon size={16} active={fullscreen} />
          </button>

          <button
            className="shortcuts-btn"
            onClick={() => setShowTips((show) => !show)}
            aria-expanded={showTips}
          >
            Shortcuts
          </button>
        </div>

        <div
          className="reader-progress"
          role="progressbar"
          aria-label="Reading progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span style={{ width: `${progress}%` }} />
        </div>

        {showTips && (
          <div className="shortcuts-popover" role="dialog" aria-label="Reader shortcuts">
            <strong>Reader shortcuts</strong>
            <span><kbd>←</kbd><kbd>→</kbd> Change page</span>
            <span><kbd>+</kbd><kbd>−</kbd> Zoom</span>
            <span><kbd>/</kbd> Search</span>
            <span><kbd>Enter</kbd> Next match</span>
            <span><kbd>B</kbd> Bookmark</span>
            <span><kbd>M</kbd> Change view</span>
            <span><kbd>N</kbd> Study notes</span>
            <span><kbd>T</kbd> Change theme</span>
            <span><kbd>F</kbd> Fullscreen</span>
            <span><kbd>Esc</kbd> Close panels</span>
          </div>
        )}
      </header>

      {!online && (
        <div className="connection-banner" role="status">
          <span />
          You are offline. Pages already loaded remain available.
        </div>
      )}

      <button
        type="button"
        className={`reader-scrim${sidebarOpen ? ' visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-label="Close page navigator"
        tabIndex={sidebarOpen ? 0 : -1}
      />

      <aside
        id="reader-pages-panel"
        className={`reader-sidebar${sidebarOpen ? ' open' : ''}`}
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
      >
        <div className="sidebar-heading">
          <div>
            <span>{guide.courseCode}</span>
            <small>{total} pages</small>
          </div>
          <button
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close page navigator"
          >
            ×
          </button>
        </div>

        <div className="sidebar-tabs" role="tablist" aria-label="Guide navigation">
          {([
            ['contents', 'Contents', ContentsIcon],
            ['pages', 'Pages', PagesIcon],
            ['search', 'Search', SearchIcon],
          ] as const).map(([tab, label, Icon]) => (
            <button
              key={tab}
              role="tab"
              id={`sidebar-tab-${tab}`}
              aria-selected={sidebarTab === tab}
              aria-controls={`sidebar-panel-${tab}`}
              className={sidebarTab === tab ? 'selected' : ''}
              onClick={() => {
                setSidebarTab(tab)
                if (tab === 'search') {
                  window.requestAnimationFrame(() => searchInput.current?.focus())
                }
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {bookmarks.size > 0 && sidebarTab === 'pages' && (
          <div className="bookmark-strip">
            <span>Bookmarks</span>
            <div>
              {[...bookmarks].sort((a, b) => a - b).map((page) => (
                <button key={page} onClick={() => jump(page)}>
                  {page}
                </button>
              ))}
            </div>
          </div>
        )}

        {sidebarTab === 'contents' && (
          <div
            className="outline-list"
            id="sidebar-panel-contents"
            role="tabpanel"
            aria-labelledby="sidebar-tab-contents"
          >
            {outlineRows.length === 0 ? (
              <div className="sidebar-empty">
                <ContentsIcon size={24} />
                <strong>No contents</strong>
                <span>
                  This guide's PDF doesn't include chapter bookmarks. Use Pages
                  or Search to move around.
                </span>
              </div>
            ) : (
              outlineRows.map(({ entry, depth }, index) => (
                <button
                  key={`${entry.page}-${index}`}
                  className={`outline-row${entry.page === current ? ' current' : ''}`}
                  style={{ paddingLeft: 14 + depth * 14 }}
                  onClick={() => {
                    setFlashPage(entry.page)
                    jump(entry.page)
                    if (window.matchMedia('(max-width: 760px)').matches) {
                      setSidebarOpen(false)
                    }
                  }}
                >
                  <span className="outline-title">{entry.title}</span>
                  <span className="outline-page">{entry.page}</span>
                </button>
              ))
            )}
          </div>
        )}

        {sidebarTab === 'pages' && (
          <div
            className="thumbnail-list"
            id="sidebar-panel-pages"
            role="tabpanel"
            aria-labelledby="sidebar-tab-pages"
          >
            {Array.from({ length: total }, (_, index) => index + 1).map((page) => (
              <button
                key={page}
                data-thumb={page}
                ref={(element) => {
                  if (element) thumbRefs.current.set(page, element)
                  else thumbRefs.current.delete(page)
                }}
                className={`thumbnail${page === current ? ' current' : ''}`}
                onClick={() => {
                  jump(page)
                  if (window.matchMedia('(max-width: 760px)').matches) {
                    setSidebarOpen(false)
                  }
                }}
              >
                <span className="thumbnail-preview">
                  {thumbs[page] ?? urls[page] ? (
                    <img
                      src={thumbs[page] ?? urls[page]}
                      alt=""
                      draggable={false}
                      loading="lazy"
                    />
                  ) : (
                    <span>{page}</span>
                  )}
                  {bookmarks.has(page) && (
                    <span className="thumbnail-bookmark">
                      <BookmarkIcon size={10} filled />
                    </span>
                  )}
                </span>
                <span className="thumbnail-label">Page {page}</span>
              </button>
            ))}
          </div>
        )}

        {sidebarTab === 'search' && (
          <div
            className="search-panel"
            id="sidebar-panel-search"
            role="tabpanel"
            aria-labelledby="sidebar-tab-search"
          >
            <div className="search-box">
              <SearchIcon size={15} />
              <input
                ref={searchInput}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search this guide..."
                aria-label="Search this guide"
                type="search"
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Clear search">
                  ×
                </button>
              )}
            </div>

            <div className="search-status">
              {searching
                ? 'Searching...'
                : searchable === false
                  ? 'This guide is scanned, so its text cannot be searched.'
                  : hits.length > 0
                    ? `${hits.length} match${hits.length === 1 ? '' : 'es'}${
                        activeHit >= 0 ? ` · showing ${activeHit + 1}` : ''
                      }`
                    : searchRan
                      ? 'No matches'
                      : 'Type at least two characters'}
            </div>

            <div className="search-results">
              {hits.map((hit, index) => (
                <button
                  key={`${hit.page}-${index}`}
                  className={`search-hit${index === activeHit ? ' current' : ''}`}
                  onClick={() => {
                    goToHit(index)
                    if (window.matchMedia('(max-width: 760px)').matches) {
                      setSidebarOpen(false)
                    }
                  }}
                >
                  <span className="search-hit-page">Page {hit.page}</span>
                  <span className="search-hit-text">
                    {hit.snippet.slice(0, hit.from)}
                    <mark>{hit.snippet.slice(hit.from, hit.to)}</mark>
                    {hit.snippet.slice(hit.to)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="sidebar-license">
          <span>Licensed to</span>
          <strong>{buyer.name}</strong>
          <small>{buyer.phone}</small>
        </div>
      </aside>

      <button
        type="button"
        className={`notes-scrim${notesOpen ? ' visible' : ''}`}
        onClick={() => setNotesOpen(false)}
        aria-label="Close study notes"
        tabIndex={notesOpen ? 0 : -1}
      />

      <aside
        id="reader-notes-panel"
        className={`reader-notes${notesOpen ? ' open' : ''}`}
        aria-label="Study notes"
        aria-hidden={!notesOpen}
        inert={!notesOpen}
      >
        <div className="notes-heading">
          <div>
            <span>Study notes</span>
            <small>Saved in this browser</small>
          </div>
          <button onClick={() => setNotesOpen(false)} aria-label="Close study notes">
            ×
          </button>
        </div>

        <div className="notes-current">
          <div className="notes-page-label">
            <span>Page {current}</span>
            <span>{(notes[current] ?? '').length} / 4000</span>
          </div>
          <textarea
            value={notes[current] ?? ''}
            onChange={(e) => updateCurrentNote(e.target.value)}
            placeholder="Write a formula, reminder, or key idea from this page..."
            maxLength={4000}
            rows={8}
          />
          <div className="notes-saved">
            <span className="security-dot" />
            Notes save automatically on this device
          </div>
        </div>

        <div className="notes-list-heading">
          <span>Notes in this guide</span>
          <strong>{notedPages.length}</strong>
        </div>

        <div className="notes-list">
          {notedPages.length === 0 ? (
            <div className="notes-empty">
              <NotesIcon size={24} />
              <strong>No notes yet</strong>
              <span>Add a note while reading and it will appear here.</span>
            </div>
          ) : (
            notedPages.map((page) => (
              <button
                className={`note-card${page === current ? ' current' : ''}`}
                key={page}
                onClick={() => jump(page)}
              >
                <span>Page {page}</span>
                <p>{notes[page]}</p>
              </button>
            ))
          )}
        </div>

        <div className="study-session">
          <div>
            <span>Current study session</span>
            <strong>{studyMinutes < 1 ? 'Just started' : `${studyMinutes} min`}</strong>
          </div>
          <div>
            <span>Guide progress</span>
            <strong>{progress}%</strong>
          </div>
        </div>
        <div className="reader-support">
          <span>Having an access issue?</span>
          <div>
            {SUPPORT_WHATSAPP && (
              <a
                href={`https://wa.me/${SUPPORT_WHATSAPP.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
            )}
            <a href={`mailto:${SUPPORT_EMAIL}`}>Email support</a>
          </div>
        </div>
      </aside>

      <main
        className="reader-stage"
        onTouchStart={startTouch}
        onTouchMove={moveTouch}
        onTouchEnd={finishSwipe}
        onDoubleClick={toggleZoom}
      >
        <div
          className={[
            'pages',
            fitWidth ? 'fit-width' : 'manual-zoom',
            viewMode === 'single' ? 'single-page' : 'continuous',
          ].join(' ')}
        >
          {pageNumbers.map((n) => (
            <div
              className={`page-wrap${n === flashPage ? ' flash' : ''}`}
              key={n}
              data-page={n}
              ref={(element) => {
                if (element) pageRefs.current.set(n, element)
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
                    <div className="page-error">
                      <strong>Page {n} could not load</strong>
                      <button
                        className="top-help"
                        onClick={() => {
                          setFailed((state) => {
                            const next = { ...state }
                            delete next[n]
                            return next
                          })
                          void load(n)
                        }}
                      >
                        Try again
                      </button>
                    </div>
                  ) : (
                    <div className="page-loading">
                      <span className="mini-spinner" />
                      Loading page {n}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      <div className="page-scrubber">
        <span>Page</span>
        <input
          type="range"
          min={1}
          max={total}
          step={1}
          value={scrubPage ?? current}
          aria-label="Quickly move through guide pages"
          onChange={(e) => setScrubPage(Number(e.target.value))}
          onPointerUp={(e) => commitScrub(Number(e.currentTarget.value))}
          onTouchEnd={(e) => commitScrub(Number(e.currentTarget.value))}
          onKeyUp={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
              commitScrub(Number(e.currentTarget.value))
            }
          }}
          onBlur={() => commitScrub()}
          style={{
            '--scrub-progress': `${(((scrubPage ?? current) - 1) / Math.max(1, total - 1)) * 100}%`,
          } as React.CSSProperties}
        />
        <output>{scrubPage ?? current}</output>
      </div>

      <nav className="pager" aria-label="Page navigation">
        <button
          onClick={() => jump(current - 1)}
          disabled={current <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={17} />
        </button>
        <form className="page-jump" onSubmit={submitPage}>
          <input
            aria-label="Current page"
            inputMode="numeric"
            value={pageDraft}
            onChange={(e) => setPageDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onBlur={() => setPageDraft(String(current))}
          />
          <span>/ {total}</span>
        </form>
        <button
          onClick={() => jump(current + 1)}
          disabled={current >= total}
          aria-label="Next page"
        >
          <ChevronRight size={17} />
        </button>
      </nav>

      {focusMode && (
        <div className="focus-dock">
          <span>
            <strong>{guide.courseCode}</strong>
            Page {current} of {total}
          </span>
          <button onClick={() => setFocusMode(false)}>
            <FocusIcon size={15} /> Exit focus
          </button>
        </div>
      )}

      <div
        className={`reader-toast${toast ? ' show' : ''}`}
        role="status"
        aria-live="polite"
      >
        {toast && (
          <>
            <span>✓</span>
            {toast}
          </>
        )}
      </div>

      {showSignOut && (
        <div className="reader-dialog-backdrop" role="presentation">
          <div
            className="reader-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="signout-title"
          >
            <div className="dialog-icon">
              <ExitIcon size={21} />
            </div>
            <h2 id="signout-title">Leave this guide?</h2>
            <p>
              Signing out removes the saved access from this browser. You will
              need your original code or help from support to open it again.
            </p>
            <div className="dialog-actions">
              <button className="dialog-cancel" onClick={() => setShowSignOut(false)}>
                Keep reading
              </button>
              <button
                className="dialog-confirm"
                onClick={() => {
                  setShowSignOut(false)
                  onLock()
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {accessError && (
        <div className="reader-dialog-backdrop access-dialog-backdrop">
          <div
            className="reader-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="access-error-title"
          >
            <div className="dialog-icon access-dialog-icon">!</div>
            <h2 id="access-error-title">Your access needs attention</h2>
            <p>
              {accessError} Return to the access screen to try your code again or
              contact Tutor Connect support.
            </p>
            <div className="dialog-actions">
              <a className="dialog-cancel dialog-link" href={`mailto:${SUPPORT_EMAIL}`}>
                Contact support
              </a>
              <button className="dialog-confirm" onClick={onLock}>
                Return to access
              </button>
            </div>
          </div>
        </div>
      )}

      {veiled && (
        <div className="veil" onClick={() => setVeiled(false)}>
          <div className="veil-lock">TC</div>
          <div className="veil-title">Your guide is protected</div>
          <div className="veil-sub">
            Content is hidden while this tab is in the background. Tap to continue
            reading.
          </div>
          <div className="veil-sub veil-license">
            Licensed to {buyer.name} · {buyer.phone}
          </div>
        </div>
      )}
    </div>
  )
}
