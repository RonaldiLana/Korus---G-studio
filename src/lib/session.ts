import axios from "axios";

const TOKEN_KEY = "korus-token";

const isApiRequest = (url: string) => {
  try {
    const parsed = new URL(url, window.location.origin);
    const apiOrigin = import.meta.env.VITE_API_URL?.trim();
    const trusted =
      parsed.origin === window.location.origin ||
      (apiOrigin ? parsed.origin === new URL(apiOrigin).origin : false) ||
      parsed.hostname === "korus.me" ||
      parsed.hostname.endsWith(".korus.me");
    return trusted && parsed.pathname.startsWith("/api/") && parsed.pathname !== "/api/login";
  } catch {
    return false;
  }
};

function forceLogout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("korus-user");
  window.location.reload();
}

// Anexa o token da sessão a toda chamada /api e encerra a sessão quando o servidor responde 401
export function installSessionInterceptors() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const sessionToken = localStorage.getItem(TOKEN_KEY);
    let finalInit = init;
    if (sessionToken && isApiRequest(url)) {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      if (!headers.has("Authorization") || !headers.get("Authorization")?.replace("Bearer", "").trim()) {
        headers.set("Authorization", `Bearer ${sessionToken}`);
      }
      finalInit = { ...init, headers };
    }
    const response = await originalFetch(input, finalInit);
    if (response.status === 401 && sessionToken && isApiRequest(url)) forceLogout();
    return response;
  };

  axios.interceptors.request.use((config) => {
    const sessionToken = localStorage.getItem(TOKEN_KEY);
    if (sessionToken && config.url && isApiRequest(config.url)) {
      config.headers.set("Authorization", `Bearer ${sessionToken}`);
    }
    return config;
  });
  axios.interceptors.response.use(undefined, (error) => {
    if (error?.response?.status === 401 && localStorage.getItem(TOKEN_KEY)) forceLogout();
    return Promise.reject(error);
  });
}
