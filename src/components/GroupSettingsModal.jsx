import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Copy, FileText, Link2, Shield, Trash2, UserMinus, UserPlus, X } from 'lucide-react';
import client from '../api/client.js';
import { isGroupAdmin } from '../utils/groupPayload.js';
import useFocusTrap from '../hooks/useFocusTrap.js';

export default function GroupSettingsModal({
  group,
  currentUserId,
  users = [],
  onClose,
  onUpdated,
  onLeftOrDeleted,
  onOpenChatTheme,
}) {
  const [tab, setTab] = useState('info');
  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [onlyAdminsCanPost, setOnlyAdminsCanPost] = useState(Boolean(group?.onlyAdminsCanPost));
  const [onlyAdminsCanAddMembers, setOnlyAdminsCanAddMembers] = useState(
    group?.onlyAdminsCanAddMembers !== false,
  );
  const [quantumAIEnabled, setQuantumAIEnabled] = useState(Boolean(group?.quantumAI?.enabled));
  const [quantumAIPolicy, setQuantumAIPolicy] = useState(group?.quantumAI?.invocationPolicy || 'members');
  const [quantumAIContext, setQuantumAIContext] = useState(group?.quantumAI?.maxContextMessages ?? 5);
  const [quantumAIDailyLimit, setQuantumAIDailyLimit] = useState(group?.quantumAI?.dailyLimit ?? 50);
  const [joinPolicy, setJoinPolicy] = useState(group?.joinPolicy === 'request' ? 'request' : 'open');
  const [joinRequests, setJoinRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [addSearch, setAddSearch] = useState('');
  const [selectedAdd, setSelectedAdd] = useState(() => new Set());
  const [gallery, setGallery] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const photoRef = useRef(null);
  const containerRef = useRef(null);

  useFocusTrap(containerRef, true);

  const admin = isGroupAdmin(group, currentUserId);
  const isOwner = String(group?.createdBy) === String(currentUserId);
  const memberIds = useMemo(
    () => new Set((group?.members || []).map((m) => String(m.id || m._id))),
    [group],
  );
  const adminIds = useMemo(() => new Set((group?.admins || []).map(String)), [group]);

  const candidates = useMemo(() => {
    const q = addSearch.trim().toLowerCase();
    return users.filter((u) => {
      const id = String(u.id);
      if (memberIds.has(id)) return false;
      if (!q) return true;
      return (
        (u.username || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
      );
    });
  }, [users, memberIds, addSearch]);

  const tabs = useMemo(
    () => [
      ['info', 'Info'],
      ['members', 'Members'],
      ...(group?.visibility === 'public' ? [['requests', 'Requests']] : [['invite', 'Invite']]),
      ['media', 'Files'],
    ],
    [group?.visibility],
  );

  useEffect(() => {
    const ids = new Set(tabs.map(([id]) => id));
    if (!ids.has(tab)) setTab('info');
  }, [tabs, tab]);

  useEffect(() => {
    setName(group?.name || '');
    setDescription(group?.description || '');
    setOnlyAdminsCanPost(Boolean(group?.onlyAdminsCanPost));
    setOnlyAdminsCanAddMembers(group?.onlyAdminsCanAddMembers !== false);
    setQuantumAIEnabled(Boolean(group?.quantumAI?.enabled));
    setQuantumAIPolicy(group?.quantumAI?.invocationPolicy || 'members');
    setQuantumAIContext(group?.quantumAI?.maxContextMessages ?? 5);
    setQuantumAIDailyLimit(group?.quantumAI?.dailyLimit ?? 50);
    setJoinPolicy(group?.joinPolicy === 'request' ? 'request' : 'open');
  }, [group]);

  useEffect(() => {
    if (!admin || group?.visibility !== 'public' || group?.joinPolicy !== 'request' || !group?.id) {
      setJoinRequests([]);
      return undefined;
    }
    let cancelled = false;
    setRequestsLoading(true);
    client
      .get(`/groups/${group.id}/join-requests`)
      .then((res) => {
        if (!cancelled) setJoinRequests(res.data.data || []);
      })
      .catch(() => {
        if (!cancelled) setJoinRequests([]);
      })
      .finally(() => {
        if (!cancelled) setRequestsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [admin, group?.id, group?.visibility, group?.joinPolicy, group?.updatedAt]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onClose?.();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, busy]);

  useEffect(() => {
    if (tab !== 'media' || !group?.id) return;
    let cancelled = false;
    setGalleryLoading(true);
    client
      .get(`/groups/${group.id}/messages`, { params: { limit: 200 } })
      .then((res) => {
        if (cancelled) return;
        const items = (res.data.data || [])
          .filter((m) => m.kind === 'file' || m.attachment)
          .map((m) => ({
            id: m.id || m._id,
            kind: m.kind,
            attachment: m.attachment,
            from: m.from,
            createdAt: m.createdAt,
          }));
        setGallery(items);
      })
      .catch(() => setGallery([]))
      .finally(() => {
        if (!cancelled) setGalleryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, group?.id]);

  async function refreshAndClosePayload(payload) {
    onUpdated?.(payload);
  }

  async function saveInfo() {
    setBusy(true);
    setError('');
    try {
      const body = {
        name: name.trim(),
        description: description.trim(),
        onlyAdminsCanPost,
        onlyAdminsCanAddMembers,
        quantumAI: {
          enabled: quantumAIEnabled,
          invocationPolicy: quantumAIPolicy,
          maxContextMessages: Number(quantumAIContext),
          dailyLimit: Number(quantumAIDailyLimit),
        },
      };
      if (group?.visibility === 'public') {
        body.joinPolicy = joinPolicy;
      }
      const { data } = await client.patch(`/groups/${group.id}`, body);
      await refreshAndClosePayload(data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  async function respondToJoinRequest(userId, accept) {
    setBusy(true);
    setError('');
    try {
      const path = accept ? 'accept' : 'reject';
      const { data } = await client.post(`/groups/${group.id}/join-requests/${userId}/${path}`);
      if (accept) await refreshAndClosePayload(data.data);
      setJoinRequests((prev) =>
        prev.filter((r) => String(r.user?.id || r.user?._id) !== String(userId)),
      );
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update request');
    } finally {
      setBusy(false);
    }
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('photo', file);
      const { data } = await client.post(`/groups/${group.id}/photo`, form);
      await refreshAndClosePayload(data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload photo');
    } finally {
      setBusy(false);
    }
  }

  async function addSelectedMembers() {
    if (!selectedAdd.size) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await client.post(`/groups/${group.id}/members`, {
        memberIds: [...selectedAdd],
      });
      setSelectedAdd(new Set());
      await refreshAndClosePayload(data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add members');
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(memberId) {
    setBusy(true);
    setError('');
    try {
      const { data } = await client.delete(`/groups/${group.id}/members/${memberId}`);
      if (data.data?.deleted || String(memberId) === String(currentUserId)) {
        onLeftOrDeleted?.(group.id);
        onClose?.();
        return;
      }
      await refreshAndClosePayload(data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove member');
    } finally {
      setBusy(false);
    }
  }

  async function toggleAdmin(memberId, makeAdmin) {
    setBusy(true);
    setError('');
    try {
      const { data } = makeAdmin
        ? await client.post(`/groups/${group.id}/admins/${memberId}`)
        : await client.delete(`/groups/${group.id}/admins/${memberId}`);
      await refreshAndClosePayload(data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update admin');
    } finally {
      setBusy(false);
    }
  }

  async function setInvite({ enabled, rotate }) {
    setBusy(true);
    setError('');
    try {
      const { data } = await client.post(`/groups/${group.id}/invite`, { enabled, rotate });
      await refreshAndClosePayload(data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update invite link');
    } finally {
      setBusy(false);
    }
  }

  async function deleteGroup() {
    if (!window.confirm(`Delete “${group.name}” for everyone? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await client.delete(`/groups/${group.id}`);
      onLeftOrDeleted?.(group.id);
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete group');
      setBusy(false);
    }
  }

  const inviteUrl =
    group?.inviteEnabled && group?.inviteCode
      ? `${window.location.origin}/join/${group.inviteCode}`
      : '';

  // Prefer blob URL fetched with auth header (query-token img src is unreliable).
  const [photoBlob, setPhotoBlob] = useState(null);
  useEffect(() => {
    let revoked;
    if (!group?.hasPhoto) {
      setPhotoBlob(null);
      return undefined;
    }
    client
      .get(`/groups/${group.id}/photo`, { responseType: 'blob' })
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        revoked = url;
        setPhotoBlob(url);
      })
      .catch(() => setPhotoBlob(null));
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [group?.id, group?.hasPhoto, group?.updatedAt]);

  return createPortal(
    <div className="create-group-overlay" role="presentation" onClick={() => !busy && onClose?.()}>
      <div
        className="create-group-modal group-settings-modal"
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="group-settings-chrome">
          <div className="create-group-modal-header">
            <div className="create-group-modal-heading">
              <h2 id="group-settings-title">Group settings</h2>
              <p>{group?.name}</p>
            </div>
            <button
              type="button"
              className="create-group-close"
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="group-settings-tabs" role="tablist" aria-label="Group settings sections">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`group-settings-tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`group-settings-panel-${id}`}
                className={`group-settings-tab ${tab === id ? 'active' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="create-group-error group-settings-error">{error}</p>}

        <div className="group-settings-body">
          {tab === 'info' && (
            <div
              className="group-settings-section"
              role="tabpanel"
              id="group-settings-panel-info"
              aria-labelledby="group-settings-tab-info"
            >
              <section className="gs-card">
                <div className="group-photo-row">
                  <div className="group-photo-preview">
                    {photoBlob ? (
                      <img src={photoBlob} alt="" />
                    ) : (
                      <span>{(group?.name || '?').slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="group-photo-meta">
                    <strong>Group photo</strong>
                    <span>Shown in the chat list and header</span>
                    {admin && (
                      <>
                        <button
                          type="button"
                          className="btn-secondary gs-btn"
                          onClick={() => photoRef.current?.click()}
                          disabled={busy}
                        >
                          <Camera size={16} /> Change photo
                        </button>
                        <input
                          ref={photoRef}
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={handlePhoto}
                        />
                      </>
                    )}
                  </div>
                </div>

                <div className="gs-field">
                  <label className="create-group-label" htmlFor="gs-name">
                    Name
                  </label>
                  <input
                    id="gs-name"
                    className="create-group-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!admin || busy}
                    maxLength={60}
                  />
                </div>

                <div className="gs-field">
                  <label className="create-group-label" htmlFor="gs-desc">
                    Description
                  </label>
                  <textarea
                    id="gs-desc"
                    className="create-group-input group-desc-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!admin || busy}
                    maxLength={500}
                    rows={3}
                    placeholder="What is this group about?"
                  />
                </div>

                <div className="gs-field">
                  <span className="create-group-label">Visibility</span>
                  <p className="group-visibility-badge">
                    {group?.visibility === 'public'
                      ? 'Public · not encrypted'
                      : 'Private · end-to-end encrypted'}
                  </p>
                </div>
              </section>
{onOpenChatTheme && (
  <section className="gs-card">
    <h3 className="gs-card-title">Chat theme</h3>
    <p className="gs-card-copy">
      Change the chat bubble color and wallpaper for this group. This only changes how it looks for you — other members keep their own.
    </p>
    <button
      type="button"
      className="btn-secondary gs-btn"
      onClick={onOpenChatTheme}
    >
      Open chat theme
    </button>
  </section>
)}
              {admin && group?.visibility === 'public' && (
                <section className="gs-card">
                  <h3 className="gs-card-title">Join policy</h3>
                  <div className="gs-field">
                    <label className="create-group-label" htmlFor="gs-join-policy">
                      Who can join
                    </label>
                    <select
                      id="gs-join-policy"
                      className="create-group-input gs-select"
                      value={joinPolicy}
                      onChange={(e) => setJoinPolicy(e.target.value)}
                      disabled={busy}
                    >
                      <option value="open">Anyone can join</option>
                      <option value="request">Request to join</option>
                    </select>
                  </div>
                </section>
              )}
            
              {admin && (
                <section className="gs-card">
                  <h3 className="gs-card-title">Permissions</h3>
                  <div className="group-settings-toggles">
                    <label className="gs-check">
                      <input
                        type="checkbox"
                        checked={onlyAdminsCanPost}
                        onChange={(e) => setOnlyAdminsCanPost(e.target.checked)}
                        disabled={busy}
                      />
                      <span>Only admins can post</span>
                    </label>
                    <label className="gs-check">
                      <input
                        type="checkbox"
                        checked={onlyAdminsCanAddMembers}
                        onChange={(e) => setOnlyAdminsCanAddMembers(e.target.checked)}
                        disabled={busy}
                      />
                      <span>Only admins can add members</span>
                    </label>
                  </div>
                </section>
              )}

              {admin && (
                <section className="gs-card">
                  <h3 className="gs-card-title">QuantumAI</h3>
                  <p className="gs-card-copy">
                    Add QuantumAI as a member before enabling mentions in this group.
                  </p>
                  <div className="group-settings-toggles">
                    <label className="gs-check">
                      <input
                        type="checkbox"
                        checked={quantumAIEnabled}
                        onChange={(e) => setQuantumAIEnabled(e.target.checked)}
                        disabled={busy}
                      />
                      <span>Enable @QuantumAI</span>
                    </label>
                  </div>
                  <div className="gs-field">
                    <label className="create-group-label" htmlFor="gs-ai-policy">
                      Who can invoke QuantumAI
                    </label>
                    <select
                      id="gs-ai-policy"
                      className="create-group-input gs-select"
                      value={quantumAIPolicy}
                      onChange={(e) => setQuantumAIPolicy(e.target.value)}
                      disabled={busy}
                    >
                      <option value="members">All members</option>
                      <option value="admins">Admins only</option>
                    </select>
                  </div>
                  <div className="gs-field-row">
                    <div className="gs-field">
                      <label className="create-group-label" htmlFor="gs-ai-context">
                        Context messages
                      </label>
                      <input
                        id="gs-ai-context"
                        className="create-group-input"
                        type="number"
                        min="0"
                        max="20"
                        value={quantumAIContext}
                        onChange={(e) => setQuantumAIContext(e.target.value)}
                        disabled={busy}
                      />
                      <span className="gs-field-hint">Shared after confirmation</span>
                    </div>
                    <div className="gs-field">
                      <label className="create-group-label" htmlFor="gs-ai-limit">
                        Daily request limit
                      </label>
                      <input
                        id="gs-ai-limit"
                        className="create-group-input"
                        type="number"
                        min="1"
                        max="1000"
                        value={quantumAIDailyLimit}
                        onChange={(e) => setQuantumAIDailyLimit(e.target.value)}
                        disabled={busy}
                      />
                      <span className="gs-field-hint">Per group, per day</span>
                    </div>
                  </div>
                </section>
              )}

              {admin && (
                <button
                  type="button"
                  className="confirm-btn gs-save"
                  onClick={saveInfo}
                  disabled={busy || name.trim().length < 2}
                >
                  Save changes
                </button>
              )}

              <section className="gs-card gs-card-danger">
                <h3 className="gs-card-title">Danger zone</h3>
                <div className="group-danger-zone">
                  <button
                    type="button"
                    className="btn-danger-outline"
                    onClick={() => removeMember(currentUserId)}
                    disabled={busy}
                  >
                    Leave group
                  </button>
                  {isOwner && (
                    <button type="button" className="btn-danger" onClick={deleteGroup} disabled={busy}>
                      <Trash2 size={14} /> Delete group
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}

          {tab === 'members' && (
            <div
              className="group-settings-section"
              role="tabpanel"
              id="group-settings-panel-members"
              aria-labelledby="group-settings-tab-members"
            >
              <section className="gs-card">
                <div className="gs-card-heading-row">
                  <h3 className="gs-card-title">Members</h3>
                  <span className="gs-count">{(group?.members || []).length}</span>
                </div>
                <ul className="group-member-list">
                  {(group?.members || []).map((m) => {
                    const id = String(m.id || m._id);
                    const isAdm = adminIds.has(id);
                    const isCreator = String(group.createdBy) === id;
                    return (
                      <li key={id}>
                        <div>
                          <strong>{m.username || 'Member'}</strong>
                          <span className="group-member-meta">
                            {isCreator ? 'Owner' : isAdm ? 'Admin' : 'Member'}
                            {id === String(currentUserId) ? ' · you' : ''}
                          </span>
                        </div>
                        <div className="group-member-actions">
                          {admin && !isCreator && id !== String(currentUserId) && (
                            <>
                              {isAdm && isOwner ? (
                                <button
                                  type="button"
                                  onClick={() => toggleAdmin(id, false)}
                                  disabled={busy}
                                  title="Demote"
                                  aria-label={`Demote ${m.username || 'member'}`}
                                >
                                  <Shield size={14} />
                                </button>
                              ) : !isAdm ? (
                                <button
                                  type="button"
                                  onClick={() => toggleAdmin(id, true)}
                                  disabled={busy}
                                  title="Make admin"
                                  aria-label={`Make ${m.username || 'member'} admin`}
                                >
                                  <UserPlus size={14} />
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => removeMember(id)}
                                disabled={busy}
                                title="Remove"
                                aria-label={`Remove ${m.username || 'member'}`}
                              >
                                <UserMinus size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {(admin || group?.onlyAdminsCanAddMembers === false) && (
                <section className="gs-card">
                  <h3 className="gs-card-title">Add members</h3>
                  <div className="gs-field">
                    <label className="create-group-label" htmlFor="gs-add-search">
                      Search
                    </label>
                    <input
                      id="gs-add-search"
                      className="create-group-input"
                      placeholder="Search users…"
                      value={addSearch}
                      onChange={(e) => setAddSearch(e.target.value)}
                    />
                  </div>
                  <div className="create-group-user-list gs-add-list">
                    {candidates.slice(0, 40).length === 0 ? (
                      <p className="gs-empty">No matching users to add.</p>
                    ) : (
                      candidates.slice(0, 40).map((u) => {
                        const id = String(u.id);
                        const checked = selectedAdd.has(id);
                        return (
                          <label key={id} className="create-group-user-row">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelectedAdd((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(id)) next.delete(id);
                                  else next.add(id);
                                  return next;
                                })
                              }
                            />
                            <span>{u.username}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  <button
                    type="button"
                    className="confirm-btn gs-save"
                    disabled={!selectedAdd.size || busy}
                    onClick={addSelectedMembers}
                  >
                    Add selected{selectedAdd.size ? ` (${selectedAdd.size})` : ''}
                  </button>
                </section>
              )}
            </div>
          )}

          {tab === 'requests' && (
            <div
              className="group-settings-section"
              role="tabpanel"
              id="group-settings-panel-requests"
              aria-labelledby="group-settings-tab-requests"
            >
              <section className="gs-card">
                <h3 className="gs-card-title">Join requests</h3>
                {!admin ? (
                  <p className="gs-empty">Only admins can manage join requests.</p>
                ) : group?.joinPolicy !== 'request' ? (
                  <p className="gs-empty">
                    Switch join policy to “Request to join” on the Info tab to review requests.
                  </p>
                ) : requestsLoading ? (
                  <p className="gs-empty">Loading requests…</p>
                ) : joinRequests.length === 0 ? (
                  <p className="gs-empty">No pending join requests.</p>
                ) : (
                  <ul className="group-member-list">
                    {joinRequests.map((r) => {
                      const uid = String(r.user?.id || r.user?._id);
                      return (
                        <li key={r.id || uid}>
                          <div>
                            <strong>{r.user?.username || 'User'}</strong>
                            <span className="group-member-meta">Requested to join</span>
                          </div>
                          <div className="group-member-actions group-member-actions--wide">
                            <button
                              type="button"
                              className="confirm-btn gs-mini-btn"
                              disabled={busy}
                              onClick={() => respondToJoinRequest(uid, true)}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="btn-danger-outline gs-mini-btn"
                              disabled={busy}
                              onClick={() => respondToJoinRequest(uid, false)}
                            >
                              Reject
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          )}

          {tab === 'invite' && (
            <div
              className="group-settings-section"
              role="tabpanel"
              id="group-settings-panel-invite"
              aria-labelledby="group-settings-tab-invite"
            >
              <section className="gs-card">
                <h3 className="gs-card-title">Invite link</h3>
                {!admin ? (
                  <p className="gs-empty">Only admins can manage invite links.</p>
                ) : (
                  <>
                    <p className="gs-card-copy">
                      Anyone with the link can join. New members only decrypt future messages.
                    </p>
                    {inviteUrl ? (
                      <div className="group-invite-box">
                        <code>{inviteUrl}</code>
                        <button
                          type="button"
                          className="gs-icon-btn"
                          onClick={() => {
                            navigator.clipboard?.writeText(inviteUrl);
                          }}
                          aria-label="Copy invite link"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    ) : (
                      <p className="gs-empty">Invite link is currently off.</p>
                    )}
                    <div className="group-invite-actions">
                      {!group?.inviteEnabled ? (
                        <button
                          type="button"
                          className="confirm-btn"
                          disabled={busy}
                          onClick={() => setInvite({ enabled: true })}
                        >
                          <Link2 size={14} /> Enable invite link
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn-secondary gs-btn"
                            disabled={busy}
                            onClick={() => setInvite({ enabled: true, rotate: true })}
                          >
                            Rotate link
                          </button>
                          <button
                            type="button"
                            className="btn-danger-outline"
                            disabled={busy}
                            onClick={() => setInvite({ enabled: false })}
                          >
                            Disable link
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </section>
            </div>
          )}

          {tab === 'media' && (
            <div
              className="group-settings-section"
              role="tabpanel"
              id="group-settings-panel-media"
              aria-labelledby="group-settings-tab-media"
            >
              <section className="gs-card">
                <div className="gs-card-heading-row">
                  <h3 className="gs-card-title">Shared files</h3>
                  {!galleryLoading && gallery.length > 0 ? (
                    <span className="gs-count">{gallery.length}</span>
                  ) : null}
                </div>
                <p className="gs-card-copy">
                  Encrypted files shared in this group. Open them from chat to decrypt.
                </p>
                {galleryLoading ? (
                  <p className="gs-empty">Loading…</p>
                ) : gallery.length === 0 ? (
                  <div className="gs-empty-state">
                    <FileText size={22} strokeWidth={1.75} aria-hidden="true" />
                    <p>No shared files yet.</p>
                  </div>
                ) : (
                  <ul className="group-shared-files">
                    {gallery.map((item) => (
                      <li key={item.id}>
                        <span className="group-shared-file-name">
                          {item.attachment?.filename || 'Encrypted file'}
                        </span>
                        <span className="group-member-meta">
                          {item.attachment?.mimetype || item.kind} ·{' '}
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
