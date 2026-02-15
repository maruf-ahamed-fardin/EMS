function getApiUrl() {
  // Runtime config (localStorage) takes priority, then build-time env var
  return localStorage.getItem('selorax_api_url') || import.meta.env.VITE_API_URL || '';
}

export function getConfiguredApiUrl() {
  return getApiUrl();
}

export function setApiUrl(url) {
  // Remove trailing slash
  const clean = url.replace(/\/+$/, '');
  localStorage.setItem('selorax_api_url', clean);
}

export async function fetchUsers() {
  const res = await fetch(`${getApiUrl()}/api/users?_t=${Date.now()}`);
  if (!res.ok) throw new Error('Failed to fetch users');
  const data = await res.json();
  return data.users || [];
}

export async function fetchProfilePics() {
  const res = await fetch(`${getApiUrl()}/api/profile-pics?_t=${Date.now()}`);
  if (!res.ok) throw new Error('Failed to fetch profile pics');
  const data = await res.json();
  return data.profilePics || {};
}

export async function fetchProfiles() {
  const res = await fetch(`${getApiUrl()}/api/profiles?_t=${Date.now()}`);
  if (!res.ok) throw new Error('Failed to fetch profiles');
  const data = await res.json();
  return data.profiles || {};
}
