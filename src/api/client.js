import axios from 'axios';
import { getToken } from '../crypto/keyStorage.js';
import { getApiUrl } from './baseUrl.js';
import { getVaultToken } from './vaultToken.js';

const client = axios.create({
  baseURL: getApiUrl(),
});

client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const vaultToken = getVaultToken();
  if (vaultToken) {
    config.headers['x-vault-token'] = vaultToken;
  }
  return config;
});

export async function viewStory(id) {
  return client.post(`/stories/${id}/view`);
}
export async function getStoryViewers(id) {
  const { data } = await client.get(`/stories/${id}/viewers`);
  return data;
}

export async function updatePrivacySettings(payload) {
  const { data } = await client.patch('/users/me/privacy', payload);
  return data;
}
export async function getNotificationSettings() {
  const { data } = await client.get('/users/me/notification-settings');
  return data;
}
export async function lookupContactByPhone(phone) {
  const { data } = await client.get('/users/lookup', { params: { phone } });
  return data;
}

export async function updateNotificationSettings(payload) {
  const { data } = await client.put('/users/me/notification-settings', payload);
  return data;
}

export async function submitReport(userId, reason, details) {
  const { data } = await client.post('/reports', { userId, reason, details });
  return data;
}

export async function muteChat(payload) {
  const { data } = await client.post('/users/me/mute', payload);
  return data;
}

export async function unmuteChat(payload) {
  const { data } = await client.post('/users/me/unmute', payload);
  return data;
}
export async function clearChat(payload) {
  const { data } = await client.post('/users/me/clear-chat', payload);
  return data;
}

export async function getMyReferrals() {
  const { data } = await client.get('/users/me/referrals');
  return data;
}

export async function getReferralPreview(code) {
  const { data } = await client.get(`/auth/referral-preview/${encodeURIComponent(code)}`);
  return data;
}

export default client;