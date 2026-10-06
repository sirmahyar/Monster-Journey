const TOKEN_KEY = "endless-monster-journey.token";

export function createSaveStore() {
  let memory = null;
  let persistent = false;
  try {
    const probe = "__emj_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    persistent = true;
  } catch {
    persistent = false;
  }

  return {
    persistent,
    read() {
      if (!persistent) return memory;
      try {
        return localStorage.getItem(TOKEN_KEY);
      } catch {
        return memory;
      }
    },
    write(token) {
      memory = token;
      if (!persistent) return false;
      try {
        localStorage.setItem(TOKEN_KEY, token);
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      memory = null;
      if (!persistent) return;
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch {
        /* The in-memory copy is already cleared. */
      }
    },
  };
}
