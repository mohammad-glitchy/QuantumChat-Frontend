import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  buildIndex,
  resolveDateRange,
  searchMessages,
} from '../utils/localSearchIndex.js';
import { getMessagePreviewText } from '../utils/messagePreview.js';

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'messages', label: 'Messages' },
  { value: 'pictures', label: 'Pictures' },
  { value: 'documents', label: 'Documents' },
  { value: 'links', label: 'Links' },
];

const DATE_PRESETS = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'thisYear', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
];

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function truncateText(text, maxLength = 80) {
  if (!text || text.length <= maxLength) return text || '';
  return text.slice(0, maxLength) + '…';
}

function formatDateLabel(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function MessageSearch({ messages = [], onResultSelect, isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState({ preset: 'all', from: '', to: '' });
  const [draftFilter, setDraftFilter] = useState({ preset: 'all', from: '', to: '' });
  const [type, setType] = useState('all');
  const [filename, setFilename] = useState('');
  const [domain, setDomain] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
    setQuery('');
    setDateFilter({ preset: 'all', from: '', to: '' });
    setDraftFilter({ preset: 'all', from: '', to: '' });
    setType('all');
    setFilename('');
    setDomain('');
    setFilterOpen(false);
  }, [isOpen]);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  const index = useMemo(() => buildIndex(messages), [messages]);
  const dateRange = useMemo(() => resolveDateRange(dateFilter), [dateFilter]);
  const results = useMemo(() => searchMessages(index, { query, dateRange, type, filename, domain }), [index, query, dateRange, type, filename, domain]);
  const activePreset = DATE_PRESETS.find((preset) => preset.value === dateFilter.preset);
  const customLabel = dateFilter.from || dateFilter.to
    ? [formatDateLabel(dateFilter.from), formatDateLabel(dateFilter.to)].filter(Boolean).join(' → ')
    : 'Custom range';
  const activeFilterLabel = dateFilter.preset === 'custom' ? customLabel : activePreset?.label || 'All dates';
  const activeTypeLabel = TYPE_FILTERS.find((item) => item.value === type)?.label || 'All';
  const hasDateFilter = dateFilter.preset !== 'all' || dateFilter.from || dateFilter.to;
  const hasContentFilter = type !== 'all' || filename || domain;
  const hasAnyFilter = hasDateFilter || hasContentFilter;

  const selectPreset = (preset) => {
    const next = { preset, from: '', to: '' };
    setDraftFilter(next);
    if (preset !== 'custom') {
      setDateFilter(next);
      setFilterOpen(false);
    }
  };

  const clearDateFilter = () => {
    const next = { preset: 'all', from: '', to: '' };
    setDateFilter(next);
    setDraftFilter(next);
    setFilterOpen(false);
  };

  const handleResultClick = useCallback((messageId) => {
    onResultSelect(messageId);
    onClose();
  }, [onResultSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div className="message-search" role="search" aria-label="Search messages">
      <div className="message-search-toolbar">
        <div className="message-search-input-wrapper">
          <svg className="message-search-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input ref={inputRef} className="message-search-input" type="text" placeholder="Search messages…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search messages input" />
          <button className="message-search-close" onClick={onClose} type="button" aria-label="Close search">✕</button>
        </div>
        <button className={`message-search-filter-button${hasDateFilter ? ' is-active' : ''}`} type="button" onClick={() => setFilterOpen((open) => !open)} aria-expanded={filterOpen} aria-haspopup="true">
          <span aria-hidden="true">≡</span> Filter{hasAnyFilter ? `: ${activeTypeLabel !== 'All' ? activeTypeLabel : activeFilterLabel}` : ''}
        </button>
      </div>

      {filterOpen && (
        <div className="message-search-filter-menu" role="dialog" aria-label="Search filters">
          <div className="message-search-filter-options" role="group" aria-label="Search type">
            {TYPE_FILTERS.map((item) => (
              <button key={item.value} type="button" className={type === item.value ? 'is-selected' : ''} onClick={() => setType(item.value)}>{item.label}</button>
            ))}
          </div>
          {(type === 'documents' || type === 'pictures') && <label className="message-search-filter-field">Filename<input type="search" placeholder="e.g. report or photo" value={filename} onChange={(e) => setFilename(e.target.value)} /></label>}
          {type === 'links' && <label className="message-search-filter-field">Website<input type="search" placeholder="e.g. example.com" value={domain} onChange={(e) => setDomain(e.target.value)} /></label>}
          <div className="message-search-filter-options" role="group" aria-label="Date presets">
            {DATE_PRESETS.map((preset) => (
              <button key={preset.value} type="button" className={draftFilter.preset === preset.value ? 'is-selected' : ''} onClick={() => selectPreset(preset.value)}>{preset.label}</button>
            ))}
          </div>
          {draftFilter.preset === 'custom' && (
            <div className="message-search-custom-range">
              <label>From<input type="date" value={draftFilter.from} onChange={(e) => setDraftFilter((current) => ({ ...current, from: e.target.value }))} /></label>
              <label>To<input type="date" value={draftFilter.to} onChange={(e) => setDraftFilter((current) => ({ ...current, to: e.target.value }))} /></label>
              <div className="message-search-filter-actions">
                <button type="button" onClick={clearDateFilter}>Clear</button>
                <button type="button" className="is-primary" onClick={() => { setDateFilter(draftFilter); setFilterOpen(false); }}>Apply</button>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="message-search-hint">On-device index · server never sees this query</p>
      {(query.trim() || hasAnyFilter) && (
        <div className="message-search-results" role="listbox" aria-label="Search results">
          {results.length === 0 ? <div className="message-search-empty">No messages found</div> : results.map((msg) => (
            <button key={msg.id} className="message-search-item" onClick={() => handleResultClick(msg.id)} type="button" role="option" aria-label={`Go to message: ${truncateText(getMessagePreviewText(msg.text), 40)}`}>
              <span className="message-search-item-text">{truncateText(getMessagePreviewText(msg.text) || msg.filename || (msg.isPicture ? 'Image' : 'Attachment'))}</span>
              {msg.filename && <span className="message-search-item-attachment">{msg.filename}</span>}
              {msg.timestamp && <span className="message-search-item-time">{formatTimestamp(msg.timestamp)}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default MessageSearch;
