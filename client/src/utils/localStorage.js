export function loadSavedSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("cashballSession");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.name || !parsed?.token || !parsed?.roomCode) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasSeenWelcome(coachName, roomCode) {
  try {
    return (
      window.localStorage.getItem(
        `cashball_welcome:${coachName}:${roomCode}`,
      ) === "1"
    );
  } catch {
    return false;
  }
}

export function markWelcomeSeen(coachName, roomCode) {
  try {
    window.localStorage.setItem(
      `cashball_welcome:${coachName}:${roomCode}`,
      "1",
    );
  } catch {
    // Ignore storage failures.
  }
}

export function hasSeenWelcomeThisSession(coachName, roomCode) {
  try {
    return (
      window.sessionStorage.getItem(
        `cashball_welcome_session:${coachName}:${roomCode}`,
      ) === "1"
    );
  } catch {
    return false;
  }
}

export function markWelcomeSeenThisSession(coachName, roomCode) {
  try {
    window.sessionStorage.setItem(
      `cashball_welcome_session:${coachName}:${roomCode}`,
      "1",
    );
  } catch {
    // Ignore storage failures.
  }
}
