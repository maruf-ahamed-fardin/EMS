export async function fetchUsers() {
  const res = await fetch(`/api/users?_t=${Date.now()}`);
  if (!res.ok) throw new Error('Failed to fetch users');
  const data = await res.json();
  return data.users || [];
}

export async function fetchProfilePics() {
  const res = await fetch(`/api/profile-pics?_t=${Date.now()}`);
  if (!res.ok) throw new Error('Failed to fetch profile pics');
  const data = await res.json();
  return data.profilePics || {};
}

export async function fetchProfiles() {
  const res = await fetch(`/api/profiles?_t=${Date.now()}`);
  if (!res.ok) throw new Error('Failed to fetch profiles');
  const data = await res.json();
  return data.profiles || {};
}
