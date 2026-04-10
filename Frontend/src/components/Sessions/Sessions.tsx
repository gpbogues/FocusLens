import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Sessions.css';

interface Session {
  SessionID: number;
  sessionStart: string;
  sessionEnd: string | null;
  sessionName: string;
  sessionDescription: string | null;
  avgFocus: number;
}

type SortBy = 'date' | 'duration' | 'avgFocus';
type SortDir = 'ASC' | 'DESC';
type Layout = 'list' | 'grid';
type SessionModalType = 'rename' | 'description' | 'delete';

const calcTotalDuration = (start: string, end: string | null | undefined): string => {
  if (!end) return 'In progress';
  const toSeconds = (str: string) => {
    const normalized = str.replace(' ', 'T');
    const [datePart, timePart] = normalized.split('T');
    if (!timePart) return 0;
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds] = timePart.split('.')[0].split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes, seconds).getTime() / 1000;
  };

  const diff = Math.floor(toSeconds(end) - toSeconds(start));
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;
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

//Number of session per page for pagination
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

const Sessions = () => {
  const { user, sessionTrigger } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [inputValue, setInputValue] = useState('');
  const [search, setSearch] = useState('');
  //When opening session page, initally sorted by descending date
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortDir, setSortDir] = useState<SortDir>('DESC');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [layout, setLayout] = useState<Layout>('list');
  const [refreshTick, setRefreshTick] = useState(0);

  //3-dot menu and modal state(uses array index as identifier, so only one can be open at a time)
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [sessionModal, setSessionModal] = useState<{ type: SessionModalType; session: Session } | null>(null);
  const [modalInput, setModalInput] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  //Debounce search input, reduce API calls by only setting search state 350ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(inputValue);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [inputValue]);

  //Fetch sessions
  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(LIMIT),
      sortBy,
      sortDir,
      search,
    });
    fetch(`${API_URL}/sessions/paginated/${user.userId}?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setSessions(data.sessions);
          setTotal(data.total);
        }
      })
      .catch(err => console.error('Sessions fetch error:', err))
      .finally(() => setIsLoading(false));
  }, [user, page, search, sortBy, sortDir, sessionTrigger, refreshTick]);

  // Close dropdown when clicking outside
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

  const totalPages = Math.ceil(total / LIMIT);

  const sortLabels: Record<SortBy, string> = {
    date: 'Date',
    duration: 'Duration',
    avgFocus: 'Avg Focus',
  };

  const renderDotsMenu = (session: Session, idx: number) => (
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
          <button className="session-dropdown-delete" onClick={() => { setSessionModal({ type: 'delete', session }); setMenuOpenId(null); }}>
            Delete
          </button>
        </div>
      )}
    </div>
  );

  const renderListCard = (session: Session, i: number) => {
    const start = formatDateTime(session.sessionStart);
    const end = formatDateTime(session.sessionEnd);
    const dur = calcTotalDuration(session.sessionStart, session.sessionEnd);
    const isOpen = expandedIndex === i;
    const displayName = session.sessionName || start.date;

    return (
      <div key={`${i}-${session.sessionStart}`} className="session-card">
        <div className="session-card-header">
          <span className="session-card-name">{displayName}</span>
          <span className="session-card-date">{start.date}</span>
          <button
            className="session-expand-btn"
            onClick={() => handleExpand(i)}
          >
            {isOpen ? 'Collapse' : 'Expand'}
          </button>
          {renderDotsMenu(session, i)}
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
            </div>
            <div className="session-details-time-row">
              <div className="session-detail-col">
                <span className="session-detail-label">Duration</span>
                <span className="session-detail-value session-detail-duration">{dur}</span>
              </div>
              <div className="session-detail-col">
                <span className="session-detail-label">Avg Focus</span>
                <span className="session-detail-value">{session.avgFocus}%</span>
              </div>
            </div>
            <div className="session-detail-description">
              <span className="session-detail-label">Description</span>
              <p className="session-detail-desc-text">
                {session.sessionDescription || 'No Description'}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderGridCard = (session: Session, i: number) => {
    const start = formatDateTime(session.sessionStart);
    const dur = calcTotalDuration(session.sessionStart, session.sessionEnd);
    const displayName = session.sessionName || start.date;

    return (
      <div key={`${i}-${session.sessionStart}`} className="session-card session-card-grid">
        <div className="session-card-header">
          <span className="session-card-name">{displayName}</span>
          <span className="session-card-date">{start.date}</span>
          {renderDotsMenu(session, i)}
        </div>
        <div className="session-grid-stats">
          <div className="session-stat-box">
            <span className="session-detail-label">Duration</span>
            <span className="session-stat-value session-stat-duration">{dur}</span>
          </div>
          <div className="session-stat-box">
            <span className="session-detail-label">Avg Focus</span>
            <span className="session-stat-value">{session.avgFocus}%</span>
          </div>
          <div className="session-stat-box">
            <span className="session-detail-label">Start</span>
            <span className="session-stat-value">{start.time}</span>
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

  return (
    <div className="sessions-page">
      <h2 className="page-heading">Sessions</h2>

      <div className="sessions-search-row">
        <div className="sessions-search-wrapper">
          <SearchIcon />
          <input
            className="sessions-search"
            type="text"
            placeholder="Search in Sessions"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
          />
        </div>
      </div>

      <div className="sessions-controls-row">
        <div className="sessions-sort-group">
          {(['date', 'duration', 'avgFocus'] as SortBy[]).map(field => (
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
            <p className="no-sessions">No sessions found.</p>
          ) : (
            sessions.map((session, i) => renderListCard(session, i))
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
            <p className="no-sessions">No sessions found.</p>
          ) : (
            sessions.map((session, i) => renderGridCard(session, i))
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

      {/* Delete confirmation modal */}
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

      {/* Rename modal */}
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

      {/* Edit description modal */}
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
    </div>
  );
};

export default Sessions;
