import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getNotificationSettings, updateNotificationSettings } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const DEFAULT_SETTINGS = {
  messageNotifications: 'all',
  statusNotifications: 'all',
  statusNotificationsSelectedFriends: [],
  soundEnabled: true,
  soundVolume: 80,
  messagePreview: 'full',
  vibration: 'on',
  birthdayReminders: true,
  doNotDisturb: { enabled: false, startTime: '22:00', endTime: '07:00', allowedContacts: [] },
  groupNotifications: 'all',
  callNotifications: {
    voiceCallEnabled: true,
    videoCallEnabled: true,
    vibrateOnCall: true,
    missedCallReminders: true,
  },
  badgeCount: 'show',
  webNotifications: { enabled: true, soundOnWeb: true, syncReadAcrossDevices: true },
  priority: 'normal',
  mediaSettings: { autoDownloadImages: true, autoDownloadVideos: false, wifiOnly: true },
};

function mergeNotificationSettings(base, patch) {
  const next = { ...base, ...patch };
  if (patch?.doNotDisturb) {
    next.doNotDisturb = { ...(base.doNotDisturb || {}), ...patch.doNotDisturb };
  }
  if (patch?.callNotifications) {
    next.callNotifications = { ...(base.callNotifications || {}), ...patch.callNotifications };
  }
  if (patch?.webNotifications) {
    next.webNotifications = { ...(base.webNotifications || {}), ...patch.webNotifications };
  }
  if (patch?.mediaSettings) {
    next.mediaSettings = { ...(base.mediaSettings || {}), ...patch.mediaSettings };
  }
  return next;
}

const NotificationSettingsContext = createContext(null);

export function NotificationSettingsProvider({ children }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setSettings(DEFAULT_SETTINGS);
      return;
    }
    // Prefer settings already on the session user, then refresh from API.
    if (user.notificationSettings && typeof user.notificationSettings === 'object') {
      setSettings((prev) => mergeNotificationSettings(prev, user.notificationSettings));
    }
    let cancelled = false;
    setLoading(true);
    getNotificationSettings()
      .then((res) => {
        if (!cancelled && res?.data) {
          setSettings((prev) => mergeNotificationSettings(DEFAULT_SETTINGS, res.data));
        }
      })
      .catch(() => {
        // keep defaults / session values on failure
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const updateSettings = useCallback(async (partial) => {
    setSettings((prev) => mergeNotificationSettings(prev, partial));
    try {
      const res = await updateNotificationSettings(partial);
      if (res?.data) {
        setSettings(mergeNotificationSettings(DEFAULT_SETTINGS, res.data));
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.response?.data?.error || err.message };
    }
  }, []);

  const isMuted = useCallback(() => false, []);

  const value = useMemo(
    () => ({ settings, loading, updateSettings, isMuted }),
    [settings, loading, updateSettings, isMuted]
  );

  return (
    <NotificationSettingsContext.Provider value={value}>
      {children}
    </NotificationSettingsContext.Provider>
  );
}

export function useNotificationSettings() {
  const ctx = useContext(NotificationSettingsContext);
  if (!ctx) throw new Error('useNotificationSettings must be used within NotificationSettingsProvider');
  return ctx;
}
