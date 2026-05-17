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
    { id: "yahoo-1", provider: "Yahoo! Mail", email: "shopping@yahoo.example", status: "connected", syncedAt: "2026-05-16 09:15" },
  ],
  subscriptions: [
    { id: "s1", accountId: "gmail-1", senderName: "Daily Deals", senderDomain: "deals.example.jp", category: "広告・セール", lastOpenedDays: 220, receiveCount30d: 38, unsubscribedAt: null, kept: false },
    { id: "s2", accountId: "gmail-1", senderName: "Tech Weekly", senderDomain: "techweekly.example", category: "ニュースレター", lastOpenedDays: 112, receiveCount30d: 8, unsubscribedAt: null, kept: false },
    { id: "s3", accountId: "outlook-1", senderName: "Cloud Billing", senderDomain: "billing.example.com", category: "請求・領収書", lastOpenedDays: 12, receiveCount30d: 2, unsubscribedAt: null, kept: true },
    { id: "s4", accountId: "icloud-1", senderName: "Social Now", senderDomain: "social.example", category: "SNS通知", lastOpenedDays: 74, receiveCount30d: 21, unsubscribedAt: null, kept: false },
    { id: "s5", accountId: "outlook-1", senderName: "Product Updates", senderDomain: "updates.example.io", category: "サービス更新", lastOpenedDays: 45, receiveCount30d: 5, unsubscribedAt: null, kept: false },
    { id: "s6", accountId: "gmail-1", senderName: "Daily Deals", senderDomain: "deals.example.jp", category: "広告・セール", lastOpenedDays: 190, receiveCount30d: 31, unsubscribedAt: null, kept: false },
    { id: "s7", accountId: "yahoo-1", senderName: "Daily Deals", senderDomain: "deals.example.jp", category: "広告・セール", lastOpenedDays: 160, receiveCount30d: 36, unsubscribedAt: null, kept: false },
    { id: "s8", accountId: "yahoo-1", senderName: "Travel Club", senderDomain: "travel.example.jp", category: "ニュースレター", lastOpenedDays: 92, receiveCount30d: 14, unsubscribedAt: null, kept: false },
    { id: "s9", accountId: "gmail-1", senderName: "Amazon Store-News", senderEmail: "store-news@amazon.co.jp", senderDomain: "amazon.co.jp", category: "広告・セール", lastOpenedDays: 8, receiveCount30d: 24, unsubscribedAt: null, kept: false },
    { id: "s10", accountId: "outlook-1", senderName: "OpenWork", senderEmail: "news_today@openwork.jp", senderDomain: "openwork.jp", category: "ニュースレター", lastOpenedDays: 11, receiveCount30d: 22, unsubscribedAt: null, kept: false },
    { id: "s11", accountId: "icloud-1", senderName: "Lenovo", senderEmail: "lenovo@ecomm.lenovo.com", senderDomain: "ecomm.lenovo.com", category: "広告・セール", lastOpenedDays: 15, receiveCount30d: 20, unsubscribedAt: null, kept: false },
  ],
};

let state = loadState();
let pendingUnsubscribeIds = [];

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
  unsubscribeDialog: document.querySelector("#unsubscribeDialog"),
  unsubscribeDialogSummary: document.querySelector("#unsubscribeDialogSummary"),
  unsubscribeTargets: document.querySelector("#unsubscribeTargets"),
  closeUnsubscribeDialog: document.querySelector("#closeUnsubscribeDialog"),
  cancelUnsubscribe: document.querySelector("#cancelUnsubscribe"),
  confirmUnsubscribe: document.querySelector("#confirmUnsubscribe"),
  gmailActionInputs: document.querySelectorAll("input[name='gmailAction']"),
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

function activeSubscriptions() {
  return state.subscriptions.filter((item) => !item.unsubscribedAt);
}

function deliveryRegistrations() {
  const groups = new Map();

  for (const subscription of activeSubscriptions()) {
    const account = accountFor(subscription);
    const key = subscription.senderDomain || subscription.senderName;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        id: key,
        senderName: subscription.senderName,
        senderEmail: subscription.senderEmail || "",
        senderDomain: subscription.senderDomain,
        category: subscription.category,
        subscriptions: [subscription],
        accounts: account ? [account] : [],
        receiveCount30d: subscription.receiveCount30d,
        lastOpenedDays: subscription.lastOpenedDays,
        kept: subscription.kept,
        score: scoreSubscription(subscription),
        hasGmail: subscription.source === "gmail" || account?.provider === "Gmail",
      });
      continue;
    }

    existing.subscriptions.push(subscription);
    if (account && !existing.accounts.some((item) => item.id === account.id)) {
      existing.accounts.push(account);
    }
    existing.receiveCount30d += subscription.receiveCount30d;
    existing.lastOpenedDays = Math.max(existing.lastOpenedDays, subscription.lastOpenedDays);
    existing.kept = existing.kept && subscription.kept;
    existing.score = Math.max(existing.score, scoreSubscription(subscription));
    existing.hasGmail = existing.hasGmail || subscription.source === "gmail" || account?.provider === "Gmail";
    if (!existing.senderEmail && subscription.senderEmail) {
      existing.senderEmail = subscription.senderEmail;
    }

    if (existing.category === "サービス更新" && subscription.category !== "サービス更新") {
      existing.category = subscription.category;
    }
  }

  return [...groups.values()];
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
  const registrations = deliveryRegistrations();
  const highRisk = registrations.filter((item) => item.score >= 80);
  const savedMails = state.subscriptions
    .filter((item) => item.unsubscribedAt)
    .reduce((sum, item) => sum + item.receiveCount30d, 0);

  elements.accountCount.textContent = state.accounts.length;
  elements.subscriptionCount.textContent = registrations.length;
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

  const rows = deliveryRegistrations()
    .filter((item) => provider === "all" || item.accounts.some((account) => account.provider === provider))
    .filter((item) => category === "all" || item.category === category)
    .sort((a, b) => {
      if (sort === "frequency-asc") return a.receiveCount30d - b.receiveCount30d;
      return b.receiveCount30d - a.receiveCount30d;
    });

  elements.subscriptionRows.innerHTML = rows
    .map((item) => {
      const email = item.senderEmail || guessSenderEmail(item);
      const type = item.category === "広告・セール" || item.category === "ニュースレター" ? "メーリングリスト" : item.category;
      const recentLabel = item.receiveCount30d >= 20 ? "最近受信したメールが20件以上" : `最近30日で${item.receiveCount30d}件`;
      return `
        <tr>
          <td class="sender-name-cell">
            <span class="sender-avatar">${escapeHtml(initialFor(item.senderName))}</span>
            <div>
              <strong>${escapeHtml(item.senderName)}</strong>
              <small>${escapeHtml(accountSummary(item))}</small>
            </div>
          </td>
          <td class="email-cell">${escapeHtml(email)}</td>
          <td>${escapeHtml(recentLabel)}</td>
          <td>${escapeHtml(type)}</td>
          <td>
            <div class="row-actions">
              <button class="unsubscribe" data-action="unsubscribe" data-id="${item.id}" type="button">配信停止</button>
              <button data-action="keep-group" data-id="${item.id}" type="button">残す</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function initialFor(name) {
  const trimmed = String(name || "?").trim();
  return trimmed.charAt(0).toUpperCase();
}

function guessSenderEmail(registration) {
  const first = registration.subscriptions.find((item) => item.senderEmail);
  if (first?.senderEmail) return first.senderEmail;
  if (registration.senderDomain && registration.senderDomain !== "unknown") return `*@${registration.senderDomain}`;
  return "送信元メールアドレス未取得";
}

function accountSummary(registration) {
  const providers = [...new Set(registration.accounts.map((account) => account.provider))];
  return `${providers.join(" / ") || "未接続"} ・ ${registration.subscriptions.length}件`;
}

function registrationStatus(registration) {
  if (registration.kept) return `<span class="badge low">保持中</span>`;
  if (registration.score >= 80) return `<span class="badge high">整理候補</span>`;
  if (registration.score >= 50) return `<span class="badge medium">確認</span>`;
  return `<span class="badge low">低頻度</span>`;
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

function openUnsubscribeDialog(subscription) {
  const registration = typeof subscription === "string"
    ? deliveryRegistrations().find((item) => item.id === subscription)
    : null;
  const representative = registration?.subscriptions[0] || subscription;
  const account = accountFor(representative);
  const related = registration?.subscriptions || state.subscriptions
    .filter((item) => !item.unsubscribedAt)
    .filter((item) => item.senderDomain === representative.senderDomain);
  pendingUnsubscribeIds = related.map((item) => item.id);

  elements.unsubscribeDialogSummary.textContent =
    `${representative.senderName} (${representative.senderDomain}) の配信登録です。` +
    `どのメールアカウントに届いているかを確認し、管理対象外にしたいものはチェックを外してください。`;
  const trashAction = [...elements.gmailActionInputs].find((input) => input.value === "trash");
  if (trashAction) trashAction.checked = true;

  elements.unsubscribeTargets.innerHTML = related
    .map((item) => {
      const itemAccount = accountFor(item);
      const subject = item.subject ? `最新件名: ${escapeHtml(item.subject)}` : "件名情報なし";
      const unsubscribeHeader = item.unsubscribeHeader
        ? `List-Unsubscribe: ${escapeHtml(item.unsubscribeHeader)}`
        : "List-Unsubscribe: デモまたは未取得";

      return `
        <label class="target-option">
          <input type="checkbox" value="${item.id}" checked />
          <span>
            <strong>${escapeHtml(item.senderName)}</strong>
            <span>${escapeHtml(item.senderDomain)} / ${escapeHtml(itemAccount?.email ?? account?.email ?? "不明")} / ${escapeHtml(item.category)}</span>
            <small>${subject}<br>${unsubscribeHeader}</small>
          </span>
        </label>
      `;
    })
    .join("");

  elements.unsubscribeDialog.hidden = false;
}

function closeUnsubscribeDialog() {
  elements.unsubscribeDialog.hidden = true;
  pendingUnsubscribeIds = [];
}

async function confirmUnsubscribeSelection() {
  const checkedIds = [...elements.unsubscribeTargets.querySelectorAll("input:checked")].map((input) => input.value);
  const now = new Date().toISOString();
  let unsubscribedCount = 0;
  let keptCount = 0;
  const selectedSubscriptions = pendingUnsubscribeIds
    .map((id) => state.subscriptions.find((item) => item.id === id))
    .filter(Boolean)
    .filter((item) => checkedIds.includes(item.id));
  const gmailTargets = selectedSubscriptions
    .filter((item) => item.source === "gmail")
    .map((item) => ({
      senderDomain: item.senderDomain,
      senderName: item.senderName,
      messageIds: item.messageIds || [],
    }));
  const gmailAction = [...elements.gmailActionInputs].find((input) => input.checked)?.value || "trash";

  if (gmailTargets.length) {
    elements.confirmUnsubscribe.disabled = true;
    showToast(gmailAction === "spam" ? "Gmailで迷惑メール登録を実行しています" : "Gmailでゴミ箱移動を実行しています");
    try {
      const result = await postJson("/api/gmail/block-delete", {
        targets: dedupeTargets(gmailTargets),
        action: gmailAction,
      });
      const processedCount = result.results.reduce((sum, item) => sum + (item.spammedCount || item.trashedCount || 0), 0);
      const details = result.results
        .map((item) => `${item.senderDomain}: ${item.spammedCount || item.trashedCount || 0}件`)
        .join(" / ");
      showToast(gmailAction === "spam"
        ? `Gmail迷惑メール登録完了: ${processedCount}件`
        : `Gmailゴミ箱移動完了: ${processedCount}件`);
      console.info("Gmail block/delete result", result);
      if (processedCount === 0) {
        showToast("Gmail処理は完了しましたが、対象の既存メールは0件でした");
      } else if (details) {
        showToast(`Gmail処理: ${details}`);
      }
    } catch (error) {
      elements.confirmUnsubscribe.disabled = false;
      showToast(error.message || "Gmail処理に失敗しました。再接続が必要な場合があります。");
      return;
    }
  }

  for (const id of pendingUnsubscribeIds) {
    const subscription = state.subscriptions.find((item) => item.id === id);
    if (!subscription) continue;

    if (checkedIds.includes(id)) {
      subscription.unsubscribedAt = now;
      subscription.kept = false;
      unsubscribedCount += 1;
    } else {
      subscription.kept = true;
      keptCount += 1;
    }
  }

  closeUnsubscribeDialog();
  elements.confirmUnsubscribe.disabled = false;
  showToast(`解除済み ${unsubscribedCount}件 / 対象外 ${keptCount}件として保存しました`);
  render();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

    if (status.needsReconnect) {
      elements.gmailStatus.textContent = "Gmail権限が古い状態です。ブロック/ゴミ箱移動のため、Gmail接続をやり直してください。";
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
    elements.gmailStatus.textContent =
      `Gmail取得完了: ${result.scanned}件をスキャンし、購読候補${result.count}件を反映しました。`;
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

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function dedupeTargets(targets) {
  const map = new Map();
  for (const target of targets) {
    const current = map.get(target.senderDomain);
    if (!current) {
      map.set(target.senderDomain, { ...target, messageIds: target.messageIds || [] });
      continue;
    }
    current.messageIds = [...new Set([...(current.messageIds || []), ...(target.messageIds || [])])];
  }
  return [...map.values()];
}

elements.subscriptionRows.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  if (button.dataset.action === "unsubscribe") {
    openUnsubscribeDialog(button.dataset.id);
    return;
  }

  const subscription = state.subscriptions.find((item) => item.id === button.dataset.id);
  if (button.dataset.action === "keep") {
    if (!subscription) return;
    subscription.kept = true;
    showToast(`${subscription.senderName} を保持に設定しました`);
  }

  if (button.dataset.action === "keep-group") {
    const registration = deliveryRegistrations().find((item) => item.id === button.dataset.id);
    if (registration) {
      for (const item of registration.subscriptions) {
        item.kept = true;
      }
      showToast(`${registration.senderName} を保持に設定しました`);
    }
  }

  render();
});

elements.closeUnsubscribeDialog.addEventListener("click", closeUnsubscribeDialog);
elements.cancelUnsubscribe.addEventListener("click", closeUnsubscribeDialog);
elements.unsubscribeDialog.addEventListener("click", (event) => {
  if (event.target === elements.unsubscribeDialog) {
    closeUnsubscribeDialog();
  }
});
elements.confirmUnsubscribe.addEventListener("click", confirmUnsubscribeSelection);

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
