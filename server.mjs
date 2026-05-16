import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const localDir = join(rootDir, ".local");
const tokenPath = join(localDir, "google-token.json");
const statePath = join(localDir, "oauth-state.txt");
const env = loadEnv();
const port = Number(env.PORT || 5173);
const redirectUri = env.GOOGLE_REDIRECT_URI || `http://127.0.0.1:${port}/oauth2callback`;
const gmailScopes = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.settings.basic",
];

mkdirSync(localDir, { recursive: true });

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

    if (url.pathname === "/api/gmail/status") {
      return json(response, getStatus());
    }

    if (url.pathname === "/auth/google") {
      return redirect(response, buildGoogleAuthUrl());
    }

    if (url.pathname === "/oauth2callback") {
      return handleOAuthCallback(url, response);
    }

    if (url.pathname === "/api/gmail/subscriptions") {
      return json(response, await getGmailSubscriptions());
    }

    if (url.pathname === "/api/gmail/block-delete" && request.method === "POST") {
      return json(response, await blockAndTrashGmail(request));
    }

    return serveStatic(url.pathname, response);
  } catch (error) {
    console.error(error);
    return json(response, { error: error.message || "Unexpected error" }, 500);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Mail Subscription Manager: http://127.0.0.1:${port}/`);
});

function loadEnv() {
  const values = { ...process.env };
  const envPath = join(rootDir, ".env");
  if (!existsSync(envPath)) return values;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    values[key] = value;
  }
  return values;
}

function requireGoogleCredentials() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error(".env に GOOGLE_CLIENT_ID と GOOGLE_CLIENT_SECRET を設定してください。");
  }
}

function getStatus() {
  const token = readSavedToken();
  const grantedScopes = token?.scope ? token.scope.split(/\s+/) : [];
  const hasRequiredScopes = gmailScopes.every((scope) => grantedScopes.includes(scope));

  return {
    configured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    connected: Boolean(token && hasRequiredScopes),
    needsReconnect: Boolean(token && !hasRequiredScopes),
    redirectUri,
    scopes: gmailScopes,
  };
}

function readSavedToken() {
  if (!existsSync(tokenPath)) return null;
  return JSON.parse(readFileSync(tokenPath, "utf8"));
}

function buildGoogleAuthUrl() {
  requireGoogleCredentials();
  const state = randomBytes(24).toString("hex");
  writeFileSync(statePath, state);

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: gmailScopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function handleOAuthCallback(url, response) {
  requireGoogleCredentials();
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = existsSync(statePath) ? readFileSync(statePath, "utf8") : "";

  if (!code || !state || state !== expectedState) {
    return html(response, "Gmail接続に失敗しました。stateが一致しません。", 400);
  }

  const token = await exchangeCodeForToken(code);
  saveToken(token);
  return redirect(response, "/?gmail=connected");
}

async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Google token exchange failed");
  }

  return {
    ...data,
    obtained_at: Date.now(),
  };
}

async function blockAndTrashGmail(request) {
  const body = await readJsonBody(request);
  const targets = Array.isArray(body.targets) ? body.targets : [];
  const shouldBlockFuture = body.blockFuture !== false;
  const shouldTrashExisting = body.trashExisting !== false;

  if (!targets.length) {
    throw new Error("Gmailで処理する対象がありません。");
  }

  const accessToken = await getAccessToken();
  const results = [];

  for (const target of targets) {
    const domain = String(target.senderDomain || "").trim().toLowerCase();
    if (!domain || domain === "unknown") continue;

    const result = {
      senderDomain: domain,
      filterCreated: false,
      trashedCount: 0,
      trashMethod: "none",
    };

    if (shouldBlockFuture) {
      await createTrashFilter(accessToken, domain);
      result.filterCreated = true;
    }

    if (shouldTrashExisting) {
      const messageIds = Array.isArray(target.messageIds) ? target.messageIds : [];
      const trashResult = await trashExistingMessages(accessToken, domain, messageIds);
      result.trashedCount = trashResult.count;
      result.trashMethod = trashResult.method;
    }

    results.push(result);
  }

  return { results };
}

async function createTrashFilter(accessToken, senderDomain) {
  return gmailFetch(accessToken, "https://gmail.googleapis.com/gmail/v1/users/me/settings/filters", {
    method: "POST",
    body: JSON.stringify({
      criteria: {
        from: senderDomain,
      },
      action: {
        addLabelIds: ["TRASH"],
        removeLabelIds: ["INBOX", "UNREAD"],
      },
    }),
  });
}

async function trashExistingMessages(accessToken, senderDomain, messageIds = []) {
  const directIds = [...new Set(messageIds.filter(Boolean))];
  if (directIds.length) {
    let count = 0;
    for (const id of directIds) {
      await trashMessage(accessToken, id);
      count += 1;
    }
    return { count, method: "messageIds" };
  }

  const listed = await gmailFetch(
    accessToken,
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?" +
      new URLSearchParams({
        maxResults: "500",
        q: `from:${senderDomain} newer_than:365d -in:trash`,
      }).toString(),
  );
  const ids = (listed.messages || []).map((message) => message.id);
  if (!ids.length) return { count: 0, method: "search" };

  let count = 0;
  for (const id of ids) {
    await trashMessage(accessToken, id);
    count += 1;
  }
  return { count, method: "search" };
}

async function trashMessage(accessToken, messageId) {
  return gmailFetch(accessToken, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`, {
    method: "POST",
  });
}

async function getAccessToken() {
  requireGoogleCredentials();
  if (!existsSync(tokenPath)) {
    throw new Error("Gmailが未接続です。先にGmail接続を実行してください。");
  }

  const token = JSON.parse(readFileSync(tokenPath, "utf8"));
  const expiresAt = token.obtained_at + Math.max((token.expires_in || 0) - 60, 0) * 1000;
  if (token.access_token && Date.now() < expiresAt) {
    return token.access_token;
  }

  if (!token.refresh_token) {
    throw new Error("refresh_token がありません。もう一度Gmail接続してください。");
  }

  const refreshed = await refreshAccessToken(token.refresh_token);
  const nextToken = { ...token, ...refreshed, obtained_at: Date.now() };
  saveToken(nextToken);
  return nextToken.access_token;
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Google token refresh failed");
  }
  return data;
}

function saveToken(token) {
  writeFileSync(tokenPath, JSON.stringify(token, null, 2), { mode: 0o600 });
}

async function getGmailSubscriptions() {
  const accessToken = await getAccessToken();
  const profile = await gmailFetch(accessToken, "https://gmail.googleapis.com/gmail/v1/users/me/profile");
  const listed = await gmailFetch(
    accessToken,
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?" +
      new URLSearchParams({
        maxResults: "50",
        q: "newer_than:365d",
      }).toString(),
  );

  const messages = listed.messages || [];
  const metadata = await Promise.all(
    messages.map((message) =>
      gmailFetch(
        accessToken,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?` +
          new URLSearchParams({
            format: "metadata",
            metadataHeaders: ["From", "Subject", "Date", "List-Unsubscribe"],
          }).toString(),
      ),
    ),
  );

  const subscriptions = metadata
    .map((message) => normalizeGmailMessage(message, profile.emailAddress))
    .filter((message) => message.unsubscribeHeader);

  const grouped = groupByDomain(subscriptions);
  return {
    email: profile.emailAddress,
    scanned: metadata.length,
    count: grouped.length,
    subscriptions: grouped,
  };
}

async function gmailFetch(accessToken, url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Gmail API request failed");
  }
  return data;
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function normalizeGmailMessage(message, emailAddress) {
  const headers = Object.fromEntries(
    (message.payload?.headers || []).map((header) => [header.name.toLowerCase(), header.value]),
  );
  const from = parseFrom(headers.from || "");
  const date = headers.date ? new Date(headers.date) : new Date();
  const lastOpenedDays = Math.max(0, Math.round((Date.now() - date.getTime()) / 86_400_000));

  return {
    id: `gmail-${message.id}`,
    messageIds: [message.id],
    accountId: `gmail-real-${emailAddress}`,
    senderName: from.name || from.email || from.domain,
    senderDomain: from.domain || "unknown",
    subject: headers.subject || "",
    category: inferCategory(headers.subject || "", from.domain || ""),
    lastOpenedDays,
    receiveCount30d: 1,
    unsubscribeHeader: headers["list-unsubscribe"] || "",
    unsubscribedAt: null,
    kept: false,
    source: "gmail",
  };
}

function parseFrom(value) {
  const emailMatch = value.match(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/i);
  const email = emailMatch?.[0] || "";
  const domain = emailMatch?.[1]?.toLowerCase() || "";
  const name = value
    .replace(/<[^>]+>/g, "")
    .replace(/"/g, "")
    .trim();

  return { name, email, domain };
}

function inferCategory(subject, domain) {
  const text = `${subject} ${domain}`.toLowerCase();
  if (/invoice|receipt|billing|領収|請求/.test(text)) return "請求・領収書";
  if (/sale|coupon|deal|discount|セール|割引|クーポン/.test(text)) return "広告・セール";
  if (/newsletter|digest|weekly|ニュース/.test(text)) return "ニュースレター";
  if (/notification|notice|通知|sns|social/.test(text)) return "SNS通知";
  return "サービス更新";
}

function groupByDomain(items) {
  const map = new Map();
  for (const item of items) {
    const current = map.get(item.senderDomain);
    if (!current) {
      map.set(item.senderDomain, { ...item });
      continue;
    }

    current.receiveCount30d += 1;
    current.messageIds = [...new Set([...(current.messageIds || []), ...(item.messageIds || [])])];
    current.lastOpenedDays = Math.max(current.lastOpenedDays, item.lastOpenedDays);
    if (current.category === "サービス更新" && item.category !== "サービス更新") {
      current.category = item.category;
    }
  }
  return [...map.values()];
}

function serveStatic(pathname, response) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const fullPath = normalize(join(rootDir, safePath));
  if (!fullPath.startsWith(rootDir) || !existsSync(fullPath)) {
    return html(response, "Not found", 404);
  }

  response.writeHead(200, { "Content-Type": contentType(fullPath) });
  createReadStream(fullPath).pipe(response);
}

function contentType(pathname) {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
  };
  return types[extname(pathname)] || "application/octet-stream";
}

function json(response, data, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function html(response, message, status = 200) {
  response.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<main style="font-family: system-ui; padding: 32px;"><h1>${message}</h1></main>`);
}

function redirect(response, location) {
  response.writeHead(302, { Location: location });
  response.end();
}
