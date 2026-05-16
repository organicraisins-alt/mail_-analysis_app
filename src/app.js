const storageKey = "mail-subscription-manager-state";

const defaultState = {
  weights: {
    opened: 55,
    category: 30,
    frequency: 15,
  },
  accounts: [
    { id: "gmail-1", provider: "Gmail", email: "main@example.com", status: "connected", syncedAt: "2026-05-16 08:42" },
    { id: "outlook-1", provider: "Outlook", email: "work@example.com", status: "connected", syncedAt: "2026-05-16 08:40" },
    { id: "icloud-1", provider: "iCloud", email: "private@icloud.com", status: "paused", syncedAt: "2026-05-15 22:10" },
  ],
  subscriptions: [
    { id: "s1", accountId: "gmail-1", senderName: "Daily Deals", senderDomain: "deals.example.jp", category: "広告・セール", lastOpenedDays: 220, receiveCount30d: 38, unsubscribedAt: null, kept: false },
    { id: "s2", accountId: "gmail-1", senderName: "Tech Weekly", senderDomain: "techweekly.example", category: "ニュースレター", lastOpenedDays: 112, receiveCount30d: 8, unsubscribedAt: null, kept: false },
    { id: "s3", accountId: "outlook-1", senderName: "Cloud Billing", senderDomain: "billing.example.com", category: "請求・領収書", lastOpenedDays: 12, receiveCount30d: 2, unsubscribedAt: null, kept: true },
    { id: "s4", accountId: "icloud-1", senderName: "Social Now", senderDomain: "social.example", category: "SNS通知", lastOpenedDays: 74, receiveCount30d: 21, unsubscribedAt: null, kept: false },
    { id: "s5", accountId: "outlook-1", senderName: "Product Updates", senderDomain: "updates.example.io", category: "サービス更新", lastOpenedDays: 45, receiveCount30d: 5, unsubscribedAt: null, kept: false },
    { id: "s6", accountId: "gmail-1", senderName: "Daily Deals", senderDomain: "deals.example.jp", category: "広告・セール", lastOpenedDays: 190, receiveCount30d: 31, unsubscribedAt: null, kept: false },
  ],
};

let state = loadState();

const elements = {
  accountCount: document.querySelector("#accountCount"),
  subscriptionCount: document.querySelector("#subscriptionCount"),
  highRiskCount: document.querySelector("#highRiskCount"),
  savedMailCount: document.querySelector("#savedMailCount"),
  accountList: document.querySelector("#accountList"),
  subscriptionRows: document.querySelector("#subscriptionRows"),
  providerFilter: document.querySelector("#providerFilter"),
  categoryFilter: document.querySelector("#categoryFilter"),
  sortOrder: document.querySelector("#sortOrder"),
  reportBars: document.querySelector("#reportBars"),
  unsubscribedCount: document.querySelector("#unsubscribedCount"),
  timeSaved: document.querySelector("#timeSaved"),
  toast: document.querySelector("#toast"),
  syncAll: document.querySelector("#syncAll"),
  connectGmail: document.querySelector("#connectGmail"),
  syncGmail: document.querySelector("#syncGmail"),
  gmailStatus: document.querySelector("#gmailStatus"),
  gmailRedirectUri: document.querySelector("#gmailRedirectUri"),
  addDemoAccount: document.querySelector("#addDemoAccount"),
  resetData: document.querySelector("#resetData"),
  openedWeight: document.querySelector("#openedWeight"),
  categoryWeight: document.querySelector("#categoryWeight"),
  frequencyWeight: document.querySelector("#frequencyWeight"),
};

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(defaultState);

  try {
    return JSON.parse(saved);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function accountFor(subscription) {
  return state.accounts.find((account) => account.id === subscription.accountId);
}

function scoreOpened(days) {
  if (days < 30) return 0;
  if (days < 90) return 40;
  if (days < 180) return 70;
  return 100;
}

function scoreCategory(category) {
  const scores = {
    "広告・セール": 100,
    "ニュースレター": 70,
    "SNS通知": 60,
    "サービス更新": 30,
    "請求・領収書": 0,
    "個人・仕事": 0,
  };
  return scores[category] ?? 40;
}

function scoreFrequency(count) {
  if (count < 4) return 0;
  if (count <= 12) return 30;
  if (count <= 30) return 60;
  return 100;
}

function scoreSubscription(subscription) {
  if (subscription.kept || ["請求・領収書", "個人・仕事"].includes(subscription.category)) {
    return 0;
  }

  const weights = normalizeWeights(state.weights);
  return Math.round(
    scoreOpened(subscription.lastOpenedDays) * weights.opened +
      scoreCategory(subscription.category) * weights.category +
      scoreFrequency(subscription.receiveCount30d) * weights.frequency,
  );
}

function normalizeWeights(weights) {
  const total = weights.opened + weights.category + weights.frequency || 1;
  return {
    opened: weights.opened / total,
    category: weights.category / total,
    frequency: weights.frequency / total,
  };
}

function scoreBadge(score) {
  if (score >= 80) return `<span class="badge high">${score} 解除強く推奨</span>`;
  if (score >= 50) return `<span class="badge medium">${score} 要確認</span>`;
  return `<span class="badge low">${score} 保持推奨</span>`;
}

function render() {
  renderFilters();
  renderMetrics();
  renderAccounts();
  renderSubscriptions();
  renderReports();
  renderWeights();
  saveState();
}

function renderFilters() {
  const currentProvider = elements.providerFilter.value || "all";
  const currentCategory = elements.categoryFilter.value || "all";
  const providers = [...new Set(state.accounts.map((account) => account.provider))];
  const categories = [...new Set(state.subscriptions.map((item) => item.category))];

  elements.providerFilter.innerHTML = `<option value="all">全サービス</option>${providers
    .map((provider) => `<option value="${provider}">${provider}</option>`)
    .join("")}`;
  elements.categoryFilter.innerHTML = `<option value="all">全カテゴリ</option>${categories
    .map((category) => `<option value="${category}">${category}</option>`)
    .join("")}`;
  elements.providerFilter.value = providers.includes(currentProvider) ? currentProvider : "all";
  elements.categoryFilter.value = categories.includes(currentCategory) ? currentCategory : "all";
}

function renderMetrics() {
  const activeSubscriptions = state.subscriptions.filter((item) => !item.unsubscribedAt);
  const highRisk = activeSubscriptions.filter((item) => scoreSubscription(item) >= 80);
  const savedMails = state.subscriptions
    .filter((item) => item.unsubscribedAt)
    .reduce((sum, item) => sum + item.receiveCount30d, 0);

  elements.accountCount.textContent = state.accounts.length;
  elements.subscriptionCount.textContent = activeSubscriptions.length;
  elements.highRiskCount.textContent = highRisk.length;
  elements.savedMailCount.textContent = `${savedMails}通`;
}

function renderAccounts() {
  elements.accountList.innerHTML = state.accounts
    .map(
      (account) => `
        <article class="account-card">
          <strong>${account.provider}</strong>
          <span>${account.email}</span>
          <span>状態: ${account.status === "connected" ? "接続中" : "一時停止"}</span>
          <span>最終同期: ${account.syncedAt}</span>
        </article>
      `,
    )
    .join("");
}

function renderSubscriptions() {
  const provider = elements.providerFilter.value;
  const category = elements.categoryFilter.value;
  const sort = elements.sortOrder.value;

  const rows = state.subscriptions
    .filter((item) => !item.unsubscribedAt)
    .filter((item) => provider === "all" || accountFor(item)?.provider === provider)
    .filter((item) => category === "all" || item.category === category)
    .sort((a, b) => {
      if (sort === "frequency") return b.receiveCount30d - a.receiveCount30d;
      if (sort === "sender") return a.senderName.localeCompare(b.senderName, "ja");
      return scoreSubscription(b) - scoreSubscription(a);
    });

  elements.subscriptionRows.innerHTML = rows
    .map((item) => {
      const account = accountFor(item);
      const groupedCount = state.subscriptions.filter((subscription) => subscription.senderDomain === item.senderDomain).length;
      return `
        <tr>
          <td>
            <div class="sender">
              <strong>${item.senderName}</strong>
              <small>${item.senderDomain}${groupedCount > 1 ? ` / 名寄せ ${groupedCount}件` : ""}</small>
            </div>
          </td>
          <td>${account?.provider ?? "不明"}</td>
          <td>${item.category}</td>
          <td>${item.receiveCount30d}通</td>
          <td>${item.lastOpenedDays}日前</td>
          <td>${scoreBadge(scoreSubscription(item))}</td>
          <td>
            <div class="row-actions">
              <button class="unsubscribe" data-action="unsubscribe" data-id="${item.id}" type="button">解除</button>
              <button data-action="keep" data-id="${item.id}" type="button">保持</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderReports() {
  const byCategory = state.subscriptions.reduce((groups, item) => {
    groups[item.category] = (groups[item.category] ?? 0) + item.receiveCount30d;
    return groups;
  }, {});
  const max = Math.max(...Object.values(byCategory), 1);

  elements.reportBars.innerHTML = Object.entries(byCategory)
    .map(
      ([category, count]) => `
        <div class="bar-row">
          <strong>${category}</strong>
          <span class="bar-track"><span class="bar-fill" style="width: ${(count / max) * 100}%"></span></span>
          <span>${count}</span>
        </div>
      `,
    )
    .join("");

  const unsubscribed = state.subscriptions.filter((item) => item.unsubscribedAt);
  const savedMails = unsubscribed.reduce((sum, item) => sum + item.receiveCount30d, 0);
  elements.unsubscribedCount.textContent = `${unsubscribed.length}件`;
  elements.timeSaved.textContent = `推定節約時間 ${Math.round(savedMails * 0.35)}分/月`;
}

function renderWeights() {
  elements.openedWeight.value = state.weights.opened;
  elements.categoryWeight.value = state.weights.category;
  elements.frequencyWeight.value = state.weights.frequency;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.setTimeout(() => elements.toast.classList.remove("show"), 1800);
}

async function refreshGmailStatus() {
  try {
    const status = await fetchJson("/api/gmail/status");
    elements.connectGmail.disabled = !status.configured;
    elements.syncGmail.disabled = !status.connected;
    elements.gmailRedirectUri.textContent = `Redirect URI: ${status.redirectUri}`;

    if (!status.configured) {
      elements.gmailStatus.textContent = ".env の GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が未設定です。";
      return;
    }

    elements.gmailStatus.textContent = status.connected
      ? "Gmail接続済みです。本文は取得せず、指定ヘッダーだけ取得します。"
      : "Gmail未接続です。Gmail接続ボタンからOAuth認証してください。";
  } catch {
    elements.connectGmail.disabled = true;
    elements.syncGmail.disabled = true;
    elements.gmailStatus.textContent = "Gmail連携サーバーが起動していません。npm run dev:gmail で起動してください。";
    elements.gmailRedirectUri.textContent = "";
  }
}

async function importGmailSubscriptions() {
  elements.syncGmail.disabled = true;
  showToast("Gmailヘッダーを取得しています");

  try {
    const result = await fetchJson("/api/gmail/subscriptions");
    const accountId = `gmail-real-${result.email}`;
    upsertGmailAccount(accountId, result.email);

    const imported = result.subscriptions.map((item) => ({
      ...item,
      accountId,
      id: `${item.id}-${item.senderDomain}`,
      unsubscribedAt: null,
      kept: false,
    }));

    state.subscriptions = [
      ...state.subscriptions.filter((item) => item.accountId !== accountId),
      ...imported,
    ];
    showToast(`${result.scanned}件を確認し、購読候補${result.count}件を反映しました`);
    render();
  } catch (error) {
    showToast(error.message || "Gmail取得に失敗しました");
  } finally {
    await refreshGmailStatus();
  }
}

function upsertGmailAccount(accountId, email) {
  const now = new Date().toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const existing = state.accounts.find((account) => account.id === accountId);
  if (existing) {
    existing.status = "connected";
    existing.syncedAt = now;
    return;
  }

  state.accounts.push({
    id: accountId,
    provider: "Gmail",
    email,
    status: "connected",
    syncedAt: now,
  });
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

elements.subscriptionRows.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const subscription = state.subscriptions.find((item) => item.id === button.dataset.id);
  if (!subscription) return;

  if (button.dataset.action === "unsubscribe") {
    subscription.unsubscribedAt = new Date().toISOString();
    subscription.kept = false;
    showToast(`${subscription.senderName} を解除済みにしました`);
  }

  if (button.dataset.action === "keep") {
    subscription.kept = true;
    showToast(`${subscription.senderName} を保持に設定しました`);
  }

  render();
});

[elements.providerFilter, elements.categoryFilter, elements.sortOrder].forEach((control) => {
  control.addEventListener("change", render);
});

[elements.openedWeight, elements.categoryWeight, elements.frequencyWeight].forEach((control) => {
  control.addEventListener("input", () => {
    state.weights = {
      opened: Number(elements.openedWeight.value),
      category: Number(elements.categoryWeight.value),
      frequency: Number(elements.frequencyWeight.value),
    };
    render();
  });
});

elements.syncAll.addEventListener("click", () => {
  const now = new Date().toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  state.accounts = state.accounts.map((account) => ({ ...account, status: "connected", syncedAt: now }));
  showToast("全アカウントの同期状態を更新しました");
  render();
});

elements.connectGmail.addEventListener("click", () => {
  window.location.href = "/auth/google";
});

elements.syncGmail.addEventListener("click", () => {
  importGmailSubscriptions();
});

elements.addDemoAccount.addEventListener("click", () => {
  if (state.accounts.length >= 10) {
    showToast("接続可能なアカウント数は最大10件です");
    return;
  }

  const next = state.accounts.length + 1;
  state.accounts.push({
    id: `demo-${next}`,
    provider: "Yahoo! Mail",
    email: `demo${next}@example.com`,
    status: "connected",
    syncedAt: "未同期",
  });
  showToast("デモアカウントを追加しました");
  render();
});

elements.resetData.addEventListener("click", () => {
  state = structuredClone(defaultState);
  localStorage.removeItem(storageKey);
  showToast("デモデータに戻しました");
  render();
});

render();
refreshGmailStatus();
