import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import './Sessions.css';


/*
Note:
NS_BINDING_ABORTED error when switching to sessions page within networks is expected,
due to strictMode of react dev mode, mount fires twice causing this.
*/


/*
TODOS:

update tab buttons to improve visuals 

cont monitor slow requests times >2000ms delays,
db should be fine, issue might be with rendering and fetching requests,
mostly with redundant fetch 
*/

interface Session {
  SessionID: number;
  sessionStart: string;
  sessionEnd: string | null;
  sessionName: string;
  sessionDescription: string | null;
  avgFocus: number;
  activeDuration: number;
  sessionFeedback: string | null;
}

interface SessionChunk {
  ChunkId: number;
  chunkStatus: 'VF' | 'SF' | 'SU' | 'VU';
  endOfChunk: string;
}

interface Folder {
  FolderID: number;
  folderName: string;
  folderDescription: string | null;
  sessionCount: number;
}

type SortBy = 'date' | 'duration';
type SortDir = 'ASC' | 'DESC';
type Layout = 'list' | 'grid';
type Tab = 'sessions' | 'folders';
type SessionModalType = 'rename' | 'description' | 'delete';
type FolderModalType = 'create' | 'rename' | 'description' | 'delete';

const calcTotalDuration = (start: string, end: string | null | undefined, activeDuration?: number): string => {
  if (!end) return 'In progress';

  let totalSecs: number;
  if ((activeDuration ?? 0) > 0) {
    totalSecs = activeDuration!;
  } else {
    const toSeconds = (str: string) => {
      const normalized = str.replace(' ', 'T');
      const [datePart, timePart] = normalized.split('T');
      if (!timePart) return 0;
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes, seconds] = timePart.split('.')[0].split(':').map(Number);
      return new Date(year, month - 1, day, hours, minutes, seconds).getTime() / 1000;
    };
    totalSecs = Math.floor(toSeconds(end) - toSeconds(start));
  }

  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const formatDateTime = (dateStr: string | null | undefined) => {
  if (!dateStr) return { date: '—', time: '—' };
  const [datePart, timePart] = dateStr.replace(' ', 'T').split('T');
  if (!timePart) return { date: datePart, time: '—' };
  const [year, month, day] = datePart.split('-');
  const [hours, minutes, seconds] = timePart.split('.')[0].split(':');

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;

  return {
    date: `${monthNames[parseInt(month) - 1]} ${parseInt(day)}, ${year}`,
    time: `${String(h12).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`,
  };
};

//Number of sessions per page for pagination
const LIMIT = 6;

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="sessions-search-icon">
    <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="9.5" y1="9.5" x2="13.5" y2="13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2.5 4.5L4.5 6.5L6.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="8.5" y1="5.5" x2="13.5" y2="5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <line x1="2.5" y1="8" x2="13.5" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <line x1="2.5" y1="10.5" x2="13.5" y2="10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="9" y="2" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="2" y="9" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="9" y="9" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4"/>
  </svg>
);

const DotsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="3.5" r="1.2" fill="currentColor"/>
    <circle cx="8" cy="8" r="1.2" fill="currentColor"/>
    <circle cx="8" cy="12.5" r="1.2" fill="currentColor"/>
  </svg>
);

const ChartIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="9" width="3" height="6" rx="1" fill="currentColor"/>
    <rect x="6" y="5" width="3" height="10" rx="1" fill="currentColor"/>
    <rect x="11" y="1" width="3" height="14" rx="1" fill="currentColor"/>
  </svg>
);

const CHUNK_COLORS: Record<string, string> = {
  VF: '#1a7a1a',
  SF: '#7ec850',
  SU: '#e8c32a',
  VU: '#d94040',
};

const CHUNK_LABELS = ['VF', 'SF', 'SU', 'VU'] as const;

const Sessions = () => {
  const { user, sessionTrigger } = useAuth();
  const location = useLocation();
  const API_URL = import.meta.env.VITE_API_URL;

  // Sessions state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [inputValue, setInputValue] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortDir, setSortDir] = useState<SortDir>('DESC');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [layout, setLayout] = useState<Layout>('list');
  const [refreshTick, setRefreshTick] = useState(0);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [sessionModal, setSessionModal] = useState<{ type: SessionModalType; session: Session } | null>(null);
  const [modalInput, setModalInput] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [chunksModal, setChunksModal] = useState<{ session: Session } | null>(null);
  const [modalChunks, setModalChunks] = useState<SessionChunk[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);

  //Tab state, initialised from navigation state to avoid a second render/double-fetch on mount
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const state = location.state as { tab?: Tab } | null;
    return state?.tab === 'folders' ? 'folders' : 'sessions';
  });

  //Folder state
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderDetail, setActiveFolderDetail] = useState<Folder | null>(null);
  const [folderRefreshTick, setFolderRefreshTick] = useState(0);
  const [folderMenuOpenId, setFolderMenuOpenId] = useState<number | null>(null);
  const [folderModal, setFolderModal] = useState<{ type: FolderModalType; folder?: Folder } | null>(null);
  const [folderNameInput, setFolderNameInput] = useState('');
  const [folderDescInput, setFolderDescInput] = useState('');
  const [folderModalLoading, setFolderModalLoading] = useState(false);

  //Folder picker state
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [pickerTargetSession, setPickerTargetSession] = useState<Session | null>(null);
  const [pickerSelectedIds, setPickerSelectedIds] = useState<Set<number>>(new Set());
  const [pickerOriginalIds, setPickerOriginalIds] = useState<Set<number>>(new Set());
  const [pickerLoading, setPickerLoading] = useState(false);

  //Folder search state
  const [folderSearch, setFolderSearch] = useState('');

  //Session picker state (add sessions to folder from folder detail view)
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [sessionPickerSessions, setSessionPickerSessions] = useState<Session[]>([]);
  const [sessionPickerSelected, setSessionPickerSelected] = useState<Set<number>>(new Set());
  const [sessionPickerOriginal, setSessionPickerOriginal] = useState<Set<number>>(new Set());
  const [sessionPickerLoading, setSessionPickerLoading] = useState(false);

  //Debounce search input, reduce API calls by only setting search state 350ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(inputValue);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [inputValue]);

  //Fetch sessions (sessions tab or folder detail view)
  useEffect(() => {
    if (!user) return;
    if (activeTab === 'folders' && !activeFolderDetail) return;
    const controller = new AbortController();
    setIsLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(LIMIT),
      sortBy,
      sortDir,
      search,
    });
    const url = activeFolderDetail
      ? `${API_URL}/folders/${activeFolderDetail.FolderID}/sessions?${params}`
      : `${API_URL}/sessions/paginated/${user.userId}?${params}`;
    fetch(url, { credentials: 'include', signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setSessions(data.sessions);
          setTotal(data.total);
        }
      })
      .catch(err => { if (err.name !== 'AbortError') console.error('Sessions fetch error:', err); })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    return () => controller.abort();
  }, [user, page, search, sortBy, sortDir, sessionTrigger, refreshTick, activeFolderDetail, activeTab]);

  //Fetch folders (always kept fresh for picker and folder tab)
  //activeTab intentionally excluded — folders don't change on tab switch
  useEffect(() => {
    if (!user) return;
    fetch(`${API_URL}/folders/${user.userId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (data.success) setFolders(data.folders); })
      .catch(err => console.error('Folders fetch error:', err));
  }, [user, folderRefreshTick]);

  //Close session dropdown on outside click
  useEffect(() => {
    if (menuOpenId === null) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.session-menu-wrapper')) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpenId]);

  //Close folder dropdown on outside click
  useEffect(() => {
    if (folderMenuOpenId === null) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.session-menu-wrapper')) {
        setFolderMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [folderMenuOpenId]);

  const handleSort = (field: SortBy) => {
    if (field === sortBy) {
      setSortDir(prev => (prev === 'DESC' ? 'ASC' : 'DESC'));
    } else {
      setSortBy(field);
      setSortDir('DESC');
    }
    setPage(1);
  };

  const handleExpand = (index: number) => {
    setExpandedIndex(prev => (prev === index ? null : index));
  };

  const handleDeleteSession = async () => {
    if (!sessionModal) return;
    setModalLoading(true);
    try {
      await fetch(`${API_URL}/sessions/${sessionModal.session.SessionID}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setSessionModal(null);
      setRefreshTick(t => t + 1);
      setFolderRefreshTick(t => t + 1);
    } catch (err) {
      console.error('Delete session error:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdateSession = async () => {
    if (!sessionModal) return;
    setModalLoading(true);
    const updated = {
      sessionName: sessionModal.type === 'rename' ? modalInput : sessionModal.session.sessionName,
      sessionDescription: sessionModal.type === 'description' ? modalInput : sessionModal.session.sessionDescription,
    };
    try {
      await fetch(`${API_URL}/sessions/${sessionModal.session.SessionID}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      setSessionModal(null);
      setRefreshTick(t => t + 1);
    } catch (err) {
      console.error('Update session error:', err);
    } finally {
      setModalLoading(false);
    }
  };

  //Folder handlers

  const handleCreateFolder = async () => {
    if (!user || !folderNameInput.trim()) return;
    setFolderModalLoading(true);
    try {
      await fetch(`${API_URL}/folders`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId,
          folderName: folderNameInput.trim(),
          folderDescription: folderDescInput.trim() || null,
        }),
      });
      setFolderModal(null);
      setFolderRefreshTick(t => t + 1);
    } catch (err) {
      console.error('Create folder error:', err);
    } finally {
      setFolderModalLoading(false);
    }
  };

  const handleRenameFolder = async () => {
    if (!folderModal?.folder || !folderNameInput.trim()) return;
    setFolderModalLoading(true);
    try {
      await fetch(`${API_URL}/folders/${folderModal.folder.FolderID}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderName: folderNameInput.trim() }),
      });
      if (activeFolderDetail?.FolderID === folderModal.folder.FolderID) {
        setActiveFolderDetail(f => f ? { ...f, folderName: folderNameInput.trim() } : null);
      }
      setFolderModal(null);
      setFolderRefreshTick(t => t + 1);
    } catch (err) {
      console.error('Rename folder error:', err);
    } finally {
      setFolderModalLoading(false);
    }
  };

  const handleUpdateFolderDescription = async () => {
    if (!folderModal?.folder) return;
    setFolderModalLoading(true);
    const newDesc = folderDescInput.trim() || null;
    try {
      await fetch(`${API_URL}/folders/${folderModal.folder.FolderID}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderDescription: newDesc }),
      });
      if (activeFolderDetail?.FolderID === folderModal.folder.FolderID) {
        setActiveFolderDetail(f => f ? { ...f, folderDescription: newDesc } : null);
      }
      setFolderModal(null);
      setFolderRefreshTick(t => t + 1);
    } catch (err) {
      console.error('Update folder description error:', err);
    } finally {
      setFolderModalLoading(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!folderModal?.folder) return;
    setFolderModalLoading(true);
    try {
      await fetch(`${API_URL}/folders/${folderModal.folder.FolderID}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (activeFolderDetail?.FolderID === folderModal.folder.FolderID) {
        setActiveFolderDetail(null);
        setPage(1);
      }
      setFolderModal(null);
      setFolderRefreshTick(t => t + 1);
    } catch (err) {
      console.error('Delete folder error:', err);
    } finally {
      setFolderModalLoading(false);
    }
  };

  const handleRemoveFromFolder = async (session: Session) => {
    if (!activeFolderDetail) return;
    setMenuOpenId(null);
    try {
      await fetch(`${API_URL}/folders/${activeFolderDetail.FolderID}/sessions/${session.SessionID}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setRefreshTick(t => t + 1);
      setFolderRefreshTick(t => t + 1);
    } catch (err) {
      console.error('Remove from folder error:', err);
    }
  };

  const openFolderPicker = async (session: Session) => {
    setPickerTargetSession(session);
    setPickerLoading(true);
    setShowFolderPicker(true);
    setMenuOpenId(null);
    try {
      const data = await fetch(
        `${API_URL}/sessions/${session.SessionID}/folders`,
        { credentials: 'include' }
      ).then(r => r.json());
      const ids = new Set<number>((data.folderIds || []) as number[]);
      setPickerSelectedIds(new Set(ids));
      setPickerOriginalIds(new Set(ids));
    } catch (err) {
      console.error('Folder picker fetch error:', err);
    } finally {
      setPickerLoading(false);
    }
  };

  const openChunksModal = async (session: Session) => {
    setChunksModal({ session });
    setModalChunks([]);
    setChunksLoading(true);
    try {
      const data = await fetch(
        `${API_URL}/sessions/${session.SessionID}/chunks`,
        { credentials: 'include' }
      ).then(r => r.json());
      if (data.success) setModalChunks(data.data);
    } catch (err) {
      console.error('Chunks fetch error:', err);
    } finally {
      setChunksLoading(false);
    }
  };

  const handleFolderPickerSave = async () => {
    if (!pickerTargetSession) return;
    setPickerLoading(true);
    try {
      for (const folderId of pickerSelectedIds) {
        if (!pickerOriginalIds.has(folderId)) {
          await fetch(`${API_URL}/folders/${folderId}/sessions`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: pickerTargetSession.SessionID }),
          });
        }
      }
      for (const folderId of pickerOriginalIds) {
        if (!pickerSelectedIds.has(folderId)) {
          await fetch(`${API_URL}/folders/${folderId}/sessions/${pickerTargetSession.SessionID}`, {
            method: 'DELETE',
            credentials: 'include',
          });
        }
      }
      setShowFolderPicker(false);
      setFolderRefreshTick(t => t + 1);
    } catch (err) {
      console.error('Folder picker save error:', err);
    } finally {
      setPickerLoading(false);
    }
  };

  const openFolderDetail = (folder: Folder) => {
    setActiveFolderDetail(folder);
    setPage(1);
    setInputValue('');
    setSearch('');
    setExpandedIndex(null);
  };

  const openSessionPicker = async () => {
    if (!activeFolderDetail || !user) return;
    setSessionPickerLoading(true);
    setShowSessionPicker(true);
    try {
      const [allData, folderData] = await Promise.all([
        fetch(`${API_URL}/sessions/paginated/${user.userId}?page=1&limit=9999&sortBy=date&sortDir=DESC&search=`, { credentials: 'include' }).then(r => r.json()),
        fetch(`${API_URL}/folders/${activeFolderDetail.FolderID}/sessions?page=1&limit=9999&sortBy=date&sortDir=DESC&search=`, { credentials: 'include' }).then(r => r.json()),
      ]);
      const allSessions: Session[] = allData.success ? allData.sessions : [];
      const existingIds = new Set<number>(
        (folderData.success ? folderData.sessions : []).map((s: Session) => s.SessionID)
      );
      setSessionPickerSessions(allSessions);
      setSessionPickerSelected(new Set(existingIds));
      setSessionPickerOriginal(new Set(existingIds));
    } catch (err) {
      console.error('Session picker fetch error:', err);
    } finally {
      setSessionPickerLoading(false);
    }
  };

  const handleSessionPickerSave = async () => {
    if (!activeFolderDetail) return;
    setSessionPickerLoading(true);
    try {
      for (const sessionId of sessionPickerSelected) {
        if (!sessionPickerOriginal.has(sessionId)) {
          await fetch(`${API_URL}/folders/${activeFolderDetail.FolderID}/sessions`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          });
        }
      }
      for (const sessionId of sessionPickerOriginal) {
        if (!sessionPickerSelected.has(sessionId)) {
          await fetch(`${API_URL}/folders/${activeFolderDetail.FolderID}/sessions/${sessionId}`, {
            method: 'DELETE',
            credentials: 'include',
          });
        }
      }
      setShowSessionPicker(false);
      setRefreshTick(t => t + 1);
      setFolderRefreshTick(t => t + 1);
    } catch (err) {
      console.error('Session picker save error:', err);
    } finally {
      setSessionPickerLoading(false);
    }
  };

  const closeFolderDetail = () => {
    setActiveFolderDetail(null);
    setPage(1);
    setInputValue('');
    setSearch('');
    setExpandedIndex(null);
    setFolderSearch('');
  };

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setActiveFolderDetail(null);
    setPage(1);
    setInputValue('');
    setSearch('');
    setMenuOpenId(null);
    setFolderMenuOpenId(null);
    setExpandedIndex(null);
    setFolderSearch('');
  };

  const totalPages = Math.ceil(total / LIMIT);

  const sortLabels: Record<SortBy, string> = {
    date: 'Date',
    duration: 'Duration',
  };

  const renderDotsMenu = (session: Session, idx: number, inFolderView = false) => (
    <div className="session-menu-wrapper">
      <button
        className="session-dots-btn"
        onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === idx ? null : idx); }}
      >
        <DotsIcon />
      </button>
      {menuOpenId === idx && (
        <div className="session-dropdown">
          <button onClick={() => { setModalInput(session.sessionName); setSessionModal({ type: 'rename', session }); setMenuOpenId(null); }}>
            Rename
          </button>
          <button onClick={() => { setModalInput(session.sessionDescription ?? ''); setSessionModal({ type: 'description', session }); setMenuOpenId(null); }}>
            Edit Description
          </button>
          {inFolderView ? (
            <button onClick={() => handleRemoveFromFolder(session)}>
              Remove from Folder
            </button>
          ) : (
            <button onClick={() => openFolderPicker(session)}>
              Add to Folder
            </button>
          )}
          <button className="session-dropdown-delete" onClick={() => { setSessionModal({ type: 'delete', session }); setMenuOpenId(null); }}>
            Delete
          </button>
        </div>
      )}
    </div>
  );

  const renderListCard = (session: Session, i: number, inFolderView = false) => {
    const start = formatDateTime(session.sessionStart);
    const end = formatDateTime(session.sessionEnd);
    const dur = calcTotalDuration(session.sessionStart, session.sessionEnd, session.activeDuration);
    const isOpen = expandedIndex === i;
    const displayName = session.sessionName || start.date;

    return (
      <div key={`${i}-${session.sessionStart}`} className="session-card">
        <div className="session-card-header">
          <span className="session-card-name">{displayName}</span>
          <span className="session-card-date">{start.date}</span>
          <button
            className="session-chunks-btn"
            onClick={e => { e.stopPropagation(); openChunksModal(session); }}
            title="Session Details"
          >
            <ChartIcon />
          </button>
          <button
            className="session-expand-btn"
            onClick={() => handleExpand(i)}
          >
            {isOpen ? 'Collapse' : 'Expand'}
          </button>
          {renderDotsMenu(session, i, inFolderView)}
        </div>
        {isOpen && (
          <div className="session-card-details">
            <div className="session-details-time-row">
              <div className="session-detail-col">
                <span className="session-detail-label">Start Time</span>
                <span className="session-detail-value">{start.time}</span>
              </div>
              <div className="session-detail-col">
                <span className="session-detail-label">End Time</span>
                <span className="session-detail-value">{end.time}</span>
              </div>
              <div className="session-detail-col">
                <span className="session-detail-label">Duration</span>
                <span className="session-detail-value session-detail-duration">{dur}</span>
              </div>
            </div>
            <div className="session-detail-description">
              <span className="session-detail-label">Description</span>
              <p className="session-detail-desc-text">
                {session.sessionDescription || 'No Description'}
              </p>
            </div>
            {session.sessionFeedback && (
              <div className="session-detail-feedback">
                <span className="session-detail-label">AI Feedback</span>
                <div className="feedback-text-block">
                  {session.sessionFeedback.split('\n').map((line, i) => {
                    const isHeader = line.trimEnd().endsWith(':') && line.trim().split(' ').length <= 3;
                    return line.trim() ? (
                      <p key={i} className={isHeader ? 'feedback-inline-header' : 'session-detail-desc-text'}>
                        {line}
                      </p>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderGridCard = (session: Session, i: number, inFolderView = false) => {
    const start = formatDateTime(session.sessionStart);
    const end = formatDateTime(session.sessionEnd);
    const dur = calcTotalDuration(session.sessionStart, session.sessionEnd, session.activeDuration);
    const displayName = session.sessionName || start.date;

    return (
      <div key={`${i}-${session.sessionStart}`} className="session-card session-card-grid">
        <div className="session-card-header">
          <span className="session-card-name">{displayName}</span>
          <span className="session-card-date">{start.date}</span>
          <button
            className="session-chunks-btn"
            onClick={e => { e.stopPropagation(); openChunksModal(session); }}
            title="Session Details"
          >
            <ChartIcon />
          </button>
          {renderDotsMenu(session, i, inFolderView)}
        </div>
        <div className="session-grid-stats">
          <div className="session-stat-box">
            <span className="session-detail-label">Start</span>
            <span className="session-stat-value">{start.time}</span>
          </div>
          <div className="session-stat-box">
            <span className="session-detail-label">End</span>
            <span className="session-stat-value">{end.time}</span>
          </div>
          <div className="session-stat-box">
            <span className="session-detail-label">Duration</span>
            <span className="session-stat-value session-stat-duration">{dur}</span>
          </div>
        </div>
        {session.sessionDescription && (
          <div className="session-grid-description">
            <span className="session-detail-label">Description</span>
            <p className="session-detail-desc-text">{session.sessionDescription}</p>
          </div>
        )}
      </div>
    );
  };

  const renderSessionList = (inFolderView = false) => (
    <>
      <div className="sessions-search-row">
        <div className="sessions-search-wrapper">
          <SearchIcon />
          <input
            className="sessions-search"
            type="text"
            placeholder={inFolderView ? 'Search in folder' : 'Search in Sessions'}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
          />
        </div>
      </div>

      <div className="sessions-controls-row">
        <div className="sessions-sort-group">
          {(['date', 'duration'] as SortBy[]).map(field => (
            <button
              key={field}
              className={`sessions-sort-btn${sortBy === field ? ' active' : ''}`}
              onClick={() => handleSort(field)}
            >
              {sortLabels[field]}
              {sortBy === field && (
                <span className="sort-indicator">{sortDir === 'DESC' ? ' ↓' : ' ↑'}</span>
              )}
            </button>
          ))}
        </div>
        <div className="sessions-layout-toggle">
          <button
            className={`layout-toggle-btn${layout === 'list' ? ' active' : ''}`}
            onClick={() => setLayout('list')}
            data-tooltip="List view"
          >
            <ListIcon />
          </button>
          <button
            className={`layout-toggle-btn${layout === 'grid' ? ' active' : ''}`}
            onClick={() => setLayout('grid')}
            data-tooltip="Grid view"
          >
            <GridIcon />
          </button>
        </div>
      </div>

      {layout === 'list' ? (
        <div className="sessions-list">
          {isLoading ? (
            Array.from({ length: LIMIT }, (_, i) => (
              <div key={i} className="session-card session-card-skeleton">
                <div className="session-skeleton-header" />
              </div>
            ))
          ) : sessions.length === 0 ? (
            <p className="no-sessions">{inFolderView ? 'No sessions in this folder.' : 'No sessions found.'}</p>
          ) : (
            sessions.map((session, i) => renderListCard(session, i, inFolderView))
          )}
        </div>
      ) : (
        <div className="sessions-grid">
          {isLoading ? (
            Array.from({ length: LIMIT }, (_, i) => (
              <div key={i} className="session-card session-card-skeleton">
                <div className="session-skeleton-header" />
              </div>
            ))
          ) : sessions.length === 0 ? (
            <p className="no-sessions">{inFolderView ? 'No sessions in this folder.' : 'No sessions found.'}</p>
          ) : (
            sessions.map((session, i) => renderGridCard(session, i, inFolderView))
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="sessions-pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              className={`pagination-btn${page === p ? ' active' : ''}`}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </>
  );

  const renderFolderList = () => {
    const filteredFolders = folders.filter(f =>
      f.folderName.toLowerCase().includes(folderSearch.toLowerCase())
    );
    return (
    <>
      <div className="folders-header">
        <div className="folders-search-wrapper">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="folders-search-icon">
            <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="9.5" y1="9.5" x2="13.5" y2="13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            className="folders-search"
            type="text"
            placeholder="Search Folders"
            value={folderSearch}
            onChange={e => setFolderSearch(e.target.value)}
          />
        </div>
        <button
          className="folders-create-btn"
          onClick={() => { setFolderNameInput(''); setFolderDescInput(''); setFolderModal({ type: 'create' }); }}
        >
          + New Folder
        </button>
      </div>
      {folders.length === 0 ? (
        <p className="no-sessions">No folders yet. Create one to organize your sessions.</p>
      ) : filteredFolders.length === 0 ? (
        <p className="no-sessions">No folders match "{folderSearch}".</p>
      ) : (
        <div className="folders-grid">
          {filteredFolders.map(folder => (
            <div
              key={folder.FolderID}
              className="folder-card"
              onClick={() => openFolderDetail(folder)}
            >
              <div className="folder-card-header">
                <span className="folder-card-name">{folder.folderName}</span>
                <span className="folder-card-count">
                  {folder.sessionCount} session{folder.sessionCount !== 1 ? 's' : ''}
                </span>
                <div className="session-menu-wrapper" onClick={e => e.stopPropagation()}>
                  <button
                    className="session-dots-btn"
                    onClick={() => setFolderMenuOpenId(folderMenuOpenId === folder.FolderID ? null : folder.FolderID)}
                  >
                    <DotsIcon />
                  </button>
                  {folderMenuOpenId === folder.FolderID && (
                    <div className="session-dropdown">
                      <button onClick={() => { setFolderNameInput(folder.folderName); setFolderModal({ type: 'rename', folder }); setFolderMenuOpenId(null); }}>
                        Rename
                      </button>
                      <button onClick={() => { setFolderDescInput(folder.folderDescription ?? ''); setFolderModal({ type: 'description', folder }); setFolderMenuOpenId(null); }}>
                        Edit Description
                      </button>
                      <button className="session-dropdown-delete" onClick={() => { setFolderModal({ type: 'delete', folder }); setFolderMenuOpenId(null); }}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {folder.folderDescription && (
                <p className="folder-card-description">{folder.folderDescription}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
  };

  return (
    <div className="sessions-page">
      <h2 className="page-heading">Sessions</h2>

      {/* Tab bar */}
      <div className="sessions-tab-bar">
        <button
          className={`sessions-tab-btn${activeTab === 'sessions' ? ' active' : ''}`}
          onClick={() => switchTab('sessions')}
        >
          Sessions
        </button>
        <button
          className={`sessions-tab-btn${activeTab === 'folders' ? ' active' : ''}`}
          onClick={() => switchTab('folders')}
        >
          Folders
        </button>
      </div>

      {/* Sessions tab */}
      {activeTab === 'sessions' && renderSessionList(false)}

      {/* Folders tab, folder list */}
      {activeTab === 'folders' && !activeFolderDetail && renderFolderList()}

      {/* Folders tab, folder detail */}
      {activeTab === 'folders' && activeFolderDetail && (
        <>
          <div className="folder-detail-header">
            <button className="folder-back-btn" onClick={closeFolderDetail}>
              ← Back
            </button>
            <div className="folder-detail-info">
              <h3 className="folder-detail-name">{activeFolderDetail.folderName}</h3>
              {activeFolderDetail.folderDescription && (
                <p className="folder-detail-description">{activeFolderDetail.folderDescription}</p>
              )}
            </div>
            <button className="folders-create-btn folder-detail-add-btn" onClick={openSessionPicker}>
              + Add Sessions
            </button>
          </div>
          {renderSessionList(true)}
        </>
      )}

      {/* Session modals */}
      {sessionModal?.type === 'delete' && (
        <div className="modal-overlay" onClick={() => setSessionModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <p className="modal-title">Delete Session</p>
            <p className="modal-subtitle">Are you sure you want to delete "{sessionModal.session.sessionName}"? This cannot be undone.</p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setSessionModal(null)} disabled={modalLoading}>Cancel</button>
              <button className="modal-save modal-delete-btn" onClick={handleDeleteSession} disabled={modalLoading}>
                {modalLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {sessionModal?.type === 'rename' && (
        <div className="modal-overlay" onClick={() => setSessionModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <p className="modal-title">Rename Session</p>
            <input
              className="modal-input"
              type="text"
              value={modalInput}
              onChange={e => setModalInput(e.target.value)}
              placeholder="Session name"
              autoFocus
            />
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setSessionModal(null)} disabled={modalLoading}>Cancel</button>
              <button className="modal-save" onClick={handleUpdateSession} disabled={modalLoading || !modalInput.trim()}>
                {modalLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {sessionModal?.type === 'description' && (
        <div className="modal-overlay" onClick={() => setSessionModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <p className="modal-title">Edit Description</p>
            <textarea
              className="modal-textarea"
              value={modalInput}
              onChange={e => setModalInput(e.target.value)}
              placeholder="Session description"
              autoFocus
            />
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setSessionModal(null)} disabled={modalLoading}>Cancel</button>
              <button className="modal-save" onClick={handleUpdateSession} disabled={modalLoading}>
                {modalLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder modals */}
      {folderModal?.type === 'create' && (
        <div className="modal-overlay" onClick={() => setFolderModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <p className="modal-title">New Folder</p>
            <input
              className="modal-input"
              type="text"
              value={folderNameInput}
              onChange={e => setFolderNameInput(e.target.value)}
              placeholder="Folder name"
              autoFocus
            />
            <textarea
              className="modal-textarea"
              value={folderDescInput}
              onChange={e => setFolderDescInput(e.target.value)}
              placeholder="Description (optional)"
            />
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setFolderModal(null)} disabled={folderModalLoading}>Cancel</button>
              <button className="modal-save" onClick={handleCreateFolder} disabled={folderModalLoading || !folderNameInput.trim()}>
                {folderModalLoading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
      {folderModal?.type === 'rename' && (
        <div className="modal-overlay" onClick={() => setFolderModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <p className="modal-title">Rename Folder</p>
            <input
              className="modal-input"
              type="text"
              value={folderNameInput}
              onChange={e => setFolderNameInput(e.target.value)}
              placeholder="Folder name"
              autoFocus
            />
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setFolderModal(null)} disabled={folderModalLoading}>Cancel</button>
              <button className="modal-save" onClick={handleRenameFolder} disabled={folderModalLoading || !folderNameInput.trim()}>
                {folderModalLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {folderModal?.type === 'description' && (
        <div className="modal-overlay" onClick={() => setFolderModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <p className="modal-title">Edit Description</p>
            <textarea
              className="modal-textarea"
              value={folderDescInput}
              onChange={e => setFolderDescInput(e.target.value)}
              placeholder="Folder description"
              autoFocus
            />
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setFolderModal(null)} disabled={folderModalLoading}>Cancel</button>
              <button className="modal-save" onClick={handleUpdateFolderDescription} disabled={folderModalLoading}>
                {folderModalLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {folderModal?.type === 'delete' && (
        <div className="modal-overlay" onClick={() => setFolderModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <p className="modal-title">Delete Folder</p>
            <p className="modal-subtitle">
              This will delete the folder "{folderModal.folder?.folderName}" and unlink all associated sessions.
              Your sessions will not be deleted.
            </p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setFolderModal(null)} disabled={folderModalLoading}>Cancel</button>
              <button className="modal-save modal-delete-btn" onClick={handleDeleteFolder} disabled={folderModalLoading}>
                {folderModalLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder picker modal */}
      {showFolderPicker && (
        <div className="modal-overlay" onClick={() => setShowFolderPicker(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <p className="modal-title">Add to Folder</p>
            {pickerLoading ? (
              <p className="modal-subtitle">Loading...</p>
            ) : folders.length === 0 ? (
              <p className="modal-subtitle">No folders yet. Create a folder first from the Folders tab.</p>
            ) : (
              <div className="folder-picker-list">
                {folders.map(folder => (
                  <label key={folder.FolderID} className="folder-picker-item">
                    <input
                      type="checkbox"
                      checked={pickerSelectedIds.has(folder.FolderID)}
                      onChange={e => {
                        const next = new Set(pickerSelectedIds);
                        if (e.target.checked) next.add(folder.FolderID);
                        else next.delete(folder.FolderID);
                        setPickerSelectedIds(next);
                      }}
                    />
                    <span className="folder-picker-name">{folder.folderName}</span>
                    <span className="folder-picker-count">{folder.sessionCount}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowFolderPicker(false)} disabled={pickerLoading}>Cancel</button>
              {folders.length > 0 && (
                <button className="modal-save" onClick={handleFolderPickerSave} disabled={pickerLoading}>
                  {pickerLoading ? 'Saving...' : 'Save'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Session picker modal (add sessions to folder from folder detail view) */}
      {showSessionPicker && (
        <div className="modal-overlay" onClick={() => setShowSessionPicker(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <p className="modal-title">Add Sessions to Folder</p>
            {sessionPickerLoading ? (
              <p className="modal-subtitle">Loading...</p>
            ) : sessionPickerSessions.length === 0 ? (
              <p className="modal-subtitle">No sessions found.</p>
            ) : (
              <div className="folder-picker-list">
                {sessionPickerSessions.map(session => (
                  <label key={session.SessionID} className="folder-picker-item">
                    <input
                      type="checkbox"
                      checked={sessionPickerSelected.has(session.SessionID)}
                      onChange={e => {
                        const next = new Set(sessionPickerSelected);
                        if (e.target.checked) next.add(session.SessionID);
                        else next.delete(session.SessionID);
                        setSessionPickerSelected(next);
                      }}
                    />
                    <span className="folder-picker-name">{session.sessionName}</span>
                    <span className="folder-picker-count">
                      {formatDateTime(session.sessionStart).date}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowSessionPicker(false)} disabled={sessionPickerLoading}>Cancel</button>
              {sessionPickerSessions.length > 0 && (
                <button className="modal-save" onClick={handleSessionPickerSave} disabled={sessionPickerLoading}>
                  {sessionPickerLoading ? 'Saving...' : 'Save'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Session Details (Chunks) Modal */}
      {chunksModal && (() => {
        const session = chunksModal.session;

        const statusCounts = modalChunks.reduce<Record<string, number>>((acc, c) => {
          acc[c.chunkStatus] = (acc[c.chunkStatus] ?? 0) + 1;
          return acc;
        }, {});

        const donutData = CHUNK_LABELS
          .filter(label => statusCounts[label] > 0)
          .map(label => ({ name: label, value: statusCounts[label] }));

        const parseTS = (str: string): number => new Date(str.replace(' ', 'T')).getTime();

        const sessionStartMs = parseTS(session.sessionStart);
        const sessionEndMs = session.sessionEnd
          ? parseTS(session.sessionEnd)
          : (modalChunks.length > 0 ? parseTS(modalChunks[modalChunks.length - 1].endOfChunk) : sessionStartMs);
        const totalMs = sessionEndMs - sessionStartMs;

        const segments = modalChunks.map((chunk, idx) => {
          const chunkStartMs = idx === 0 ? sessionStartMs : parseTS(modalChunks[idx - 1].endOfChunk);
          const chunkEndMs = parseTS(chunk.endOfChunk);
          const widthPct = totalMs > 0 ? ((chunkEndMs - chunkStartMs) / totalMs) * 100 : 0;
          return { ...chunk, widthPct };
        });

        const tlStart = formatDateTime(session.sessionStart).time;
        const tlEnd = formatDateTime(session.sessionEnd).time;

        return (
          <div className="modal-overlay" onClick={() => setChunksModal(null)}>
            <div className="modal-box chunks-modal-box" onClick={e => e.stopPropagation()}>

              <button className="chunks-modal-close" onClick={() => setChunksModal(null)}>✕</button>

              <div className="chunks-modal-header">
                <p className="modal-title">{session.sessionName || formatDateTime(session.sessionStart).date}</p>
                <span className="chunks-avg-focus-label">
                  Avg Focus: <strong>{session.avgFocus.toFixed(1)}</strong> / 3
                </span>
              </div>

              {chunksLoading ? (
                <p className="modal-subtitle" style={{ textAlign: 'center', padding: '40px 0' }}>Loading chunks...</p>
              ) : modalChunks.length === 0 ? (
                <p className="modal-subtitle" style={{ textAlign: 'center', padding: '40px 0' }}>No chunk data recorded for this session.</p>
              ) : (
                <>
                  <div className="chunks-legend">
                    {CHUNK_LABELS.filter(l => statusCounts[l] > 0).map(label => (
                      <div key={label} className="chunks-legend-item">
                        <span className="chunks-legend-dot" style={{ background: CHUNK_COLORS[label] }} />
                        <span className="chunks-legend-label">{label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="chunks-chart-container">
                    <PieChart width={200} height={200}>
                      <Pie
                        data={donutData}
                        cx={100}
                        cy={100}
                        innerRadius={60}
                        outerRadius={90}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                        strokeWidth={0}
                      >
                        {donutData.map(entry => (
                          <Cell key={entry.name} fill={CHUNK_COLORS[entry.name]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [value + ' chunks', name]}
                        contentStyle={{
                          background: 'var(--color-bg-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}
                      />
                    </PieChart>
                    <div className="chunks-donut-center">
                      <span className="chunks-donut-value">{session.avgFocus.toFixed(1)}</span>
                      <span className="chunks-donut-sublabel">avg focus</span>
                    </div>
                  </div>

                  <div className="chunks-timeline-section">
                    <div className="chunks-timeline-bar">
                      {segments.map(seg => (
                        <div
                          key={seg.ChunkId}
                          className="chunks-timeline-segment"
                          style={{ width: `${seg.widthPct}%`, background: CHUNK_COLORS[seg.chunkStatus] }}
                          title={seg.chunkStatus}
                        />
                      ))}
                    </div>
                    <div className="chunks-timeline-labels">
                      <span>{tlStart}</span>
                      <span>{tlEnd}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Sessions;
