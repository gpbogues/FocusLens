import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Sessions.css';

interface Session {
  sessionStart: string;
  sessionEnd: string;
  sessionName: string;
  sessionDescription: string | null;
  avgFocus: number;
}

type SortBy = 'date' | 'duration' | 'avgFocus';
type SortDir = 'ASC' | 'DESC';

const calcTotalDuration = (start: string, end: string): string => {
  const toSeconds = (str: string) => {
    const [datePart, timePart] = str.split('T');
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

const formatDateTime = (dateStr: string) => {
  const [datePart, timePart] = dateStr.split('T');
  const [year, month, day] = datePart.split('-');
  const [hours, minutes, seconds] = timePart.split('.')[0].split(':');

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;

  return {
    date: `${monthNames[parseInt(month) - 1]} ${parseInt(day)}, ${year}`,
    time: `${String(h12).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`,
  };
};

//Number of session per page for pagination
const LIMIT = 5;

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
    const params = new URLSearchParams({
      page: String(page),
      limit: String(LIMIT),
      sortBy,
      sortDir,
      search,
    });
    fetch(`${API_URL}/sessions/paginated/${user.userId}?${params}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setSessions(data.sessions);
          setTotal(data.total);
        }
      })
      .catch(err => console.error('Sessions fetch error:', err));
  }, [user, page, search, sortBy, sortDir, sessionTrigger]);

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

  const totalPages = Math.ceil(total / LIMIT);

  const sortLabels: Record<SortBy, string> = {
    date: 'Date',
    duration: 'Duration',
    avgFocus: 'Avg Focus',
  };

  return (
    <div className="sessions-page">
      <h2 className="page-heading">Sessions</h2>

      <div className="sessions-toolbar">
        <input
          className="sessions-search"
          type="text"
          placeholder="Search by session name..."
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
        />
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
      </div>

      <div className="sessions-list">
        {sessions.length === 0 ? (
          <p className="no-sessions">No sessions found.</p>
        ) : (
          sessions.map((session, i) => {
            const start = formatDateTime(session.sessionStart);
            const end = formatDateTime(session.sessionEnd);
            const dur = calcTotalDuration(session.sessionStart, session.sessionEnd);
            const isOpen = expandedIndex === i;
            const displayName = session.sessionName || start.date;

            return (
              <div key={`${i}-${session.sessionStart}`} className="session-card">
                <div className="session-card-header">
                  <span className="session-card-name">{displayName}</span>
                  <button
                    className="session-expand-btn"
                    onClick={() => handleExpand(i)}
                  >
                    {isOpen ? 'Collapse' : 'Expand'}
                  </button>
                </div>
                {isOpen && (
                  <div className="session-card-details">
                    <div className="session-detail-row">
                      <span className="session-detail-label">Date</span>
                      <span className="session-detail-value">{start.date}</span>
                    </div>
                    <div className="session-detail-row">
                      <span className="session-detail-label">Start Time</span>
                      <span className="session-detail-value">{start.time}</span>
                    </div>
                    <div className="session-detail-row">
                      <span className="session-detail-label">End Time</span>
                      <span className="session-detail-value">{end.time}</span>
                    </div>
                    <div className="session-detail-row">
                      <span className="session-detail-label">Duration</span>
                      <span className="session-detail-value session-detail-duration">{dur}</span>
                    </div>
                    <div className="session-detail-row">
                      <span className="session-detail-label">Avg Focus</span>
                      <span className="session-detail-value">{session.avgFocus}%</span>
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
          })
        )}
      </div>

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
    </div>
  );
};

export default Sessions;
