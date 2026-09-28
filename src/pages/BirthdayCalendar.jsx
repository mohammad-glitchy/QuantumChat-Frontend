import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Cake,
  ArrowLeft,
  Search,
  Sparkles,
  Users
} from 'lucide-react';
import client from '../api/client.js';
import {
  normalizeFriendBirthdays,
  formatBirthdayCountdown,
  formatBirthdayDate
} from '../utils/birthdayUtils';
import '../styles/birthdayCalendar.css';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function BirthdayCalendar() {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch friends list and normalize birthdays with strict privacy enforcement
  useEffect(() => {
    let isMounted = true;
    const fetchFriends = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await client.get('/users/friends');
        if (isMounted) {
          const rawFriends = Array.isArray(res.data)
            ? res.data
            : (res.data?.friends || []);
          const normalized = normalizeFriendBirthdays(rawFriends, today);
          setFriends(normalized);
        }
      } catch (err) {
        console.error('Failed to load friends birthdays:', err);
        if (isMounted) {
          setError('Could not load birthdays. Please try again.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchFriends();
    return () => {
      isMounted = false;
    };
  }, [today]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const handleTodayClick = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDay(today.getDate());
  };

  // Group birthdays by month & day (1-indexed month, day)
  const birthdaysMap = useMemo(() => {
    const map = new Map();
    friends.forEach((friend) => {
      const key = `${friend.birthMonth}-${friend.birthDay}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(friend);
    });
    return map;
  }, [friends]);

  // Categorize birthdays into Today, This Week, and Later
  const categorizedUpcoming = useMemo(() => {
    const list = [...friends].sort((a, b) => a.daysRemaining - b.daysRemaining);

    const filtered = searchQuery.trim()
      ? list.filter((f) =>
          (f.name || f.username || '').toLowerCase().includes(searchQuery.toLowerCase())
        )
      : list;

    const todayList = [];
    const thisWeekList = [];
    const laterList = [];

    filtered.forEach((friend) => {
      if (friend.daysRemaining === 0) {
        todayList.push(friend);
      } else if (friend.daysRemaining > 0 && friend.daysRemaining <= 7) {
        thisWeekList.push(friend);
      } else {
        laterList.push(friend);
      }
    });

    return { todayList, thisWeekList, laterList, total: filtered.length };
  }, [friends, searchQuery]);

  // Calendar matrix calculations
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayWeekday = new Date(currentYear, currentMonth, 1).getDay();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const selectedKey = `${currentMonth + 1}-${selectedDay}`;
  const selectedDateFriends = birthdaysMap.get(selectedKey) || [];

  return (
    <div className="birthday-page">
      <div className="birthday-container">
        {/* Top Header */}
        <header className="birthday-header">
          <div className="birthday-header-left">
            <button
              type="button"
              className="birthday-back-btn"
              onClick={() => navigate('/chat')}
              title="Back to Chat"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="birthday-title-group">
              <h1 className="birthday-title">
                <Cake className="birthday-title-icon" size={26} />
                Birthday Calendar
              </h1>
              <p className="birthday-subtitle">Never miss a friend's special day</p>
            </div>
          </div>

          <div className="birthday-header-actions">
            <button
              type="button"
              className="birthday-today-btn"
              onClick={handleTodayClick}
            >
              <CalendarIcon size={16} />
              Today
            </button>
          </div>
        </header>

        {/* Content Layout */}
        <div className="birthday-layout">
          {/* Main Calendar Section */}
          <section className="birthday-calendar-card">
            {/* Month & Year Navigation Bar */}
            <div className="birthday-month-bar">
              <div className="birthday-current-month-display">
                <span className="birthday-month-name">{MONTH_NAMES[currentMonth]}</span>
                <span className="birthday-year-name">{currentYear}</span>
              </div>
              <div className="birthday-nav-controls">
                <button
                  type="button"
                  className="birthday-nav-arrow"
                  onClick={handlePrevMonth}
                  title="Previous Month"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  className="birthday-nav-arrow"
                  onClick={handleNextMonth}
                  title="Next Month"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            {/* Weekday Header */}
            <div className="birthday-weekdays-row">
              {WEEKDAY_NAMES.map((name) => (
                <div key={name} className="birthday-weekday-label">
                  {name}
                </div>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div className="birthday-days-grid">
              {/* Previous Month Inactive Padding Days */}
              {Array.from({ length: firstDayWeekday }).map((_, idx) => {
                const dayNum = daysInPrevMonth - firstDayWeekday + idx + 1;
                return (
                  <div key={`prev-${idx}`} className="birthday-day-cell inactive">
                    <span className="birthday-day-number">{dayNum}</span>
                  </div>
                );
              })}

              {/* Current Month Active Days */}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const isCurrentToday =
                  today.getFullYear() === currentYear &&
                  today.getMonth() === currentMonth &&
                  today.getDate() === dayNum;

                const isSelected = selectedDay === dayNum;
                const cellKey = `${currentMonth + 1}-${dayNum}`;
                const dayFriends = birthdaysMap.get(cellKey) || [];
                const hasBirthdays = dayFriends.length > 0;

                const cellClasses = ['birthday-day-cell', 'current'];
                if (isCurrentToday) cellClasses.push('is-today');
                if (isSelected) cellClasses.push('is-selected');
                if (hasBirthdays) cellClasses.push('has-birthday');

                return (
                  <div
                    key={dayNum}
                    className={cellClasses.join(' ')}
                    onClick={() => setSelectedDay(dayNum)}
                  >
                    <div className="birthday-day-top">
                      <span className="birthday-day-number">{dayNum}</span>
                      {hasBirthdays && (
                        <span className="birthday-indicator-icon" title="Birthday on this day">
                          🎂
                        </span>
                      )}
                    </div>

                    {hasBirthdays && (
                      <div className="birthday-badges-container">
                        {dayFriends.slice(0, 2).map((friend) => (
                          <div
                            key={friend._id || friend.id || friend.name}
                            className="birthday-friend-chip"
                            title={`${friend.name || friend.username}'s Birthday`}
                          >
                            <span className="birthday-chip-name">
                              {friend.name || friend.username}
                            </span>
                          </div>
                        ))}
                        {dayFriends.length > 2 && (
                          <div className="birthday-more-badge">
                            +{dayFriends.length - 2}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Selected Date Details Inspector */}
            <div className="birthday-selected-date-card">
              <div className="selected-date-header">
                <h3 className="selected-date-title">
                  {MONTH_NAMES[currentMonth]} {selectedDay}, {currentYear}
                </h3>
                {selectedDateFriends.length > 0 && (
                  <span className="selected-count-badge">
                    {selectedDateFriends.length} birthday{selectedDateFriends.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {selectedDateFriends.length === 0 ? (
                <p className="selected-date-empty">No friends celebrating on this date.</p>
              ) : (
                <div className="selected-friends-list">
                  {selectedDateFriends.map((friend) => (
                    <div
                      key={friend._id || friend.id || friend.name}
                      className="selected-friend-item"
                      onClick={() => navigate(`/chat?user=${friend._id || friend.id}`)}
                    >
                      <div className="selected-friend-avatar-wrap">
                        {friend.avatar || friend.profilePic ? (
                          <img
                            src={friend.avatar || friend.profilePic}
                            alt={friend.name || friend.username}
                            className="selected-friend-avatar"
                          />
                        ) : (
                          <div className="selected-friend-avatar-fallback">
                            {(friend.name || friend.username || 'F')[0].toUpperCase()}
                          </div>
                        )}
                        <span className="birthday-sparkle-dot">🎉</span>
                      </div>
                      <div className="selected-friend-info">
                        <div className="selected-friend-name">
                          {friend.name || friend.username}
                        </div>
                        <div className="selected-friend-countdown">
                          {formatBirthdayCountdown(friend.daysRemaining)}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="selected-friend-chat-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/chat?user=${friend._id || friend.id}`);
                        }}
                      >
                        Wish Happy Birthday
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Sidebar / Upcoming List Section */}
          <aside className="birthday-upcoming-sidebar">
            <div className="upcoming-sidebar-header">
              <h2 className="upcoming-title">
                <Sparkles size={18} className="sparkle-icon" />
                Upcoming Birthdays
              </h2>
            </div>

            {/* Search Filter */}
            <div className="birthday-search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="birthday-search-input"
              />
            </div>

            {loading ? (
              <div className="birthday-loading-state">
                <div className="birthday-spinner" />
                <p>Loading birthdays...</p>
              </div>
            ) : error ? (
              <div className="birthday-error-state">
                <p>{error}</p>
              </div>
            ) : friends.length === 0 ? (
              <div className="birthday-empty-state">
                <Users size={36} className="empty-icon" />
                <h3>No Birthdays Found</h3>
                <p>
                  None of your friends have shared their birthday yet, or their privacy settings keep it private.
                </p>
              </div>
            ) : (
              <div className="upcoming-groups-container">
                {/* Today */}
                {categorizedUpcoming.todayList.length > 0 && (
                  <div className="upcoming-category-group">
                    <div className="upcoming-category-title today-highlight">
                      🎂 Today!
                    </div>
                    {categorizedUpcoming.todayList.map((friend) => (
                      <div
                        key={friend._id || friend.id || friend.name}
                        className="upcoming-card is-today"
                        onClick={() => navigate(`/chat?user=${friend._id || friend.id}`)}
                      >
                        <div className="upcoming-card-avatar">
                          {friend.avatar || friend.profilePic ? (
                            <img
                              src={friend.avatar || friend.profilePic}
                              alt={friend.name || friend.username}
                            />
                          ) : (
                            <div className="avatar-fallback">
                              {(friend.name || friend.username || 'F')[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="upcoming-card-content">
                          <span className="upcoming-card-name">
                            {friend.name || friend.username}
                          </span>
                          <span className="upcoming-card-date">
                            {formatBirthdayDate(friend.nextBirthdayDate)}
                          </span>
                        </div>
                        <span className="badge-today">Today</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* This Week */}
                {categorizedUpcoming.thisWeekList.length > 0 && (
                  <div className="upcoming-category-group">
                    <div className="upcoming-category-title">⚡ This Week</div>
                    {categorizedUpcoming.thisWeekList.map((friend) => (
                      <div
                        key={friend._id || friend.id || friend.name}
                        className="upcoming-card is-this-week"
                        onClick={() => navigate(`/chat?user=${friend._id || friend.id}`)}
                      >
                        <div className="upcoming-card-avatar">
                          {friend.avatar || friend.profilePic ? (
                            <img
                              src={friend.avatar || friend.profilePic}
                              alt={friend.name || friend.username}
                            />
                          ) : (
                            <div className="avatar-fallback">
                              {(friend.name || friend.username || 'F')[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="upcoming-card-content">
                          <span className="upcoming-card-name">
                            {friend.name || friend.username}
                          </span>
                          <span className="upcoming-card-date">
                            {formatBirthdayDate(friend.nextBirthdayDate)}
                          </span>
                        </div>
                        <span className="badge-countdown">
                          {formatBirthdayCountdown(friend.daysRemaining)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Later */}
                {categorizedUpcoming.laterList.length > 0 && (
                  <div className="upcoming-category-group">
                    <div className="upcoming-category-title">📅 Coming Up Later</div>
                    {categorizedUpcoming.laterList.map((friend) => (
                      <div
                        key={friend._id || friend.id || friend.name}
                        className="upcoming-card"
                        onClick={() => navigate(`/chat?user=${friend._id || friend.id}`)}
                      >
                        <div className="upcoming-card-avatar">
                          {friend.avatar || friend.profilePic ? (
                            <img
                              src={friend.avatar || friend.profilePic}
                              alt={friend.name || friend.username}
                            />
                          ) : (
                            <div className="avatar-fallback">
                              {(friend.name || friend.username || 'F')[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="upcoming-card-content">
                          <span className="upcoming-card-name">
                            {friend.name || friend.username}
                          </span>
                          <span className="upcoming-card-date">
                            {formatBirthdayDate(friend.nextBirthdayDate)}
                          </span>
                        </div>
                        <span className="badge-countdown">
                          {formatBirthdayCountdown(friend.daysRemaining)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
