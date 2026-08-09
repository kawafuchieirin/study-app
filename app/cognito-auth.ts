const domain = "https://manabi-prod-154931139855.auth.ap-northeast-1.amazoncognito.com";
const clientId = "5p8bb519mo27r6m5b0pm0ekp8o";
const verifierKey = "manabi_oauth_verifier";
const stateKey = "manabi_oauth_state";
const idTokenKey = "manabi_id_token";
const accessTokenKey = "manabi_access_token";

export type AuthUser = { name: string; email: string };

const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const randomValue = () => encode(crypto.getRandomValues(new Uint8Array(32)));
const decodeToken = (token: string): Record<string, unknown> => JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));

export function currentUser(): AuthUser | null {
  const token = sessionStorage.getItem(idTokenKey);
  if (!token) return null;
  try {
    const claims = decodeToken(token);
    if (Number(claims.exp) * 1000 <= Date.now()) return null;
    const email = String(claims.email ?? "");
    return { name: String(claims.name ?? email.split("@")[0] ?? "ユーザー"), email };
  } catch { return null; }
}

export function accessToken(): string | null {
  return sessionStorage.getItem(accessTokenKey);
}

export async function beginSignIn() {
  const verifier = randomValue();
  const state = randomValue();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  sessionStorage.setItem(verifierKey, verifier);
  sessionStorage.setItem(stateKey, state);
  const query = new URLSearchParams({ client_id: clientId, response_type: "code", scope: "openid email profile", redirect_uri: window.location.origin, state, code_challenge_method: "S256", code_challenge: encode(new Uint8Array(digest)) });
  window.location.assign(`${domain}/oauth2/authorize?${query}`);
}

export async function finishSignIn(): Promise<AuthUser | null> {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error_description") ?? params.get("error");
  if (error) throw new Error(error);
  const code = params.get("code");
  if (!code) return currentUser();
  if (params.get("state") !== sessionStorage.getItem(stateKey)) throw new Error("ログイン状態を確認できませんでした。もう一度お試しください。");
  const verifier = sessionStorage.getItem(verifierKey);
  if (!verifier) throw new Error("ログイン情報の有効期限が切れました。もう一度お試しください。");
  const response = await fetch(`${domain}/oauth2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, code, redirect_uri: window.location.origin, code_verifier: verifier }) });
  if (!response.ok) throw new Error("ログインを完了できませんでした。もう一度お試しください。");
  const tokens = await response.json();
  sessionStorage.setItem(idTokenKey, tokens.id_token);
  sessionStorage.setItem(accessTokenKey, tokens.access_token);
  sessionStorage.removeItem(verifierKey);
  sessionStorage.removeItem(stateKey);
  history.replaceState({}, "", window.location.pathname);
  return currentUser();
}

export function signOut() {
  sessionStorage.clear();
  const query = new URLSearchParams({ client_id: clientId, logout_uri: window.location.origin });
  window.location.assign(`${domain}/logout?${query}`);
}
