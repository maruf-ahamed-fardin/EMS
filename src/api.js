const API_URL = import.meta.env.VITE_API_URL || '';

export async function fetchUsers() {
  const res = await fetch(`${API_URL}/api/users?_t=${Date.now()}`);
  if (!res.ok) throw new Error('Failed to fetch users');
  const data = await res.json();
  return data.users || [];
}

export async function fetchProfilePics() {
  const res = await fetch(`${API_URL}/api/profile-pics?_t=${Date.now()}`);
  if (!res.ok) throw new Error('Failed to fetch profile pics');
  const data = await res.json();
  return data.profilePics || {};
}

export async function fetchProfiles() {
  const res = await fetch(`${API_URL}/api/profiles?_t=${Date.now()}`);
  if (!res.ok) throw new Error('Failed to fetch profiles');
  const data = await res.json();
  return data.profiles || {};
}
