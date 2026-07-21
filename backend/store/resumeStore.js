const profileStore = new Map();

function createEmptyProfile() {
  return {
    candidateName: "",
    experience: "",
    currentCompany: "",
    primaryRole: "",

    resumeSummary: "",
    selfIntroduction: "",

    skills: [],
    projects: [],
    responsibilities: []
  };
}

export function saveProfile(sessionId, profile = {}) {
  if (!sessionId) {
    throw new Error("Session ID is required.");
  }

  const existing = profileStore.get(sessionId) || createEmptyProfile();

  profileStore.set(sessionId, {
    ...existing,
    ...profile
  });
}

export function getProfile(sessionId) {
  if (!sessionId) {
    return createEmptyProfile();
  }

  return (
    profileStore.get(sessionId) ||
    createEmptyProfile()
  );
}

export function clearProfile(sessionId) {
  if (!sessionId) return;

  profileStore.delete(sessionId);
}

export function hasResume(sessionId) {
  const profile = profileStore.get(sessionId);

  return Boolean(profile?.resumeSummary);
}

export function getAllProfiles() {
  return profileStore;
}