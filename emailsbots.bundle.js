(() => {
  // Assistant/core/helpers.js
  function cleanText(value) {
    if (value === null || value === void 0) return "";
    const text = String(value).replace(/\u00a0/g, " ").trim();
    return text === "undefined" || text === "null" ? "" : text;
  }
  function normalizeText(value) {
    return cleanText(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  }
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
  function isPlainObject(value) {
    return Boolean(value) && Object.prototype.toString.call(value) === "[object Object]";
  }
  function deepClone(value) {
    return JSON.parse(JSON.stringify(value ?? {}));
  }
  function deepMerge(base, override) {
    if (!isPlainObject(base) || !isPlainObject(override)) {
      return override === void 0 ? deepClone(base) : deepClone(override);
    }
    const output = deepClone(base);
    Object.entries(override).forEach(([key, value]) => {
      if (isPlainObject(value) && isPlainObject(output[key])) {
        output[key] = deepMerge(output[key], value);
        return;
      }
      output[key] = deepClone(value);
    });
    return output;
  }
  function parseJson(rawValue, fallback = null) {
    try {
      return rawValue ? JSON.parse(rawValue) : fallback;
    } catch (error) {
      return fallback;
    }
  }
  function escapeCssIdentifier(value) {
    const text = cleanText(value);
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(text);
    }
    return text.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");
  }
  function escapeHtml(value) {
    return cleanText(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function createRecordKey({ table, sysId, ticketNumber }) {
    const primary = cleanText(sysId) || cleanText(ticketNumber) || "unknown";
    return `${cleanText(table) || "unknown"}::${primary}`;
  }
  function formatToday(language = "en") {
    const locale = language === "fr" ? "fr-FR" : "en-GB";
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(/* @__PURE__ */ new Date());
  }
  function titleCase(value) {
    return cleanText(value).split(/[\s_-]+/).filter(Boolean).map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1)).join(" ");
  }

  // Assistant/sn/form.js
  function getRootWindow() {
    try {
      return window.top || window;
    } catch (error) {
      return window;
    }
  }
  function getAccessibleWindows(rootWindow = getRootWindow()) {
    const queue = [rootWindow];
    const seen = /* @__PURE__ */ new Set();
    const results = [];
    while (queue.length) {
      const current = queue.shift();
      if (!current || seen.has(current)) continue;
      seen.add(current);
      results.push(current);
      try {
        for (let index = 0; index < current.frames.length; index += 1) {
          queue.push(current.frames[index]);
        }
      } catch (error) {
        continue;
      }
    }
    return results;
  }
  function getAccessibleDocuments(rootWindow = getRootWindow()) {
    const documents = [];
    getAccessibleWindows(rootWindow).forEach((win) => {
      try {
        if (win.document && !documents.includes(win.document)) {
          documents.push(win.document);
        }
      } catch (error) {
        return;
      }
    });
    return documents;
  }
  function scoreGForm(gForm) {
    let score = 0;
    try {
      if (cleanText(gForm.getTableName && gForm.getTableName())) score += 3;
    } catch (error) {
      score += 0;
    }
    try {
      if (cleanText(gForm.getUniqueValue && gForm.getUniqueValue())) score += 3;
    } catch (error) {
      score += 0;
    }
    try {
      if (cleanText(gForm.getValue && gForm.getValue("number"))) score += 2;
    } catch (error) {
      score += 0;
    }
    try {
      if (cleanText(gForm.getValue && gForm.getValue("short_description"))) score += 1;
    } catch (error) {
      score += 0;
    }
    return score;
  }
  function getBestGForm(rootWindow = getRootWindow()) {
    let bestMatch = null;
    getAccessibleWindows(rootWindow).forEach((win) => {
      try {
        const gForm = win.g_form;
        if (!gForm || typeof gForm.getValue !== "function") return;
        const score = scoreGForm(gForm);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { window: win, gForm, score };
        }
      } catch (error) {
        return;
      }
    });
    return bestMatch;
  }
  function findFormRoot(documentRef) {
    const selectors = ["#sys_form", 'form[name="sys_form"]', "#sysparm_form", "form"];
    for (const selector of selectors) {
      try {
        const match = documentRef.querySelector(selector);
        if (match) return match;
      } catch (error) {
        continue;
      }
    }
    return documentRef.body || documentRef.documentElement || null;
  }
  function getHostDocument(rootWindow = getRootWindow()) {
    const bestGForm = getBestGForm(rootWindow);
    if (bestGForm?.window?.document) return bestGForm.window.document;
    const documents = getAccessibleDocuments(rootWindow);
    const ranked = documents.map((documentRef) => {
      const root = findFormRoot(documentRef);
      const rect = root?.getBoundingClientRect?.();
      return {
        documentRef,
        score: rect ? rect.width * rect.height : 0
      };
    }).sort((left, right) => right.score - left.score);
    return ranked[0]?.documentRef || document;
  }
  function findElementByIdAcrossDocuments(id, rootWindow = getRootWindow()) {
    for (const documentRef of getAccessibleDocuments(rootWindow)) {
      try {
        const element = documentRef.getElementById(id);
        if (element) return { documentRef, element };
      } catch (error) {
        continue;
      }
    }
    return null;
  }

  // Assistant/sn/tables.js
  var COMMENTS_TARGET = {
    fieldNames: ["comments", "comments_and_work_notes"],
    selectors: [
      "#activity-stream-comments-textarea",
      "#activity-stream-comments_and_work_notes-textarea",
      "#comments",
      'textarea[name="comments"]',
      'textarea[id="comments"]',
      'textarea[name="comments_and_work_notes"]',
      'textarea[id="comments_and_work_notes"]',
      'textarea[id*="comments"]'
    ]
  };
  var WORK_NOTES_TARGET = {
    fieldNames: ["work_notes"],
    selectors: [
      "#activity-stream-work_notes-textarea",
      "#work_notes",
      'textarea[name="work_notes"]',
      'textarea[id="work_notes"]',
      'textarea[id*="work_notes"]'
    ]
  };
  var TABLES = {
    incident: {
      label: "Incident",
      userFieldCandidates: ["caller_id", "opened_for", "u_requested_for"],
      emailFieldCandidates: ["u_email", "email", "caller_id.email", "opened_for.email"],
      cmdbCiSelectors: [
        "#sys_display\\.incident\\.cmdb_ci",
        'input[id="sys_display.incident.cmdb_ci"]',
        "#sys_display\\.task\\.cmdb_ci"
      ],
      targets: {
        comments: COMMENTS_TARGET,
        work_notes: WORK_NOTES_TARGET
      }
    },
    sc_task: {
      label: "SC Task",
      userFieldCandidates: [
        "request_item.request.requested_for",
        "request.requested_for",
        "requested_for"
      ],
      emailFieldCandidates: [
        "requested_for.email",
        "request_item.request.requested_for.email",
        "request.requested_for.email",
        "email"
      ],
      cmdbCiSelectors: [
        "#sys_display\\.sc_task\\.cmdb_ci",
        'input[id="sys_display.sc_task.cmdb_ci"]',
        "#sys_display\\.task\\.cmdb_ci",
        'input[id*="cmdb_ci"]'
      ],
      previewButtonId: "viewr.sc_task.request_item.request.requested_for",
      piAssetPrefix: "MUSTBRUN",
      targets: {
        comments: COMMENTS_TARGET,
        work_notes: WORK_NOTES_TARGET
      }
    },
    sc_req_item: {
      label: "RITM",
      userFieldCandidates: ["requested_for", "request.requested_for", "opened_by"],
      emailFieldCandidates: ["requested_for.email", "email", "opened_by.email"],
      cmdbCiSelectors: [
        "#sys_display\\.sc_req_item\\.cmdb_ci",
        'input[id="sys_display.sc_req_item.cmdb_ci"]',
        "#sys_display\\.task\\.cmdb_ci"
      ],
      targets: {
        comments: COMMENTS_TARGET,
        work_notes: WORK_NOTES_TARGET
      }
    },
    sc_request: {
      label: "Request",
      userFieldCandidates: ["requested_for", "opened_by"],
      emailFieldCandidates: ["requested_for.email", "email", "opened_by.email"],
      cmdbCiSelectors: [
        "#sys_display\\.sc_request\\.cmdb_ci",
        'input[id="sys_display.sc_request.cmdb_ci"]',
        "#sys_display\\.task\\.cmdb_ci"
      ],
      targets: {
        comments: COMMENTS_TARGET,
        work_notes: WORK_NOTES_TARGET
      }
    }
  };
  function isSupportedTable(table) {
    return Boolean(TABLES[table]);
  }
  function getTableConfig(table) {
    return TABLES[table] || null;
  }
  function getTableLabel(table) {
    return TABLES[table]?.label || titleCase(table);
  }

  // Assistant/sn/fields.js
  function parseDisplayName(displayValue) {
    const text = cleanText(displayValue);
    if (!text) return { firstName: "", lastName: "", fullName: "" };
    if (text.includes(",")) {
      const [lastName, firstName] = text.split(",").map((segment) => cleanText(segment));
      return {
        firstName,
        lastName,
        fullName: [firstName, lastName].filter(Boolean).join(" ").trim()
      };
    }
    const parts = text.split(/\s+/).filter(Boolean);
    return {
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" "),
      fullName: text
    };
  }
  function safeGetValue(fieldName, rootWindow = getRootWindow()) {
    try {
      const bestGForm = getBestGForm(rootWindow);
      if (!bestGForm?.gForm) return "";
      return cleanText(bestGForm.gForm.getValue(fieldName));
    } catch (error) {
      return "";
    }
  }
  function safeGetDisplayValue(fieldName, rootWindow = getRootWindow()) {
    try {
      const bestGForm = getBestGForm(rootWindow);
      if (!bestGForm?.gForm || typeof bestGForm.gForm.getDisplayValue !== "function") return "";
      return cleanText(bestGForm.gForm.getDisplayValue(fieldName));
    } catch (error) {
      return "";
    }
  }
  function getFirstValue(selectors, rootWindow = getRootWindow()) {
    for (const documentRef of getAccessibleDocuments(rootWindow)) {
      for (const selector of selectors) {
        try {
          const element = documentRef.querySelector(selector);
          if (!element) continue;
          const value = cleanText(element.value || element.textContent || element.innerText);
          if (value) return value;
        } catch (error) {
          continue;
        }
      }
    }
    return "";
  }
  function getFieldDisplayValue(fieldName, rootWindow = getRootWindow()) {
    const escapedFieldName = escapeCssIdentifier(fieldName);
    return getFirstValue(
      [
        `#sys_display\\.${escapedFieldName}`,
        `#${escapedFieldName}`,
        `input[id="sys_display.${fieldName}"]`,
        `input[id="${fieldName}"]`,
        `input[name="${fieldName}"]`,
        `textarea[id="${fieldName}"]`,
        `textarea[name="${fieldName}"]`
      ],
      rootWindow
    );
  }
  function getTicketNumber(table, rootWindow = getRootWindow()) {
    return safeGetValue("number", rootWindow) || getFirstValue(
      [
        `#${escapeCssIdentifier(table)}\\.number`,
        "#number",
        'input[name="number"]',
        'input[id="number"]'
      ],
      rootWindow
    );
  }
  function getShortDescription(table, rootWindow = getRootWindow()) {
    return safeGetValue("short_description", rootWindow) || getFirstValue(
      [
        `#${escapeCssIdentifier(table)}\\.short_description`,
        "#short_description",
        'input[name="short_description"]',
        'textarea[name="short_description"]'
      ],
      rootWindow
    );
  }
  function getDescription(table, rootWindow = getRootWindow()) {
    return safeGetValue("description", rootWindow) || getFirstValue(
      [
        `#${escapeCssIdentifier(table)}\\.description`,
        "#description",
        'textarea[name="description"]'
      ],
      rootWindow
    );
  }
  function getConfigurationItem(table, rootWindow = getRootWindow()) {
    const config = getTableConfig(table);
    if (!config) return "";
    return safeGetDisplayValue("cmdb_ci", rootWindow) || getFirstValue(config.cmdbCiSelectors || [], rootWindow);
  }
  function resolveUserFromForm(table, rootWindow = getRootWindow()) {
    const config = getTableConfig(table);
    const user = {
      firstName: "",
      lastName: "",
      fullName: "",
      email: ""
    };
    if (!config) return user;
    for (const fieldName of config.userFieldCandidates || []) {
      const displayValue = safeGetDisplayValue(fieldName, rootWindow) || getFieldDisplayValue(fieldName, rootWindow);
      if (!displayValue) continue;
      const parsed = parseDisplayName(displayValue);
      user.firstName = user.firstName || parsed.firstName;
      user.lastName = user.lastName || parsed.lastName;
      user.fullName = user.fullName || parsed.fullName;
      break;
    }
    for (const fieldName of config.emailFieldCandidates || []) {
      const emailValue = safeGetValue(fieldName, rootWindow) || getFieldDisplayValue(fieldName, rootWindow);
      if (emailValue.includes("@")) {
        user.email = emailValue;
        break;
      }
    }
    return user;
  }
  function getAgentName(rootWindow = getRootWindow()) {
    const sources = [
      rootWindow.NOW?.user_display_name,
      rootWindow.NOW?.user?.displayName,
      rootWindow.NOW?.user?.name,
      rootWindow.g_user?.fullName,
      [rootWindow.g_user?.firstName, rootWindow.g_user?.lastName].filter(Boolean).join(" ")
    ];
    const directMatch = sources.map((entry) => cleanText(entry)).find(Boolean);
    if (directMatch) return directMatch;
    return getFirstValue(
      [
        "#user_info_dropdown .user-name",
        "#user_info_dropdown .name",
        "[data-user-display-name]",
        ".navpage-header-content .name"
      ],
      rootWindow
    ) || "IT Support";
  }

  // Assistant/core/context.js
  function extractNestedUri(rawHref) {
    const href = cleanText(rawHref);
    if (!href) return "";
    try {
      const url = new URL(href, window.location.origin);
      const nestedUri = url.searchParams.get("uri");
      return nestedUri ? decodeURIComponent(nestedUri) : href;
    } catch (error) {
      const match = href.match(/[?&]uri=([^&]+)/i);
      return match ? decodeURIComponent(match[1]) : href;
    }
  }
  function detectTable(rootWindow = getRootWindow()) {
    const bestGForm = getBestGForm(rootWindow);
    try {
      const tableName = cleanText(bestGForm?.gForm?.getTableName?.());
      if (tableName) return tableName.toLowerCase();
    } catch (error) {
      return "";
    }
    const patterns = [
      /(?:^|\/)(incident|sc_task|sc_req_item|sc_request)\.do/i,
      /(?:sysparm_table=)(incident|sc_task|sc_req_item|sc_request)/i,
      /(?:table=)(incident|sc_task|sc_req_item|sc_request)/i
    ];
    for (const win of getAccessibleWindows(rootWindow)) {
      let href = "";
      try {
        href = extractNestedUri(win.location.href);
      } catch (error) {
        href = "";
      }
      for (const pattern of patterns) {
        const match = href.match(pattern);
        if (match?.[1]) return cleanText(match[1]).toLowerCase();
      }
    }
    return "";
  }
  function detectSysId(rootWindow = getRootWindow()) {
    const bestGForm = getBestGForm(rootWindow);
    try {
      const sysId = cleanText(bestGForm?.gForm?.getUniqueValue?.());
      if (sysId) return sysId;
    } catch (error) {
      return "";
    }
    for (const win of getAccessibleWindows(rootWindow)) {
      try {
        const href = extractNestedUri(win.location.href);
        const match = href.match(/[?&](?:sys_id|sysparm_sys_id)=([0-9a-f]{32})/i);
        if (match?.[1]) return cleanText(match[1]);
      } catch (error) {
        continue;
      }
    }
    return "";
  }
  function getCurrentContext(rootWindow = getRootWindow()) {
    const table = detectTable(rootWindow);
    const ticketNumber = getTicketNumber(table, rootWindow);
    const sysId = detectSysId(rootWindow);
    const recordKey = createRecordKey({ table, sysId, ticketNumber });
    const supported = isSupportedTable(table);
    return {
      ready: Boolean(table || ticketNumber || sysId),
      supported,
      table,
      tableLabel: getTableLabel(table),
      tableConfig: getTableConfig(table),
      sysId,
      recordKey,
      ticketNumber,
      recordNumber: ticketNumber,
      shortDescription: getShortDescription(table, rootWindow),
      description: getDescription(table, rootWindow),
      configurationItem: getConfigurationItem(table, rootWindow),
      user: resolveUserFromForm(table, rootWindow),
      agentName: getAgentName(rootWindow)
    };
  }
  function isContextChanged(previousContext, nextContext) {
    if (!previousContext && nextContext) return true;
    if (previousContext && !nextContext) return true;
    if (!previousContext && !nextContext) return false;
    return previousContext.recordKey !== nextContext.recordKey;
  }

  // Assistant/ui/ids.js
  var ROOT_ATTRIBUTE = "data-sn-assistant-root";
  var ROOT_VALUE = "true";
  var UI_IDS = {
    style: "sn-assistant-styles",
    launcher: "sn-assistant-launcher",
    panel: "sn-assistant-panel",
    settings: "sn-assistant-settings",
    settingsImportInput: "sn-assistant-settings-import",
    toastViewport: "sn-assistant-toasts"
  };

  // Assistant/core/observer.js
  function isAssistantNode(node) {
    if (!node || typeof node !== "object") return false;
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return isAssistantNode(node.parentElement || node.parentNode);
    }
    return Boolean(node.closest?.(`[${ROOT_ATTRIBUTE}]`));
  }
  function shouldReactToMutations(mutations) {
    return mutations.some((mutation) => {
      if (!isAssistantNode(mutation.target)) return true;
      const addedOutside = Array.from(mutation.addedNodes || []).some((node) => !isAssistantNode(node));
      const removedOutside = Array.from(mutation.removedNodes || []).some((node) => !isAssistantNode(node));
      return addedOutside || removedOutside;
    });
  }
  function syncObservers({ state, onMutation, logger }) {
    const documents = getAccessibleDocuments();
    state.lifecycle.observers = state.lifecycle.observers.filter((entry) => {
      if (!documents.includes(entry.documentRef) || !entry.documentRef.body) {
        entry.observer.disconnect();
        return false;
      }
      return true;
    });
    documents.forEach((documentRef) => {
      const alreadyObserved = state.lifecycle.observers.some((entry) => entry.documentRef === documentRef);
      if (alreadyObserved || !documentRef.body) return;
      const observer = new MutationObserver((mutations) => {
        if (!shouldReactToMutations(mutations)) return;
        onMutation("dom-mutation");
      });
      observer.observe(documentRef.body, {
        childList: true,
        subtree: true
      });
      state.lifecycle.observers.push({ documentRef, observer });
      logger?.info("observer attached");
    });
  }
  function startHeartbeat({ state, onTick, intervalMs = 1500 }) {
    if (state.lifecycle.heartbeatId) return;
    state.lifecycle.heartbeatId = window.setInterval(onTick, intervalMs);
  }
  function stopObserverSystem(state) {
    state.lifecycle.observers.forEach((entry) => entry.observer.disconnect());
    state.lifecycle.observers = [];
    if (state.lifecycle.heartbeatId) {
      window.clearInterval(state.lifecycle.heartbeatId);
      state.lifecycle.heartbeatId = 0;
    }
  }

  // Assistant/core/storage.js
  var TEMP_WORKSPACE = "temp/sn-assistant";
  var STORAGE_KEYS = {
    settings: "sn_assistant_temp_workspace_v3/settings"
  };
  var LEGACY_STORAGE_KEYS = ["sn_assistant_settings_v2"];
  var DEFAULT_SETTINGS = Object.freeze({
    officeProfile: "custom",
    officeName: "IT Office",
    officeRoom: "Front Desk",
    officeLabel: "IT Welcome Desk",
    defaultLanguage: "en",
    toggles: {
      autoCopyToClipboard: true,
      autoOpenDraft: false,
      autoFillUserEmail: true
    },
    templateOverrides: {
      email: {},
      work_note: {},
      internal: {}
    }
  });
  var OFFICE_PRESETS = {
    kohl: {
      id: "kohl",
      label: "Kohl",
      officeName: "Kohl",
      officeRoom: "",
      officeLabel: "IT Welcome Desk at Kohl"
    },
    spinelli: {
      id: "spinelli",
      label: "Spinelli",
      officeName: "Spinelli",
      officeRoom: "",
      officeLabel: "IT Welcome Desk at Spinelli"
    },
    strasbourg_pflimlin: {
      id: "strasbourg_pflimlin",
      label: "Strasbourg / Pflimlin",
      officeName: "Strasbourg / Pflimlin",
      officeRoom: "",
      officeLabel: "IT Welcome Desk at Strasbourg / Pflimlin"
    },
    custom: {
      id: "custom",
      label: "Custom",
      officeName: DEFAULT_SETTINGS.officeName,
      officeRoom: DEFAULT_SETTINGS.officeRoom,
      officeLabel: DEFAULT_SETTINGS.officeLabel
    }
  };
  var LANGUAGE_OPTIONS = [
    { value: "en", label: "English" },
    { value: "fr", label: "Francais" }
  ];
  function getSessionStorage(rootWindow) {
    try {
      return rootWindow.sessionStorage || window.sessionStorage;
    } catch (error) {
      return null;
    }
  }
  function getLocalStorage(rootWindow) {
    try {
      return rootWindow.localStorage || window.localStorage;
    } catch (error) {
      return null;
    }
  }
  function getPersistentStorage(rootWindow) {
    return getLocalStorage(rootWindow) || getSessionStorage(rootWindow);
  }
  function getLegacySettings(rootWindow) {
    const storages = [getLocalStorage(rootWindow), getSessionStorage(rootWindow)].filter(Boolean);
    for (const storage of storages) {
      for (const key of LEGACY_STORAGE_KEYS) {
        const rawValue = storage.getItem(key);
        if (rawValue) {
          return rawValue;
        }
      }
    }
    return "";
  }
  function sanitizeTemplateOverrideEntry(value) {
    const entry = value && typeof value === "object" ? value : {};
    return {
      subject: cleanText(entry.subject),
      body: cleanText(entry.body),
      label: cleanText(entry.label),
      target: cleanText(entry.target)
    };
  }
  function sanitizeTemplateOverrides(rawValue) {
    const categories = ["email", "work_note", "internal"];
    const output = {};
    categories.forEach((category) => {
      output[category] = {};
      const rawCategory = rawValue && typeof rawValue === "object" ? rawValue[category] : null;
      if (!rawCategory || typeof rawCategory !== "object") return;
      Object.entries(rawCategory).forEach(([templateId, override]) => {
        output[category][templateId] = sanitizeTemplateOverrideEntry(override);
      });
    });
    return output;
  }
  function getDefaultSettings() {
    return deepClone(DEFAULT_SETTINGS);
  }
  function sanitizeSettings(input = {}) {
    const defaults = getDefaultSettings();
    const merged = deepMerge(defaults, input);
    const toggles = merged.toggles || {};
    return {
      officeProfile: cleanText(merged.officeProfile).toLowerCase() || defaults.officeProfile,
      officeName: cleanText(merged.officeName),
      officeRoom: cleanText(merged.officeRoom),
      officeLabel: cleanText(merged.officeLabel),
      defaultLanguage: cleanText(merged.defaultLanguage) || defaults.defaultLanguage,
      toggles: {
        autoCopyToClipboard: toggles.autoCopyToClipboard !== false,
        autoOpenDraft: toggles.autoOpenDraft === true,
        autoFillUserEmail: toggles.autoFillUserEmail !== false
      },
      templateOverrides: sanitizeTemplateOverrides(merged.templateOverrides)
    };
  }
  function hasRequiredSettings(settings) {
    const safeSettings = sanitizeSettings(settings);
    return Boolean(
      safeSettings.officeProfile && safeSettings.officeName && safeSettings.officeRoom && safeSettings.officeLabel && safeSettings.defaultLanguage
    );
  }
  function applyOfficePreset(profile, baseSettings = getDefaultSettings()) {
    const safeBase = sanitizeSettings(baseSettings);
    const normalizedProfile = cleanText(profile).toLowerCase();
    const preset = OFFICE_PRESETS[normalizedProfile];
    if (!preset || preset.id === "custom") {
      return sanitizeSettings({
        ...safeBase,
        officeProfile: normalizedProfile || "custom"
      });
    }
    return sanitizeSettings({
      ...safeBase,
      officeProfile: preset.id,
      officeName: cleanText(preset.officeName) || safeBase.officeName,
      officeRoom: cleanText(preset.officeRoom) || safeBase.officeRoom,
      officeLabel: cleanText(preset.officeLabel) || safeBase.officeLabel
    });
  }
  function loadSettings(rootWindow, logger) {
    const storage = getPersistentStorage(rootWindow);
    if (!storage) {
      logger?.warn("browser storage unavailable, using defaults");
      return getDefaultSettings();
    }
    const rawValue = storage.getItem(STORAGE_KEYS.settings) || getLegacySettings(rootWindow);
    const parsed = parseJson(rawValue, getDefaultSettings());
    return sanitizeSettings(parsed);
  }
  function saveSettings(rootWindow, settings, logger) {
    const storage = getPersistentStorage(rootWindow);
    const safeSettings = sanitizeSettings(settings);
    if (!storage) {
      logger?.warn("browser storage unavailable, settings kept only in memory");
      return safeSettings;
    }
    storage.setItem(STORAGE_KEYS.settings, JSON.stringify(safeSettings));
    return safeSettings;
  }
  function cloneSettings(settings) {
    return deepClone(sanitizeSettings(settings));
  }
  function buildPackageFilename() {
    const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    return `sn-assistant-templates-${stamp}.json`;
  }
  function buildSettingsPackage(settings) {
    return {
      schema: "sn-assistant-template-package",
      version: 1,
      workspace: TEMP_WORKSPACE,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      settings: sanitizeSettings(settings)
    };
  }
  async function tryWritePackageToTempFolder(rootWindow, fileName, payloadText) {
    if (typeof rootWindow?.showDirectoryPicker !== "function") {
      return null;
    }
    const baseDirectoryHandle = await rootWindow.showDirectoryPicker({ mode: "readwrite" });
    const tempDirectoryHandle = await baseDirectoryHandle.getDirectoryHandle("temp", { create: true });
    const assistantDirectoryHandle = await tempDirectoryHandle.getDirectoryHandle("sn-assistant", { create: true });
    const fileHandle = await assistantDirectoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(payloadText);
    await writable.close();
    return {
      mode: "filesystem",
      fileName,
      path: `${TEMP_WORKSPACE}/${fileName}`
    };
  }
  function downloadPackage(rootWindow, fileName, payloadText) {
    const blob = new Blob([payloadText], { type: "application/json" });
    const objectUrl = rootWindow.URL.createObjectURL(blob);
    const anchor = rootWindow.document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.style.display = "none";
    (rootWindow.document.body || rootWindow.document.documentElement).appendChild(anchor);
    anchor.click();
    anchor.remove();
    rootWindow.setTimeout(() => rootWindow.URL.revokeObjectURL(objectUrl), 0);
    return {
      mode: "download",
      fileName
    };
  }
  async function exportSettingsPackage(rootWindow, settings) {
    const fileName = buildPackageFilename();
    const payloadText = JSON.stringify(buildSettingsPackage(settings), null, 2);
    if (typeof rootWindow?.showDirectoryPicker === "function") {
      try {
        const fileResult = await tryWritePackageToTempFolder(rootWindow, fileName, payloadText);
        if (fileResult) {
          return {
            ok: true,
            ...fileResult
          };
        }
      } catch (error) {
        if (error?.name === "AbortError") {
          return { ok: false, canceled: true };
        }
      }
    }
    return {
      ok: true,
      ...downloadPackage(rootWindow, fileName, payloadText)
    };
  }
  async function importSettingsPackage(file) {
    if (!file) {
      throw new Error("No file selected");
    }
    const rawText = await file.text();
    const parsed = parseJson(rawText, null);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid settings file");
    }
    const rawSettings = parsed.settings && typeof parsed.settings === "object" ? parsed.settings : parsed;
    return sanitizeSettings(rawSettings);
  }

  // Assistant/core/state.js
  function createPendingActions() {
    return {
      copy: false,
      insert: false,
      draft: false,
      piSearch: false
    };
  }
  function createState(settings) {
    return {
      settings,
      context: null,
      host: {
        document: null
      },
      ui: {
        launcherPosition: null,
        panelPosition: null,
        panelOpen: false,
        panelCollapsed: false,
        settingsOpen: false,
        settingsMandatory: false,
        activeCategory: "email",
        selectedTemplates: {
          email: "",
          work_note: "",
          internal: ""
        },
        templateManagerCategory: "email",
        settingsDraft: null
      },
      lifecycle: {
        started: false,
        recovering: false,
        queuedReason: "",
        recoveryTimer: 0,
        heartbeatId: 0,
        observers: []
      },
      caches: {
        userByRecord: {},
        piByRecord: {}
      },
      pendingActions: createPendingActions(),
      flags: {
        missingSettingsLogged: false
      }
    };
  }
  function handleRecordChange(state, nextContext) {
    state.context = nextContext;
    state.pendingActions = createPendingActions();
  }
  function setSettings(state, settings) {
    state.settings = deepClone(settings);
  }
  function ensureSettingsDraft(state) {
    if (!state.ui.settingsDraft) {
      state.ui.settingsDraft = deepClone(state.settings);
    }
    return state.ui.settingsDraft;
  }
  function setSettingsDraft(state, draft) {
    state.ui.settingsDraft = deepClone(draft);
  }
  function discardSettingsDraft(state) {
    state.ui.settingsDraft = null;
  }
  function openSettings(state, mandatory = false) {
    state.ui.settingsOpen = true;
    state.ui.settingsMandatory = mandatory || state.ui.settingsMandatory;
    state.ui.panelOpen = false;
    ensureSettingsDraft(state);
  }
  function closeSettings(state) {
    if (state.ui.settingsMandatory) return false;
    state.ui.settingsOpen = false;
    state.ui.settingsDraft = null;
    return true;
  }
  function setActiveCategory(state, category) {
    state.ui.activeCategory = category;
  }
  function setSelectedTemplate(state, category, templateId) {
    state.ui.selectedTemplates[category] = templateId;
  }
  function getSelectedTemplate(state, category) {
    return state.ui.selectedTemplates[category] || "";
  }

  // Assistant/sn/actions.js
  var USER_POPUP_SELECTORS = [
    ".popover",
    '[role="dialog"]',
    'div[id^="popover"]',
    ".modal",
    ".glide_box"
  ];
  function dispatchInputEvents(element) {
    ["input", "change", "blur"].forEach((eventName) => {
      element.dispatchEvent(new Event(eventName, { bubbles: true }));
    });
  }
  function setElementValue(element, value) {
    if (!element) return false;
    try {
      element.focus();
    } catch (error) {
    }
    element.value = value;
    dispatchInputEvents(element);
    return true;
  }
  async function waitFor(predicate, timeoutMs = 5e3, intervalMs = 150) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const result = await predicate();
      if (result) return result;
      await delay(intervalMs);
    }
    return null;
  }
  function getPopupValue(popup, selectors) {
    for (const selector of selectors) {
      try {
        const element = popup.querySelector(selector);
        if (!element) continue;
        const value = cleanText(element.value || element.textContent);
        if (value) return value;
      } catch (error) {
        continue;
      }
    }
    return "";
  }
  function findUserPopup(rootWindow = getRootWindow()) {
    for (const documentRef of getAccessibleDocuments(rootWindow)) {
      for (const selector of USER_POPUP_SELECTORS) {
        try {
          const popups = Array.from(documentRef.querySelectorAll(selector));
          const popup = popups.find((entry) => {
            const html = entry.innerHTML || "";
            return html.includes("sys_user.email") || html.includes("sys_user.first_name");
          });
          if (popup) return { popup, documentRef };
        } catch (error) {
          continue;
        }
      }
    }
    return null;
  }
  function hidePopup(popup, documentRef) {
    if (!popup) return;
    try {
      popup.style.display = "none";
      popup.style.visibility = "hidden";
      popup.style.opacity = "0";
      popup.style.pointerEvents = "none";
      popup.setAttribute("aria-hidden", "true");
    } catch (error) {
    }
    try {
      const overlays = documentRef.querySelectorAll(
        '.modal-backdrop, .popover-backdrop, .glide_box_overlay, .sn-modal-backdrop, [class*="backdrop"], [class*="overlay"]'
      );
      overlays.forEach((entry) => {
        entry.style.display = "none";
        entry.style.opacity = "0";
        entry.style.pointerEvents = "none";
      });
    } catch (error) {
    }
  }
  async function getRequestedForPreviewButton(previewButtonId, rootWindow = getRootWindow()) {
    return waitFor(
      () => findElementByIdAcrossDocuments(previewButtonId, rootWindow),
      7e3,
      200
    );
  }
  async function readUserFromPreview(previewButtonId, logger, rootWindow = getRootWindow()) {
    const previewButton = await getRequestedForPreviewButton(previewButtonId, rootWindow);
    if (!previewButton?.element) {
      throw new Error("Requested For preview button not found");
    }
    previewButton.element.click();
    const popupContext = await waitFor(() => findUserPopup(rootWindow), 5e3, 150);
    if (!popupContext?.popup) {
      throw new Error("Requested For preview popup not found");
    }
    const user = {
      firstName: getPopupValue(popupContext.popup, [
        "#sys_readonly\\.sys_user\\.first_name",
        "#sys_user\\.first_name",
        'input[id="sys_readonly.sys_user.first_name"]',
        'input[id="sys_user.first_name"]'
      ]),
      lastName: getPopupValue(popupContext.popup, [
        "#sys_readonly\\.sys_user\\.last_name",
        "#sys_user\\.last_name",
        'input[id="sys_readonly.sys_user.last_name"]',
        'input[id="sys_user.last_name"]'
      ]),
      email: getPopupValue(popupContext.popup, [
        "#sys_readonly\\.sys_user\\.email",
        "#sys_user\\.email",
        'input[id="sys_readonly.sys_user.email"]',
        'input[id="sys_user.email"]'
      ])
    };
    user.fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    hidePopup(popupContext.popup, popupContext.documentRef);
    logger?.info("user resolved from Requested For preview");
    return user;
  }
  function createHiddenFrame(hostDocument, frameId, url) {
    const previousFrame = hostDocument.getElementById(frameId);
    if (previousFrame) previousFrame.remove();
    const frame = hostDocument.createElement("iframe");
    frame.id = frameId;
    frame.src = url;
    Object.assign(frame.style, {
      position: "fixed",
      width: "1200px",
      height: "800px",
      right: "-4000px",
      top: "0",
      opacity: "0.01",
      pointerEvents: "none",
      border: "0",
      zIndex: "-1"
    });
    (hostDocument.body || hostDocument.documentElement).appendChild(frame);
    return frame;
  }
  async function getRequestedForUrl(previewButtonId, rootWindow = getRootWindow()) {
    const previewButton = await getRequestedForPreviewButton(previewButtonId, rootWindow);
    if (!previewButton?.element) {
      throw new Error("Requested For preview button not found");
    }
    previewButton.element.click();
    await delay(350);
    const openRecordLink = await waitFor(() => {
      for (const documentRef of getAccessibleDocuments(rootWindow)) {
        try {
          const link = documentRef.querySelector('a[data-type="reference_clickthrough"]');
          if (link) return link;
        } catch (error) {
          continue;
        }
      }
      return null;
    }, 5e3, 150);
    if (!openRecordLink) {
      throw new Error("Requested For record link not found");
    }
    const href = openRecordLink.getAttribute("href") || openRecordLink.href;
    if (!href) {
      throw new Error("Requested For URL not available");
    }
    return new URL(href, window.location.href).href;
  }
  async function extractPiFromUserRecord({ hostDocument, userUrl, assetPrefix }) {
    const frameId = "sn-assistant-hidden-pi-frame";
    const hiddenFrame = createHiddenFrame(hostDocument, frameId, userUrl);
    try {
      const frameDocument = await waitFor(() => {
        try {
          const currentDocument = hiddenFrame.contentDocument || hiddenFrame.contentWindow?.document;
          if (currentDocument?.readyState === "complete") return currentDocument;
        } catch (error) {
          return null;
        }
        return null;
      }, 1e4, 200);
      if (!frameDocument) {
        throw new Error("Requested For record did not load");
      }
      const configurationTab = await waitFor(() => {
        try {
          const nodes = Array.from(frameDocument.querySelectorAll("span.tab_caption_text, a, button"));
          return nodes.find(
            (entry) => normalizeText(entry.textContent).includes("configuration items")
          );
        } catch (error) {
          return null;
        }
      }, 8e3, 200);
      if (!configurationTab) {
        throw new Error("Configuration Items tab not found");
      }
      configurationTab.click();
      await delay(600);
      const piValue = await waitFor(() => {
        try {
          const links = Array.from(
            frameDocument.querySelectorAll(
              "tbody.list2_body a.linked.formlink, a.linked.formlink, a[data-popover-title], a"
            )
          );
          const match = links.find(
            (entry) => cleanText(entry.textContent).startsWith(assetPrefix)
          );
          return match ? cleanText(match.textContent) : null;
        } catch (error) {
          return null;
        }
      }, 1e4, 200);
      if (!piValue) {
        throw new Error(`No asset starting with ${assetPrefix} was found`);
      }
      return piValue;
    } finally {
      hiddenFrame.remove();
    }
  }
  function insertWithTargetDefinition(targetDefinition, value) {
    const bestGForm = getBestGForm();
    for (const fieldName of targetDefinition.fieldNames || []) {
      try {
        if (bestGForm?.gForm?.setValue) {
          bestGForm.gForm.setValue(fieldName, value);
          return { ok: true, targetField: fieldName };
        }
      } catch (error) {
        continue;
      }
    }
    for (const documentRef of getAccessibleDocuments()) {
      for (const selector of targetDefinition.selectors || []) {
        try {
          const element = documentRef.querySelector(selector);
          if (!element) continue;
          if (setElementValue(element, value)) {
            return { ok: true, targetField: selector };
          }
        } catch (error) {
          continue;
        }
      }
    }
    return { ok: false, targetField: "" };
  }
  async function copyToClipboard(text, hostDocument = document) {
    const value = cleanText(text);
    if (!value) return false;
    try {
      const hookResult = window.__SN_ASSISTANT_TEST_HOOKS__?.onCopyToClipboard?.(value);
      if (hookResult === true) {
        return true;
      }
    } catch (error) {
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (error) {
    }
    try {
      const textarea = hostDocument.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";
      (hostDocument.body || hostDocument.documentElement).appendChild(textarea);
      textarea.select();
      const copied = hostDocument.execCommand("copy");
      textarea.remove();
      return Boolean(copied);
    } catch (error) {
      return false;
    }
  }
  function insertRenderedTemplate(renderedTemplate, context) {
    const config = getTableConfig(context.table);
    if (!config) {
      return { ok: false, targetField: "" };
    }
    const targetKey = cleanText(renderedTemplate?.target) || (renderedTemplate?.category === "email" ? "comments" : "work_notes");
    const targetDefinition = config.targets?.[targetKey] || config.targets?.work_notes;
    if (!targetDefinition) {
      return { ok: false, targetField: "" };
    }
    return insertWithTargetDefinition(targetDefinition, cleanText(renderedTemplate?.body));
  }
  function openDraft(renderedTemplate) {
    if (!renderedTemplate || renderedTemplate.category !== "email") {
      return { ok: false, mailto: "" };
    }
    const recipient = cleanText(renderedTemplate.recipient);
    const subject = cleanText(renderedTemplate.subject);
    const body = cleanText(renderedTemplate.body);
    const mailto = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      const hookResult = window.__SN_ASSISTANT_TEST_HOOKS__?.onOpenDraft?.(mailto, renderedTemplate);
      if (hookResult === true) {
        return { ok: true, mailto };
      }
      window.location.href = mailto;
      return { ok: true, mailto };
    } catch (error) {
      return { ok: false, mailto };
    }
  }
  async function resolveUserForContext(context, state, settings, logger) {
    const cachedUser = state.caches.userByRecord[context.recordKey];
    if (cachedUser?.email) {
      return cachedUser;
    }
    if (context.user?.email || settings?.toggles?.autoFillUserEmail === false) {
      return context.user;
    }
    const tableConfig = getTableConfig(context.table);
    if (!tableConfig?.previewButtonId) {
      return context.user;
    }
    try {
      const resolvedUser = await readUserFromPreview(tableConfig.previewButtonId, logger);
      if (resolvedUser?.email) {
        state.caches.userByRecord[context.recordKey] = resolvedUser;
        return resolvedUser;
      }
    } catch (error) {
      logger?.warn("Requested For preview resolution failed", error);
    }
    return context.user;
  }
  async function runPiSearch({ context, hostDocument, logger }) {
    const tableConfig = getTableConfig(context.table);
    if (!tableConfig?.previewButtonId) {
      throw new Error("PI search is only available for sc_task");
    }
    const userUrl = await getRequestedForUrl(tableConfig.previewButtonId);
    logger?.info("Requested For URL resolved for PI search");
    const piValue = await extractPiFromUserRecord({
      hostDocument,
      userUrl,
      assetPrefix: tableConfig.piAssetPrefix || "MUSTBRUN"
    });
    const displayField = hostDocument.querySelector("#sys_display\\.sc_task\\.cmdb_ci") || hostDocument.querySelector('input[id="sys_display.sc_task.cmdb_ci"]') || hostDocument.querySelector('input[id*="cmdb_ci"]');
    if (!displayField || !setElementValue(displayField, piValue)) {
      throw new Error("Could not write the PI into sc_task.cmdb_ci");
    }
    return piValue;
  }

  // Assistant/templates/emailTemplates.js
  var EMAIL_TEMPLATES = [
    {
      id: "incident_follow_up",
      category: "email",
      label: "Incident Follow-up",
      target: "comments",
      subject: "Follow-up on {{ticket_number}}",
      body: 'Hello {{user_name}},\n\nI am following up on {{ticket_number}} regarding "{{short_description}}".\n\nCould you please confirm whether the issue is still happening and share any useful update so we can continue?\n\nKind regards,\n{{agent_name}}'
    },
    {
      id: "request_to_visit_office",
      category: "email",
      label: "Request To Visit Office",
      target: "comments",
      subject: "Visit requested for {{ticket_number}}",
      body: "Hello {{user_name}},\n\nTo continue with {{ticket_number}}, please visit the {{office_label}} {{office_room}}.\n\nReply if you need another slot or if remote support is preferable.\n\nKind regards,\n{{agent_name}}"
    },
    {
      id: "appointment_proposal",
      category: "email",
      label: "Appointment Proposal",
      target: "comments",
      subject: "Appointment proposal for {{ticket_number}}",
      body: "Hello {{user_name}},\n\nI can propose an appointment for {{ticket_number}} at the {{office_label}} {{office_room}}.\n\nPlease reply with your preferred slot and we will confirm the meeting.\n\nKind regards,\n{{agent_name}}"
    },
    {
      id: "user_unavailable",
      category: "email",
      label: "User Unavailable",
      target: "comments",
      subject: "Unable to reach you for {{ticket_number}}",
      body: "Hello {{user_name}},\n\nWe tried to contact you regarding {{ticket_number}}, but we could not reach you.\n\nPlease reply with your availability so we can continue without delay.\n\nKind regards,\n{{agent_name}}"
    },
    {
      id: "device_ready_for_collection",
      category: "email",
      label: "Device Ready For Collection",
      target: "comments",
      subject: "Device ready for collection - {{ticket_number}}",
      body: "Hello {{user_name}},\n\nYour device linked to {{ticket_number}} is ready for collection.\n\nPlease visit the {{office_label}} {{office_room}} and bring your badge if needed.\n\nKind regards,\n{{agent_name}}"
    },
    {
      id: "smartphone_handover",
      category: "email",
      label: "Smartphone Handover",
      target: "comments",
      subject: "Smartphone handover for {{ticket_number}}",
      body: "Hello {{user_name}},\n\nYour smartphone request is ready to move to handover.\n\nPlease confirm your availability to collect it at the {{office_label}} {{office_room}}.\n\nKind regards,\n{{agent_name}}"
    },
    {
      id: "battery_issue",
      category: "email",
      label: "Battery Issue",
      target: "comments",
      subject: "Battery troubleshooting - {{ticket_number}}",
      body: "Hello {{user_name}},\n\nI am reviewing the battery issue reported in {{ticket_number}}.\n\nPlease let me know whether the device is available for testing and if the issue is constant or intermittent.\n\nKind regards,\n{{agent_name}}"
    },
    {
      id: "sound_issue",
      category: "email",
      label: "Sound Issue",
      target: "comments",
      subject: "Sound issue follow-up - {{ticket_number}}",
      body: "Hello {{user_name}},\n\nI am following up on the sound issue recorded in {{ticket_number}}.\n\nPlease confirm whether the issue affects speakers, headset or both, and whether it happens in every application.\n\nKind regards,\n{{agent_name}}"
    },
    {
      id: "laptop_swap",
      category: "email",
      label: "Laptop Swap",
      target: "comments",
      subject: "Laptop swap coordination - {{ticket_number}}",
      body: "Hello {{user_name}},\n\nWe are ready to coordinate the laptop swap related to {{ticket_number}}.\n\nPlease confirm your availability to visit the {{office_label}} {{office_room}} so we can complete the exchange.\n\nKind regards,\n{{agent_name}}"
    },
    {
      id: "backup_needed",
      category: "email",
      label: "Backup Needed",
      target: "comments",
      subject: "Backup required before intervention - {{ticket_number}}",
      body: "Hello {{user_name}},\n\nBefore we continue with {{ticket_number}}, please confirm whether a backup of your data is required.\n\nIf needed, let us know so we can factor it into the intervention plan.\n\nKind regards,\n{{agent_name}}"
    },
    {
      id: "closure_confirmation",
      category: "email",
      label: "Closure Confirmation",
      target: "comments",
      subject: "Closure confirmation for {{ticket_number}}",
      body: "Hello {{user_name}},\n\nI am checking whether {{ticket_number}} can now be closed.\n\nIf everything is working as expected, please confirm and I will close the record. If not, reply with the current status.\n\nKind regards,\n{{agent_name}}"
    }
  ];

  // Assistant/templates/internalTemplates.js
  var INTERNAL_TEMPLATES = [
    {
      id: "ask_team_recommendation",
      category: "internal",
      label: "Ask Team For Recommendation",
      target: "work_notes",
      body: "Team, please review {{ticket_number}} and advise on the best next step. Current summary: {{short_description}}."
    },
    {
      id: "logistics_follow_up",
      category: "internal",
      label: "Logistics Follow-up",
      target: "work_notes",
      body: "Following up on logistics for {{ticket_number}}. Office context: {{office_name}} {{office_room}}."
    },
    {
      id: "ask_colleague_bring_device",
      category: "internal",
      label: "Ask Colleague To Bring Device",
      target: "work_notes",
      body: "Could someone bring the required device for {{ticket_number}} to {{office_label}} {{office_room}}?"
    },
    {
      id: "handover_coordination",
      category: "internal",
      label: "Handover Coordination",
      target: "work_notes",
      body: "Coordinating handover for {{ticket_number}} with {{user_name}}. Please align stock and room availability at {{office_label}} {{office_room}}."
    }
  ];

  // Assistant/templates/workNoteTemplates.js
  var WORK_NOTE_TEMPLATES = [
    {
      id: "user_contacted",
      category: "work_note",
      label: "User Contacted",
      target: "work_notes",
      body: "{{today}} - Contacted {{user_name}} ({{user_email}}) regarding {{ticket_number}}. Awaiting reply."
    },
    {
      id: "email_sent",
      category: "work_note",
      label: "Email Sent",
      target: "work_notes",
      body: "{{today}} - Email sent to {{user_name}} for {{ticket_number}}. Subject context: {{short_description}}."
    },
    {
      id: "appointment_proposed",
      category: "work_note",
      label: "Appointment Proposed",
      target: "work_notes",
      body: "{{today}} - Proposed an appointment to {{user_name}} at {{office_label}} {{office_room}} for {{ticket_number}}."
    },
    {
      id: "user_visited_office",
      category: "work_note",
      label: "User Visited Office",
      target: "work_notes",
      body: "{{today}} - {{user_name}} visited {{office_label}} {{office_room}} regarding {{ticket_number}}."
    },
    {
      id: "device_delivered",
      category: "work_note",
      label: "Device Delivered",
      target: "work_notes",
      body: "{{today}} - Device delivered to {{user_name}} for {{ticket_number}}."
    },
    {
      id: "device_collected",
      category: "work_note",
      label: "Device Collected",
      target: "work_notes",
      body: "{{today}} - Device collected from {{user_name}} for {{ticket_number}}."
    },
    {
      id: "backup_required",
      category: "work_note",
      label: "Backup Required",
      target: "work_notes",
      body: "{{today}} - Backup confirmed as required before continuing work on {{ticket_number}}."
    },
    {
      id: "waiting_for_feedback",
      category: "work_note",
      label: "Waiting For Feedback",
      target: "work_notes",
      body: "{{today}} - Waiting for user feedback on {{ticket_number}} after latest communication."
    },
    {
      id: "ticket_updated",
      category: "work_note",
      label: "Ticket Updated",
      target: "work_notes",
      body: "{{today}} - {{ticket_number}} updated internally. Current summary: {{short_description}}."
    }
  ];

  // Assistant/templates/registry.js
  var CATEGORY_META = [
    { id: "email", label: "Emails" },
    { id: "work_note", label: "Work Notes" },
    { id: "internal", label: "Internal" }
  ];
  var DEFAULT_GROUPS = {
    email: EMAIL_TEMPLATES,
    work_note: WORK_NOTE_TEMPLATES,
    internal: INTERNAL_TEMPLATES
  };
  function applyTemplateOverride(template, override) {
    if (!override) return deepClone(template);
    return {
      ...deepClone(template),
      label: override.label || template.label,
      subject: override.subject || template.subject,
      body: override.body || template.body,
      target: override.target || template.target
    };
  }
  function getCategories() {
    return CATEGORY_META.map((entry) => ({ ...entry }));
  }
  function getTemplateGroups(settings) {
    const overrides = settings?.templateOverrides || {};
    return Object.fromEntries(
      Object.entries(DEFAULT_GROUPS).map(([category, templates]) => [
        category,
        templates.map((template) => applyTemplateOverride(template, overrides[category]?.[template.id]))
      ])
    );
  }
  function getTemplatesForCategory(category, settings) {
    return getTemplateGroups(settings)[category] || [];
  }
  function getFirstTemplateId(category, settings) {
    return getTemplatesForCategory(category, settings)[0]?.id || "";
  }

  // Assistant/templates/renderer.js
  function finalizeTemplateText(value) {
    return String(value || "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
  }
  function buildPlaceholderMap({ context, settings }) {
    const userName = cleanText(context?.user?.fullName) || [cleanText(context?.user?.firstName), cleanText(context?.user?.lastName)].filter(Boolean).join(" ") || "colleague";
    return {
      user_name: userName,
      user_email: cleanText(context?.user?.email),
      ticket_number: cleanText(context?.ticketNumber) || cleanText(context?.recordNumber),
      record_number: cleanText(context?.recordNumber) || cleanText(context?.ticketNumber),
      table_name: cleanText(context?.tableLabel) || cleanText(context?.table),
      office_name: cleanText(settings?.officeName),
      office_room: cleanText(settings?.officeRoom),
      office_label: cleanText(settings?.officeLabel),
      agent_name: cleanText(context?.agentName) || "IT Support",
      today: formatToday(settings?.defaultLanguage),
      short_description: cleanText(context?.shortDescription),
      configuration_item: cleanText(context?.configurationItem)
    };
  }
  function replacePlaceholders(value, placeholders) {
    return String(value || "").replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key) => {
      const lookupKey = String(key || "").toLowerCase();
      return placeholders[lookupKey] ?? "";
    });
  }
  function renderTemplate(template, { context, settings }) {
    if (!template) return null;
    const placeholders = buildPlaceholderMap({ context, settings });
    const subject = finalizeTemplateText(replacePlaceholders(template.subject, placeholders));
    const body = finalizeTemplateText(replacePlaceholders(template.body, placeholders));
    const clipboardText = template.category === "email" ? finalizeTemplateText(`Subject: ${subject}

${body}`) : body;
    return {
      ...template,
      subject,
      body,
      clipboardText,
      recipient: settings?.toggles?.autoFillUserEmail !== false ? cleanText(context?.user?.email) : "",
      target: cleanText(template.target)
    };
  }

  // Assistant/ui/drag.js
  var INTERACTIVE_SELECTOR = 'button, input, select, textarea, label, a, [role="button"], [data-no-drag="true"]';
  function applyPosition(node, position) {
    if (!position) return;
    node.style.left = `${position.left}px`;
    node.style.top = `${position.top}px`;
  }
  function resolveDefaultPosition(node, defaultPosition) {
    return typeof defaultPosition === "function" ? defaultPosition(node) : defaultPosition;
  }
  function makeDraggable({ node, handleSelector, state, positionKey, defaultPosition }) {
    if (!node) return;
    const ownerWindow = node.ownerDocument.defaultView || window;
    const storedPosition = state.ui[positionKey];
    const fallbackPosition = resolveDefaultPosition(node, defaultPosition);
    applyPosition(node, storedPosition || fallbackPosition);
    if (node.dataset.snAssistantDragBound === "true") return;
    node.dataset.snAssistantDragBound = "true";
    let dragState = null;
    let suppressClickUntil = 0;
    const onPointerMove = (event) => {
      if (!dragState) return;
      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      const distance = Math.abs(deltaX) + Math.abs(deltaY);
      if (distance < 4 && !dragState.moved) return;
      dragState.moved = true;
      event.preventDefault();
      const nextLeft = clamp(
        event.clientX - dragState.offsetX,
        8,
        Math.max(ownerWindow.innerWidth - dragState.width - 8, 8)
      );
      const nextTop = clamp(
        event.clientY - dragState.offsetY,
        8,
        Math.max(ownerWindow.innerHeight - dragState.height - 8, 8)
      );
      state.ui[positionKey] = { left: nextLeft, top: nextTop };
      applyPosition(node, state.ui[positionKey]);
    };
    const onPointerUp = () => {
      if (dragState?.moved) {
        suppressClickUntil = Date.now() + 120;
      }
      dragState = null;
      ownerWindow.removeEventListener("pointermove", onPointerMove);
      ownerWindow.removeEventListener("pointerup", onPointerUp);
    };
    node.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (!event.target.closest(handleSelector)) return;
      if (event.target.closest(INTERACTIVE_SELECTOR)) return;
      const rect = node.getBoundingClientRect();
      dragState = {
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
        moved: false
      };
      ownerWindow.addEventListener("pointermove", onPointerMove, { passive: false });
      ownerWindow.addEventListener("pointerup", onPointerUp);
    });
    node.addEventListener(
      "click",
      (event) => {
        if (Date.now() < suppressClickUntil) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      true
    );
  }

  // Assistant/ui/launcher.js
  function getDefaultLauncherPosition(node) {
    const ownerWindow = node.ownerDocument.defaultView || window;
    return {
      left: Math.max(ownerWindow.innerWidth - 190, 14),
      top: 88
    };
  }
  function bindLauncher(root, handlers) {
    if (root.dataset.snAssistantBound === "true") return;
    root.dataset.snAssistantBound = "true";
    root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const { action } = button.dataset;
      if (action === "quick-draft") handlers.onQuickDraft();
      if (action === "open-settings") handlers.onOpenSettings();
      if (action === "force-close") handlers.onForceClose();
    });
  }
  function ensureLauncher({ hostDocument, state, context, handlers }) {
    let root = hostDocument.getElementById(UI_IDS.launcher);
    if (!root) {
      root = hostDocument.createElement("div");
      root.id = UI_IDS.launcher;
      root.className = "sn-assistant-floating";
      root.setAttribute(ROOT_ATTRIBUTE, ROOT_VALUE);
      (hostDocument.body || hostDocument.documentElement).appendChild(root);
    }
    const markup = `
    <div class="sn-assistant-launcher__shell" data-drag-handle="launcher" title="${escapeHtml(
      `${context.ticketNumber || context.tableLabel} | ${context.recordKey}`
    )}">
      <button type="button" class="sn-assistant-launcher__primary" data-action="quick-draft">
        <span class="sn-assistant-launcher__dot" aria-hidden="true"></span>
        <span>Draft</span>
      </button>
      <button type="button" class="sn-assistant-launcher__icon" data-action="open-settings" title="Settings">
        <span class="sn-assistant-icon sn-assistant-icon--gear" aria-hidden="true"></span>
      </button>
      <button type="button" class="sn-assistant-launcher__icon sn-assistant-launcher__icon--danger" data-action="force-close" title="Close Assistant">
        <span>X</span>
      </button>
    </div>
  `;
    if (root.__snAssistantMarkup !== markup) {
      root.innerHTML = markup;
      root.__snAssistantMarkup = markup;
    }
    bindLauncher(root, handlers);
    makeDraggable({
      node: root,
      handleSelector: '[data-drag-handle="launcher"]',
      state,
      positionKey: "launcherPosition",
      defaultPosition: getDefaultLauncherPosition
    });
    return root;
  }
  function removeLauncher(hostDocument) {
    const root = hostDocument?.getElementById(UI_IDS.launcher);
    if (root) root.remove();
  }

  // Assistant/ui/preview.js
  function renderMeta(label, value) {
    return `
    <div class="sn-assistant-preview__meta-block">
      <span class="sn-assistant-preview__meta-label">${escapeHtml(label)}</span>
      <div class="sn-assistant-preview__meta-value">${escapeHtml(value || "Not available")}</div>
    </div>
  `;
  }
  function renderPreview(renderedTemplate) {
    if (!renderedTemplate) {
      return `<div class="sn-assistant-preview__empty">Select a template to generate a preview.</div>`;
    }
    const metaBlocks = renderedTemplate.category === "email" ? `
          <div class="sn-assistant-preview__meta">
            ${renderMeta("Recipient", renderedTemplate.recipient || "Not detected")}
            ${renderMeta("Subject", renderedTemplate.subject)}
          </div>
        ` : `
          <div class="sn-assistant-preview__meta">
            ${renderMeta("Target", renderedTemplate.target || "work_notes")}
            ${renderMeta("Template", renderedTemplate.label)}
          </div>
        `;
    return `
    ${metaBlocks}
    <div class="sn-assistant-preview__body">${escapeHtml(renderedTemplate.body)}</div>
  `;
  }

  // Assistant/ui/templates.js
  function renderTemplateSelector({
    categories,
    activeCategory,
    templates,
    selectedTemplateId
  }) {
    const tabs = categories.map(
      (category) => `
        <button
          type="button"
          class="sn-assistant-tab ${category.id === activeCategory ? "is-active" : ""}"
          data-action="select-category"
          data-category="${escapeHtml(category.id)}"
        >
          ${escapeHtml(category.label)}
        </button>
      `
    ).join("");
    const options = templates.map(
      (template) => `
        <option value="${escapeHtml(template.id)}" ${template.id === selectedTemplateId ? "selected" : ""}>
          ${escapeHtml(template.label)}
        </option>
      `
    ).join("");
    return `
    <div class="sn-assistant-tabs">${tabs}</div>
    <div class="sn-assistant-field">
      <span class="sn-assistant-field__label">Template</span>
      <select class="sn-assistant-select" data-action="select-template">
        ${options}
      </select>
    </div>
  `;
  }

  // Assistant/ui/panel.js
  function getDefaultPanelPosition(node) {
    const ownerWindow = node.ownerDocument.defaultView || window;
    return {
      left: Math.max(ownerWindow.innerWidth - 404, 12),
      top: 136
    };
  }
  function bindPanel(root, handlers) {
    if (root.dataset.snAssistantBound === "true") return;
    root.dataset.snAssistantBound = "true";
    root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const { action, category } = button.dataset;
      if (action === "close-panel") handlers.onClosePanel();
      if (action === "force-close") handlers.onForceClose();
      if (action === "toggle-collapse") handlers.onToggleCollapse();
      if (action === "open-settings") handlers.onOpenSettings();
      if (action === "select-category") handlers.onSelectCategory(category);
      if (action === "copy-template") handlers.onCopy();
      if (action === "insert-template") handlers.onInsert();
      if (action === "open-draft") handlers.onDraft();
      if (action === "run-pi-search") handlers.onPiSearch();
    });
    root.addEventListener("change", (event) => {
      const select = event.target.closest('select[data-action="select-template"]');
      if (!select) return;
      handlers.onSelectTemplate(select.value);
    });
  }
  function ensurePanel({
    hostDocument,
    state,
    context,
    categories,
    templates,
    selectedTemplateId,
    renderedTemplate,
    handlers
  }) {
    let root = hostDocument.getElementById(UI_IDS.panel);
    if (!root) {
      root = hostDocument.createElement("div");
      root.id = UI_IDS.panel;
      root.className = "sn-assistant-floating";
      root.setAttribute(ROOT_ATTRIBUTE, ROOT_VALUE);
      (hostDocument.body || hostDocument.documentElement).appendChild(root);
    }
    const collapsed = state.ui.panelCollapsed;
    const pending = Object.values(state.pendingActions).some(Boolean);
    const showPiSearch = context.table === "sc_task";
    const selectorMarkup = renderTemplateSelector({
      categories,
      activeCategory: state.ui.activeCategory,
      templates,
      selectedTemplateId
    });
    const markup = `
    <div class="sn-assistant-panel">
      <div class="sn-assistant-panel__header" data-drag-handle="panel">
        <div class="sn-assistant-panel__title">
          <span class="sn-assistant-panel__eyebrow">SN Assistant</span>
          <div class="sn-assistant-panel__heading">${escapeHtml(context.ticketNumber || context.tableLabel || "Record")}</div>
          <div class="sn-assistant-panel__subheading">${escapeHtml(context.tableLabel)} | ${escapeHtml(
      context.recordKey
    )}</div>
        </div>
        <div class="sn-assistant-panel__header-actions">
          <button type="button" class="sn-assistant-mini-button" data-action="toggle-collapse" title="Collapse">
            ${collapsed ? "+" : "-"}
          </button>
          <button type="button" class="sn-assistant-mini-button" data-action="open-settings" title="Settings">
            <span class="sn-assistant-icon sn-assistant-icon--gear" aria-hidden="true"></span>
          </button>
          <button type="button" class="sn-assistant-mini-button sn-assistant-mini-button--danger" data-action="force-close" title="Close Assistant">
            X
          </button>
          <button type="button" class="sn-assistant-mini-button" data-action="close-panel" title="Close">
            X
          </button>
        </div>
      </div>
      ${collapsed ? "" : `
            <div class="sn-assistant-panel__body">
              <div class="sn-assistant-chip-row">
                <span class="sn-assistant-chip"><strong>Office</strong> ${escapeHtml(state.settings.officeName)}</span>
                <span class="sn-assistant-chip"><strong>User</strong> ${escapeHtml(
      context.user.fullName || context.user.email || "Not detected"
    )}</span>
              </div>
              ${selectorMarkup}
              ${showPiSearch ? '<div class="sn-assistant-row"><button type="button" class="sn-assistant-button sn-assistant-button--secondary" data-action="run-pi-search">Find PI</button></div>' : ""}
              <div class="sn-assistant-preview">${renderPreview(renderedTemplate)}</div>
              <div class="sn-assistant-panel__footer">
                <button type="button" class="sn-assistant-button sn-assistant-button--secondary" data-action="copy-template" ${pending ? "disabled" : ""}>Copy</button>
                <button type="button" class="sn-assistant-button sn-assistant-button--secondary" data-action="insert-template" ${pending || !renderedTemplate ? "disabled" : ""}>Insert</button>
                <button type="button" class="sn-assistant-button sn-assistant-button--primary" data-action="open-draft" ${pending || renderedTemplate?.category !== "email" ? "disabled" : ""}>Draft</button>
              </div>
            </div>
          `}
    </div>
  `;
    if (root.__snAssistantMarkup !== markup) {
      root.innerHTML = markup;
      root.__snAssistantMarkup = markup;
    }
    bindPanel(root, handlers);
    makeDraggable({
      node: root,
      handleSelector: '[data-drag-handle="panel"]',
      state,
      positionKey: "panelPosition",
      defaultPosition: getDefaultPanelPosition
    });
    return root;
  }
  function removePanel(hostDocument) {
    const root = hostDocument?.getElementById(UI_IDS.panel);
    if (root) root.remove();
  }

  // Assistant/ui/settings.js
  function renderOfficeOptions(currentValue) {
    return Object.values(OFFICE_PRESETS).map(
      (preset) => `
        <option value="${escapeHtml(preset.id)}" ${preset.id === currentValue ? "selected" : ""}>
          ${escapeHtml(preset.label)}
        </option>
      `
    ).join("");
  }
  function renderLanguageOptions(currentValue) {
    return LANGUAGE_OPTIONS.map(
      (option) => `
      <option value="${escapeHtml(option.value)}" ${option.value === currentValue ? "selected" : ""}>
        ${escapeHtml(option.label)}
      </option>
    `
    ).join("");
  }
  function renderTemplateCards(category, templates, selectedTemplateId) {
    return templates.map(
      (template) => `
        <div class="sn-assistant-template-card ${template.id === selectedTemplateId ? "is-selected" : ""}">
          <div class="sn-assistant-template-card__header">
            <div>
              <div class="sn-assistant-template-card__title">${escapeHtml(template.id)}</div>
              <div class="sn-assistant-template-card__meta">${escapeHtml(category)}</div>
            </div>
            <div class="sn-assistant-row">
              <button
                type="button"
                class="sn-assistant-button ${template.id === selectedTemplateId ? "sn-assistant-button--primary" : "sn-assistant-button--secondary"} sn-assistant-button--compact"
                data-action="select-settings-template"
                data-category="${escapeHtml(category)}"
                data-template-id="${escapeHtml(template.id)}"
              >
                ${template.id === selectedTemplateId ? "Selected" : "Use"}
              </button>
              <button
                type="button"
                class="sn-assistant-mini-button"
                data-action="restore-template"
                data-category="${escapeHtml(category)}"
                data-template-id="${escapeHtml(template.id)}"
                title="Restore default"
              >
                R
              </button>
            </div>
          </div>
          <div class="sn-assistant-settings-grid sn-assistant-settings-grid--compact">
            <div class="sn-assistant-field">
              <span class="sn-assistant-field__label">Template name</span>
              <input
                class="sn-assistant-input"
                name="tpl:${escapeHtml(category)}:${escapeHtml(template.id)}:label"
                value="${escapeHtml(template.label || "")}"
              />
            </div>
            <div class="sn-assistant-field">
              <span class="sn-assistant-field__label">Target field</span>
              <input
                class="sn-assistant-input"
                name="tpl:${escapeHtml(category)}:${escapeHtml(template.id)}:target"
                value="${escapeHtml(template.target || "")}"
                placeholder="comments or work_notes"
              />
            </div>
          </div>
          ${category === "email" ? `
                <div class="sn-assistant-field">
                  <span class="sn-assistant-field__label">Subject</span>
                  <textarea
                    class="sn-assistant-textarea"
                    name="tpl:${escapeHtml(category)}:${escapeHtml(template.id)}:subject"
                  >${escapeHtml(template.subject || "")}</textarea>
                </div>
              ` : ""}
          <div class="sn-assistant-field">
            <span class="sn-assistant-field__label">Body</span>
            <textarea
              class="sn-assistant-textarea"
              name="tpl:${escapeHtml(category)}:${escapeHtml(template.id)}:body"
            >${escapeHtml(template.body || "")}</textarea>
          </div>
          <div class="sn-assistant-template-card__hint">Empty values fall back to the built-in default. Placeholders: {{user_name}}, {{user_email}}, {{ticket_number}}, {{record_number}}, {{table_name}}, {{office_name}}, {{office_room}}, {{office_label}}, {{agent_name}}, {{today}}, {{short_description}}, {{configuration_item}}</div>
        </div>
      `
    ).join("");
  }
  function bindSettings(root, handlers) {
    if (root.dataset.snAssistantBound === "true") return;
    root.dataset.snAssistantBound = "true";
    root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const { action, category, templateId } = button.dataset;
      if (action === "close-settings") handlers.onCloseSettings();
      if (action === "save-settings") handlers.onSaveSettings();
      if (action === "reset-settings") handlers.onResetSettings();
      if (action === "export-settings") handlers.onExportSettings();
      if (action === "trigger-import-settings") handlers.onTriggerImport();
      if (action === "template-category") handlers.onTemplateManagerCategory(category);
      if (action === "select-settings-template") handlers.onSelectSettingsTemplate(category, templateId);
      if (action === "restore-template") handlers.onRestoreTemplate(category, templateId);
    });
    const onFieldMutation = (event) => {
      const importInput = event.target.closest('input[data-role="settings-import-input"]');
      if (importInput) {
        const file = importInput.files?.[0] || null;
        handlers.onImportSettingsFile(file);
        importInput.value = "";
        return;
      }
      const field = event.target.closest("[name]");
      if (!field) return;
      const value = field.type === "checkbox" ? field.checked : field.value;
      handlers.onFieldChange(field.name, value);
    };
    root.addEventListener("input", onFieldMutation);
    root.addEventListener("change", onFieldMutation);
  }
  function ensureSettingsModal({
    hostDocument,
    state,
    draftSettings,
    templateGroups,
    handlers
  }) {
    let root = hostDocument.getElementById(UI_IDS.settings);
    if (!root) {
      root = hostDocument.createElement("div");
      root.id = UI_IDS.settings;
      root.setAttribute(ROOT_ATTRIBUTE, ROOT_VALUE);
      (hostDocument.body || hostDocument.documentElement).appendChild(root);
    }
    const activeCategory = state.ui.templateManagerCategory;
    const selectedTemplateId = state.ui.selectedTemplates[activeCategory] || "";
    const categoryTabs = [
      { id: "email", label: "Emails" },
      { id: "work_note", label: "Work Notes" },
      { id: "internal", label: "Internal" }
    ].map(
      (category) => `
        <button
          type="button"
          class="sn-assistant-tab ${category.id === activeCategory ? "is-active" : ""}"
          data-action="template-category"
          data-category="${escapeHtml(category.id)}"
        >
          ${escapeHtml(category.label)}
        </button>
      `
    ).join("");
    const markup = `
    <div class="sn-assistant-modal">
      <div class="sn-assistant-modal__backdrop"></div>
      <div class="sn-assistant-modal__dialog">
          <div class="sn-assistant-modal__header">
          <div class="sn-assistant-modal__title">
            <span class="sn-assistant-panel__eyebrow">Template Workspace</span>
            <div class="sn-assistant-panel__heading">Configure templates and profile defaults</div>
            <div class="sn-assistant-panel__subheading">Saved inside the temporary workspace ${escapeHtml(
      TEMP_WORKSPACE
    )} in browser storage. Export can also write a JSON pack to a local temp/sn-assistant folder when the browser allows it.</div>
          </div>
          ${state.ui.settingsMandatory ? "" : '<button type="button" class="sn-assistant-mini-button" data-action="close-settings" title="Close">X</button>'}
        </div>
        <div class="sn-assistant-modal__body">
          <input id="${escapeHtml(UI_IDS.settingsImportInput)}" type="file" accept="application/json" data-role="settings-import-input" hidden />
          ${state.ui.settingsMandatory ? '<div class="sn-assistant-note">The assistant can run with defaults, but this panel lets you refine the profile and template package before saving.</div>' : ""}
          <div class="sn-assistant-note">Draft stays visible outside this modal. Settings are only editable from the gear icon. Manual edits on office fields automatically switch the profile to Custom.</div>
          <div class="sn-assistant-settings-grid">
            <div class="sn-assistant-field">
              <span class="sn-assistant-field__label">Office profile</span>
              <select class="sn-assistant-select" name="officeProfile">
                ${renderOfficeOptions(draftSettings.officeProfile)}
              </select>
            </div>
            <div class="sn-assistant-field">
              <span class="sn-assistant-field__label">Default language</span>
              <select class="sn-assistant-select" name="defaultLanguage">
                ${renderLanguageOptions(draftSettings.defaultLanguage)}
              </select>
            </div>
            <div class="sn-assistant-field">
              <span class="sn-assistant-field__label">Office name</span>
              <input class="sn-assistant-input" name="officeName" value="${escapeHtml(draftSettings.officeName)}" />
            </div>
            <div class="sn-assistant-field">
              <span class="sn-assistant-field__label">Office room</span>
              <input class="sn-assistant-input" name="officeRoom" value="${escapeHtml(draftSettings.officeRoom)}" />
            </div>
            <div class="sn-assistant-field" style="grid-column: 1 / -1;">
              <span class="sn-assistant-field__label">Display office text</span>
              <input class="sn-assistant-input" name="officeLabel" value="${escapeHtml(draftSettings.officeLabel)}" />
            </div>
          </div>
          <div class="sn-assistant-checkbox-list">
            <label class="sn-assistant-checkbox">
              <input type="checkbox" name="toggle:autoCopyToClipboard" ${draftSettings.toggles.autoCopyToClipboard ? "checked" : ""} />
              <div>
                <strong>Auto copy to clipboard</strong>
                <span>Also copy rendered text when using Insert or Draft.</span>
              </div>
            </label>
            <label class="sn-assistant-checkbox">
              <input type="checkbox" name="toggle:autoOpenDraft" ${draftSettings.toggles.autoOpenDraft ? "checked" : ""} />
              <div>
                <strong>Auto open draft after Copy</strong>
                <span>If the active template is an email, Copy will also launch a draft.</span>
              </div>
            </label>
            <label class="sn-assistant-checkbox">
              <input type="checkbox" name="toggle:autoFillUserEmail" ${draftSettings.toggles.autoFillUserEmail ? "checked" : ""} />
              <div>
                <strong>Auto-fill user email when detected</strong>
                <span>Uses form values or Requested For preview when needed.</span>
              </div>
            </label>
          </div>
          <div class="sn-assistant-template-manager">
            <div class="sn-assistant-row">
              <div class="sn-assistant-panel__heading" style="font-size:14px;">Template manager</div>
            </div>
            <div class="sn-assistant-note">The email template marked as Selected is the one used by the floating Draft button.</div>
            <div class="sn-assistant-tabs">${categoryTabs}</div>
            <div class="sn-assistant-template-list">${renderTemplateCards(
      activeCategory,
      templateGroups[activeCategory] || [],
      selectedTemplateId
    )}</div>
          </div>
        </div>
        <div class="sn-assistant-modal__footer">
          <div class="sn-assistant-row sn-assistant-row--wrap">
            <button type="button" class="sn-assistant-button sn-assistant-button--danger" data-action="reset-settings">Reset Settings</button>
            <button type="button" class="sn-assistant-button sn-assistant-button--secondary" data-action="export-settings">Export Templates</button>
            <button type="button" class="sn-assistant-button sn-assistant-button--secondary" data-action="trigger-import-settings">Import Templates</button>
          </div>
          <div class="sn-assistant-row sn-assistant-row--wrap">
            ${state.ui.settingsMandatory ? "" : '<button type="button" class="sn-assistant-button sn-assistant-button--secondary" data-action="close-settings">Close</button>'}
            <button type="button" class="sn-assistant-button sn-assistant-button--primary" data-action="save-settings">Save Settings</button>
          </div>
        </div>
      </div>
    </div>
  `;
    if (root.__snAssistantMarkup !== markup) {
      root.innerHTML = markup;
      root.__snAssistantMarkup = markup;
    }
    bindSettings(root, handlers);
    return root;
  }
  function removeSettingsModal(hostDocument) {
    const root = hostDocument?.getElementById(UI_IDS.settings);
    if (root) root.remove();
  }

  // Assistant/ui/styles.css
  var styles_default = `:root {
  --sn-assistant-surface: rgba(249, 246, 239, 0.98);
  --sn-assistant-panel: rgba(255, 252, 247, 0.96);
  --sn-assistant-ink: #19232c;
  --sn-assistant-muted: #5f6d78;
  --sn-assistant-accent: #0d5a6d;
  --sn-assistant-accent-strong: #084557;
  --sn-assistant-border: rgba(25, 35, 44, 0.12);
  --sn-assistant-shadow: 0 18px 40px rgba(20, 27, 35, 0.18);
  --sn-assistant-danger: #b5473f;
  --sn-assistant-radius: 18px;
  --sn-assistant-font: "IBM Plex Sans", "Segoe UI", sans-serif;
}

#sn-assistant-launcher,
#sn-assistant-panel,
#sn-assistant-settings,
#sn-assistant-toasts {
  font-family: var(--sn-assistant-font);
  color: var(--sn-assistant-ink);
}

.sn-assistant-floating {
  position: fixed;
  z-index: 2147483000;
  user-select: none;
}

.sn-assistant-launcher__shell {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px;
  border-radius: 999px;
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.96), transparent 55%),
    linear-gradient(145deg, rgba(253, 251, 247, 0.98), rgba(240, 235, 226, 0.96));
  border: 1px solid rgba(16, 34, 41, 0.12);
  box-shadow: 0 14px 32px rgba(17, 24, 39, 0.18);
  backdrop-filter: blur(12px);
}

.sn-assistant-launcher__primary,
.sn-assistant-launcher__icon,
.sn-assistant-button,
.sn-assistant-tab,
.sn-assistant-mini-button {
  border: 0;
  cursor: pointer;
  transition:
    transform 120ms ease,
    box-shadow 120ms ease,
    background 180ms ease,
    color 180ms ease,
    opacity 180ms ease;
  font-family: inherit;
}

.sn-assistant-launcher__primary {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 108px;
  height: 38px;
  padding: 0 16px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--sn-assistant-accent), #1f7b8e);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  box-shadow: 0 10px 20px rgba(10, 68, 85, 0.2);
}

.sn-assistant-launcher__primary:hover,
.sn-assistant-launcher__icon:hover,
.sn-assistant-button:hover,
.sn-assistant-tab:hover,
.sn-assistant-mini-button:hover {
  transform: translateY(-1px);
}

.sn-assistant-launcher__dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #c8fff3;
  box-shadow: 0 0 0 4px rgba(200, 255, 243, 0.18);
}

.sn-assistant-launcher__icon {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.84);
  color: var(--sn-assistant-accent-strong);
  font-size: 16px;
  box-shadow: inset 0 0 0 1px rgba(13, 90, 109, 0.12);
}

.sn-assistant-launcher__icon--danger {
  color: var(--sn-assistant-danger);
  box-shadow: inset 0 0 0 1px rgba(181, 71, 63, 0.18);
}

.sn-assistant-icon {
  display: inline-block;
  width: 16px;
  height: 16px;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
}

.sn-assistant-icon--gear {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23084557' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='3.2'/%3E%3Cpath d='M19.4 15a1.7 1.7 0 0 0 .34 1.83l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.83-.34 1.7 1.7 0 0 0-1.03 1.52V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.03-1.52 1.7 1.7 0 0 0-1.83.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.83 1.7 1.7 0 0 0-1.52-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.61 9a1.7 1.7 0 0 0-.34-1.83l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 8.93 4h.08a1.7 1.7 0 0 0 1.03-1.52V2a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.07 3.6a1.7 1.7 0 0 0 1.83-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.39 9v.08A1.7 1.7 0 0 0 20.91 10H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15z'/%3E%3C/svg%3E");
}

.sn-assistant-panel {
  width: 380px;
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 32px);
  border-radius: var(--sn-assistant-radius);
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.94), transparent 38%),
    linear-gradient(180deg, rgba(255, 252, 248, 0.98), rgba(244, 239, 231, 0.96));
  border: 1px solid var(--sn-assistant-border);
  box-shadow: var(--sn-assistant-shadow);
  overflow: hidden;
  backdrop-filter: blur(14px);
}

.sn-assistant-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 16px 10px;
  cursor: grab;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.52), rgba(255, 255, 255, 0));
}

.sn-assistant-panel__title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sn-assistant-panel__eyebrow {
  font-size: 11px;
  font-weight: 700;
  color: var(--sn-assistant-accent);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sn-assistant-panel__heading {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.2;
}

.sn-assistant-panel__subheading {
  font-size: 12px;
  color: var(--sn-assistant-muted);
}

.sn-assistant-panel__header-actions,
.sn-assistant-panel__footer,
.sn-assistant-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sn-assistant-panel__footer,
.sn-assistant-row--wrap,
.sn-assistant-modal__footer {
  flex-wrap: wrap;
}

.sn-assistant-panel__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 0 16px 16px;
}

.sn-assistant-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sn-assistant-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 11px;
  color: var(--sn-assistant-muted);
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(25, 35, 44, 0.08);
}

.sn-assistant-chip strong {
  color: var(--sn-assistant-ink);
}

.sn-assistant-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.sn-assistant-tab {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.84);
  color: var(--sn-assistant-muted);
  font-size: 12px;
  font-weight: 700;
  box-shadow: inset 0 0 0 1px rgba(25, 35, 44, 0.07);
}

.sn-assistant-tab.is-active {
  background: linear-gradient(135deg, var(--sn-assistant-accent), #1f7b8e);
  color: #ffffff;
  box-shadow: 0 10px 22px rgba(10, 68, 85, 0.18);
}

.sn-assistant-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sn-assistant-field__label {
  font-size: 12px;
  font-weight: 700;
  color: var(--sn-assistant-ink);
}

.sn-assistant-input,
.sn-assistant-select,
.sn-assistant-textarea {
  width: 100%;
  border-radius: 12px;
  border: 1px solid rgba(25, 35, 44, 0.11);
  background: rgba(255, 255, 255, 0.9);
  color: var(--sn-assistant-ink);
  font: inherit;
  box-sizing: border-box;
}

.sn-assistant-input,
.sn-assistant-select {
  height: 40px;
  padding: 0 12px;
}

.sn-assistant-textarea {
  min-height: 96px;
  padding: 10px 12px;
  resize: vertical;
}

.sn-assistant-input:focus,
.sn-assistant-select:focus,
.sn-assistant-textarea:focus {
  outline: none;
  border-color: rgba(13, 90, 109, 0.35);
  box-shadow: 0 0 0 4px rgba(13, 90, 109, 0.1);
}

.sn-assistant-preview {
  border-radius: 16px;
  border: 1px solid rgba(25, 35, 44, 0.1);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(249, 245, 239, 0.88));
  padding: 14px;
}

.sn-assistant-preview__empty {
  font-size: 12px;
  color: var(--sn-assistant-muted);
}

.sn-assistant-preview__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.sn-assistant-preview__meta-block {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(25, 35, 44, 0.08);
}

.sn-assistant-preview__meta-label {
  display: block;
  margin-bottom: 4px;
  font-size: 10px;
  font-weight: 700;
  color: var(--sn-assistant-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sn-assistant-preview__meta-value {
  font-size: 12px;
  line-height: 1.4;
}

.sn-assistant-preview__body {
  max-height: 240px;
  overflow: auto;
  padding: 12px;
  border-radius: 12px;
  background: rgba(20, 27, 35, 0.04);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.sn-assistant-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 86px;
  height: 38px;
  padding: 0 14px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
}

.sn-assistant-button--compact {
  min-width: 72px;
  height: 32px;
  padding: 0 12px;
}

.sn-assistant-button--primary {
  background: linear-gradient(135deg, var(--sn-assistant-accent), #1f7b8e);
  color: #ffffff;
  box-shadow: 0 10px 20px rgba(10, 68, 85, 0.18);
}

.sn-assistant-button--secondary {
  background: rgba(255, 255, 255, 0.86);
  color: var(--sn-assistant-ink);
  box-shadow: inset 0 0 0 1px rgba(25, 35, 44, 0.09);
}

.sn-assistant-button--danger {
  background: rgba(255, 241, 239, 0.95);
  color: var(--sn-assistant-danger);
  box-shadow: inset 0 0 0 1px rgba(181, 71, 63, 0.16);
}

.sn-assistant-button[disabled],
.sn-assistant-mini-button[disabled],
.sn-assistant-launcher__primary[disabled] {
  cursor: not-allowed;
  opacity: 0.52;
  transform: none;
  box-shadow: none;
}

.sn-assistant-mini-button {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.84);
  color: var(--sn-assistant-muted);
  box-shadow: inset 0 0 0 1px rgba(25, 35, 44, 0.08);
  font-size: 15px;
}

.sn-assistant-mini-button--danger {
  color: var(--sn-assistant-danger);
  box-shadow: inset 0 0 0 1px rgba(181, 71, 63, 0.18);
}

.sn-assistant-modal {
  position: fixed;
  inset: 0;
  z-index: 2147483200;
  display: grid;
  place-items: center;
  padding: 18px;
}

.sn-assistant-modal__backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top left, rgba(13, 90, 109, 0.22), transparent 48%),
    rgba(15, 23, 42, 0.32);
  backdrop-filter: blur(8px);
}

.sn-assistant-modal__dialog {
  position: relative;
  width: min(920px, calc(100vw - 24px));
  max-height: calc(100vh - 36px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.96), transparent 34%),
    linear-gradient(180deg, rgba(255, 252, 248, 0.98), rgba(244, 239, 231, 0.98));
  border: 1px solid rgba(255, 255, 255, 0.28);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
}

.sn-assistant-modal__header,
.sn-assistant-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
}

.sn-assistant-modal__header {
  border-bottom: 1px solid rgba(25, 35, 44, 0.08);
}

.sn-assistant-modal__footer {
  border-top: 1px solid rgba(25, 35, 44, 0.08);
  background: rgba(255, 255, 255, 0.5);
}

.sn-assistant-modal__title {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.sn-assistant-modal__body {
  overflow: auto;
  padding: 18px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.sn-assistant-note {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(13, 90, 109, 0.08);
  color: var(--sn-assistant-accent-strong);
  font-size: 12px;
  line-height: 1.5;
}

.sn-assistant-settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.sn-assistant-settings-grid--compact {
  margin-bottom: 12px;
}

.sn-assistant-checkbox-list {
  display: grid;
  gap: 10px;
}

.sn-assistant-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(25, 35, 44, 0.08);
}

.sn-assistant-checkbox input {
  margin-top: 3px;
}

.sn-assistant-checkbox strong {
  display: block;
  font-size: 12px;
  margin-bottom: 2px;
}

.sn-assistant-checkbox span {
  display: block;
  color: var(--sn-assistant-muted);
  font-size: 11px;
  line-height: 1.45;
}

.sn-assistant-template-manager {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sn-assistant-template-list {
  display: grid;
  gap: 12px;
}

.sn-assistant-template-card {
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(25, 35, 44, 0.08);
}

.sn-assistant-template-card.is-selected {
  border-color: rgba(13, 90, 109, 0.36);
  box-shadow: inset 0 0 0 1px rgba(13, 90, 109, 0.18);
}

.sn-assistant-template-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.sn-assistant-template-card__title {
  font-size: 13px;
  font-weight: 700;
}

.sn-assistant-template-card__meta {
  margin-top: 2px;
  font-size: 11px;
  color: var(--sn-assistant-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.sn-assistant-template-card__hint {
  margin-top: 8px;
  font-size: 11px;
  color: var(--sn-assistant-muted);
}

.sn-assistant-toast-viewport {
  position: fixed;
  right: 18px;
  bottom: 18px;
  display: grid;
  gap: 10px;
  z-index: 2147483300;
  pointer-events: none;
}

.sn-assistant-toast {
  min-width: 220px;
  max-width: 360px;
  padding: 12px 14px;
  border-radius: 14px;
  color: #ffffff;
  font-size: 12px;
  line-height: 1.45;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.22);
  animation: sn-assistant-toast-in 180ms ease;
}

.sn-assistant-toast--success {
  background: linear-gradient(135deg, #166b46, #20915f);
}

.sn-assistant-toast--error {
  background: linear-gradient(135deg, #a23633, #c2514b);
}

.sn-assistant-toast--info {
  background: linear-gradient(135deg, var(--sn-assistant-accent-strong), #1f7b8e);
}

@keyframes sn-assistant-toast-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .sn-assistant-panel {
    width: min(92vw, 380px);
  }

  .sn-assistant-settings-grid {
    grid-template-columns: 1fr;
  }

  .sn-assistant-modal {
    padding: 12px;
  }

  .sn-assistant-modal__dialog {
    width: calc(100vw - 12px);
    max-height: calc(100vh - 12px);
  }

  .sn-assistant-preview__meta {
    grid-template-columns: 1fr;
  }
}
`;

  // Assistant/ui/styles.js
  function ensureStyles(hostDocument) {
    if (!hostDocument || hostDocument.getElementById(UI_IDS.style)) return;
    const styleTag = hostDocument.createElement("style");
    styleTag.id = UI_IDS.style;
    styleTag.textContent = styles_default;
    (hostDocument.head || hostDocument.documentElement).appendChild(styleTag);
  }

  // Assistant/ui/toasts.js
  function ensureViewport(hostDocument) {
    let viewport = hostDocument.getElementById(UI_IDS.toastViewport);
    if (viewport) return viewport;
    viewport = hostDocument.createElement("div");
    viewport.id = UI_IDS.toastViewport;
    viewport.setAttribute(ROOT_ATTRIBUTE, ROOT_VALUE);
    viewport.className = "sn-assistant-toast-viewport";
    (hostDocument.body || hostDocument.documentElement).appendChild(viewport);
    return viewport;
  }
  function showToast(hostDocument, { message, tone = "success", duration = 2400 }) {
    if (!hostDocument) return;
    const viewport = ensureViewport(hostDocument);
    const toast = hostDocument.createElement("div");
    toast.className = `sn-assistant-toast sn-assistant-toast--${tone}`;
    toast.textContent = String(message || "");
    viewport.appendChild(toast);
    window.setTimeout(() => {
      if (toast.isConnected) {
        toast.remove();
      }
    }, duration);
  }
  function purgeToasts(hostDocument) {
    const viewport = hostDocument?.getElementById(UI_IDS.toastViewport);
    if (viewport) viewport.remove();
  }

  // Assistant/core/bootstrap.js
  function removeUiFromDocument(documentRef) {
    removeLauncher(documentRef);
    removePanel(documentRef);
    removeSettingsModal(documentRef);
    purgeToasts(documentRef);
  }
  function removeUiFromOtherDocuments(hostDocument) {
    getAccessibleDocuments().forEach((documentRef) => {
      if (documentRef !== hostDocument) {
        removeUiFromDocument(documentRef);
      }
    });
  }
  function ensureTemplateSelection(state, settings) {
    const groups = getTemplateGroups(settings);
    const categories = getCategories();
    let activeCategory = state.ui.activeCategory;
    if (!groups[activeCategory]?.length) {
      activeCategory = categories.find((category) => groups[category.id]?.length)?.id || categories[0]?.id || "email";
      setActiveCategory(state, activeCategory);
    }
    const templates = groups[activeCategory] || [];
    let selectedTemplateId = getSelectedTemplate(state, activeCategory);
    if (!templates.some((template) => template.id === selectedTemplateId)) {
      selectedTemplateId = getFirstTemplateId(activeCategory, settings);
      setSelectedTemplate(state, activeCategory, selectedTemplateId);
    }
    const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) || null;
    return {
      groups,
      categories,
      activeCategory,
      templates,
      selectedTemplateId,
      selectedTemplate
    };
  }
  function resolveTemplateSelection(state, settings, requestedCategory = state.ui.activeCategory) {
    if (requestedCategory === state.ui.activeCategory) {
      return ensureTemplateSelection(state, settings);
    }
    const groups = getTemplateGroups(settings);
    const categories = getCategories();
    const fallbackCategory = categories.find((category) => groups[category.id]?.length)?.id || categories[0]?.id || "email";
    const activeCategory = groups[requestedCategory]?.length ? requestedCategory : fallbackCategory;
    const templates = groups[activeCategory] || [];
    let selectedTemplateId = getSelectedTemplate(state, activeCategory);
    if (!templates.some((template) => template.id === selectedTemplateId)) {
      selectedTemplateId = getFirstTemplateId(activeCategory, settings);
      setSelectedTemplate(state, activeCategory, selectedTemplateId);
    }
    const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) || null;
    return {
      groups,
      categories,
      activeCategory,
      templates,
      selectedTemplateId,
      selectedTemplate
    };
  }
  function applyDraftFieldChange(state, name, value) {
    const draft = cloneSettings(ensureSettingsDraft(state));
    if (name === "officeProfile") {
      setSettingsDraft(state, applyOfficePreset(value, draft));
      return { rerender: true };
    }
    if (name.startsWith("toggle:")) {
      const toggleKey = name.split(":")[1];
      draft.toggles[toggleKey] = Boolean(value);
      setSettingsDraft(state, sanitizeSettings(draft));
      return { rerender: false };
    }
    if (name.startsWith("tpl:")) {
      const [, category, templateId, fieldName] = name.split(":");
      draft.templateOverrides[category] = draft.templateOverrides[category] || {};
      draft.templateOverrides[category][templateId] = draft.templateOverrides[category][templateId] || {};
      draft.templateOverrides[category][templateId][fieldName] = String(value || "");
      setSettingsDraft(state, sanitizeSettings(draft));
      return { rerender: false };
    }
    if (["officeName", "officeRoom", "officeLabel"].includes(name)) {
      draft.officeProfile = "custom";
    }
    draft[name] = String(value || "");
    setSettingsDraft(state, sanitizeSettings(draft));
    return { rerender: false };
  }
  function createBootstrap({ rootWindow, state, logger }) {
    const api = {
      start,
      destroy,
      scheduleRecovery
    };
    function isLauncherRefreshReason(reason) {
      return ["initial-start", "duplicate-loader", "start-reentry"].includes(reason);
    }
    function isPanelRefreshReason(reason) {
      return isLauncherRefreshReason(reason) || reason.startsWith("template-") || reason.startsWith("action:") || reason.startsWith("panel-") || reason === "settings-saved" || reason === "settings-imported" || reason === "settings-reset-draft" || reason === "settings-template-selected" || reason === "settings-template-restore";
    }
    function isSettingsRefreshReason(reason) {
      return isLauncherRefreshReason(reason) || reason.startsWith("settings-");
    }
    function getEffectiveSettings() {
      return state.settings;
    }
    function getDraftSettings() {
      return sanitizeSettings(state.ui.settingsDraft || state.settings);
    }
    async function getRenderedSelection({ hydrateUser = false, categoryOverride } = {}) {
      if (!state.context?.supported) {
        return {
          renderedTemplate: null,
          selection: resolveTemplateSelection(state, getEffectiveSettings(), categoryOverride)
        };
      }
      let context = state.context;
      if (hydrateUser) {
        const resolvedUser = await resolveUserForContext(context, state, getEffectiveSettings(), logger);
        if (resolvedUser?.email && resolvedUser.email !== context.user.email) {
          context = { ...context, user: resolvedUser };
          state.context = context;
        }
      }
      const selection = resolveTemplateSelection(state, getEffectiveSettings(), categoryOverride);
      const renderedTemplate = selection.selectedTemplate ? renderTemplate(selection.selectedTemplate, {
        context,
        settings: getEffectiveSettings()
      }) : null;
      return { renderedTemplate, selection };
    }
    async function runDraftFlow({ categoryOverride } = {}) {
      const { renderedTemplate, selection } = await getRenderedSelection({
        hydrateUser: true,
        categoryOverride
      });
      if (!renderedTemplate || renderedTemplate.category !== "email") {
        throw new Error("Draft is only available for email templates");
      }
      if (state.settings.toggles.autoCopyToClipboard) {
        await copyToClipboard(renderedTemplate.clipboardText, state.host.document);
      }
      const result = openDraft(renderedTemplate);
      if (!result.ok) {
        throw new Error("Draft could not be opened");
      }
      logger.info("template rendered successfully", { templateId: selection.selectedTemplateId });
    }
    function scheduleRecovery(reason = "manual", delayMs = 80) {
      state.lifecycle.queuedReason = reason;
      if (state.lifecycle.recoveryTimer) {
        window.clearTimeout(state.lifecycle.recoveryTimer);
      }
      state.lifecycle.recoveryTimer = window.setTimeout(() => {
        state.lifecycle.recoveryTimer = 0;
        recover(state.lifecycle.queuedReason || reason);
      }, delayMs);
    }
    async function runAction(actionKey, actionHandler) {
      if (state.pendingActions[actionKey]) return;
      state.pendingActions[actionKey] = true;
      scheduleRecovery(`action:${actionKey}:start`, 0);
      try {
        await actionHandler();
      } catch (error) {
        logger.error(`${actionKey} failed`, error);
        showToast(state.host.document, {
          message: error?.message || `${actionKey} failed`,
          tone: "error"
        });
      } finally {
        state.pendingActions[actionKey] = false;
        scheduleRecovery(`action:${actionKey}:end`, 0);
      }
    }
    const handlers = {
      onTogglePanel() {
        state.ui.panelOpen = !state.ui.panelOpen;
        state.ui.panelCollapsed = false;
        scheduleRecovery("panel-toggle", 0);
      },
      onQuickDraft() {
        runAction("draft", async () => {
          await runDraftFlow({ categoryOverride: "email" });
          showToast(state.host.document, {
            message: "Draft opened",
            tone: "info"
          });
        });
      },
      onForceClose() {
        api.destroy("user-force-close");
      },
      onClosePanel() {
        state.ui.panelOpen = false;
        scheduleRecovery("panel-close", 0);
      },
      onToggleCollapse() {
        state.ui.panelCollapsed = !state.ui.panelCollapsed;
        scheduleRecovery("panel-collapse", 0);
      },
      onOpenSettings() {
        openSettings(state, false);
        scheduleRecovery("settings-open", 0);
      },
      onCloseSettings() {
        if (closeSettings(state)) {
          scheduleRecovery("settings-close", 0);
        }
      },
      onSelectCategory(category) {
        setActiveCategory(state, category);
        scheduleRecovery("template-category", 0);
      },
      onSelectTemplate(templateId) {
        setSelectedTemplate(state, state.ui.activeCategory, templateId);
        scheduleRecovery("template-select", 0);
      },
      onCopy() {
        runAction("copy", async () => {
          const { renderedTemplate, selection } = await getRenderedSelection({ hydrateUser: false });
          if (!renderedTemplate) {
            throw new Error("No template selected");
          }
          const copied = await copyToClipboard(renderedTemplate.clipboardText, state.host.document);
          if (!copied) {
            throw new Error("Clipboard copy failed");
          }
          logger.info("template rendered successfully", { templateId: selection.selectedTemplateId });
          if (state.settings.toggles.autoOpenDraft && renderedTemplate.category === "email") {
            const result = openDraft(renderedTemplate);
            if (!result.ok) {
              throw new Error("Draft could not be opened");
            }
            showToast(state.host.document, {
              message: "Template copied and draft opened",
              tone: "info"
            });
            return;
          }
          showToast(state.host.document, { message: "Template copied" });
        });
      },
      onInsert() {
        runAction("insert", async () => {
          const { renderedTemplate, selection } = await getRenderedSelection({ hydrateUser: false });
          if (!renderedTemplate) {
            throw new Error("No template selected");
          }
          if (state.settings.toggles.autoCopyToClipboard) {
            await copyToClipboard(renderedTemplate.clipboardText, state.host.document);
          }
          const result = insertRenderedTemplate(renderedTemplate, state.context);
          if (!result.ok) {
            throw new Error("No compatible target field was found");
          }
          logger.info("template rendered successfully", { templateId: selection.selectedTemplateId });
          showToast(state.host.document, {
            message: `Inserted into ${result.targetField}`
          });
        });
      },
      onDraft() {
        runAction("draft", async () => {
          await runDraftFlow();
          showToast(state.host.document, {
            message: "Draft opened",
            tone: "info"
          });
        });
      },
      onPiSearch() {
        runAction("piSearch", async () => {
          if (!state.context?.supported) {
            throw new Error("No supported context available");
          }
          const piValue = await runPiSearch({
            context: state.context,
            hostDocument: state.host.document,
            logger
          });
          state.context = {
            ...state.context,
            configurationItem: piValue
          };
          state.caches.piByRecord[state.context.recordKey] = piValue;
          showToast(state.host.document, {
            message: `PI inserted: ${piValue}`
          });
        });
      },
      onFieldChange(name, value) {
        const result = applyDraftFieldChange(state, name, value);
        if (result.rerender) {
          scheduleRecovery("settings-field-change", 0);
        }
      },
      onTemplateManagerCategory(category) {
        state.ui.templateManagerCategory = category;
        scheduleRecovery("settings-template-category", 0);
      },
      onSelectSettingsTemplate(category, templateId) {
        setSelectedTemplate(state, category, templateId);
        setActiveCategory(state, category);
        showToast(state.host.document, {
          message: `Template selected: ${templateId}`,
          tone: "info"
        });
        scheduleRecovery("settings-template-selected", 0);
      },
      onRestoreTemplate(category, templateId) {
        const draft = cloneSettings(ensureSettingsDraft(state));
        if (draft.templateOverrides?.[category]) {
          delete draft.templateOverrides[category][templateId];
        }
        setSettingsDraft(state, sanitizeSettings(draft));
        scheduleRecovery("settings-template-restore", 0);
      },
      onResetSettings() {
        setSettingsDraft(state, getDefaultSettings());
        showToast(state.host.document, {
          message: "Defaults restored. Save settings to apply.",
          tone: "info"
        });
        scheduleRecovery("settings-reset-draft", 0);
      },
      onTriggerImport() {
        const importInput = state.host.document?.getElementById(UI_IDS.settingsImportInput);
        if (importInput) {
          importInput.click();
        }
      },
      async onImportSettingsFile(file) {
        if (!file) return;
        try {
          const importedSettings = await importSettingsPackage(file);
          setSettingsDraft(state, importedSettings);
          showToast(state.host.document, {
            message: "Import loaded. Save settings to apply.",
            tone: "info"
          });
          scheduleRecovery("settings-imported", 0);
        } catch (error) {
          logger.error("settings import failed", error);
          showToast(state.host.document, {
            message: error?.message || "Import failed",
            tone: "error"
          });
        }
      },
      async onExportSettings() {
        try {
          const result = await exportSettingsPackage(
            rootWindow,
            sanitizeSettings(state.ui.settingsDraft || state.settings)
          );
          if (!result.ok && result.canceled) {
            return;
          }
          const message = result.mode === "filesystem" ? `Templates exported to ${result.path}` : `Templates exported as ${result.fileName}`;
          showToast(state.host.document, {
            message,
            tone: "info"
          });
        } catch (error) {
          logger.error("settings export failed", error);
          showToast(state.host.document, {
            message: error?.message || "Export failed",
            tone: "error"
          });
        }
      },
      onSaveSettings() {
        const safeSettings = sanitizeSettings(state.ui.settingsDraft || state.settings);
        if (!hasRequiredSettings(safeSettings)) {
          openSettings(state, true);
          showToast(state.host.document, {
            message: "Office profile, room, label and language are required",
            tone: "error"
          });
          scheduleRecovery("settings-invalid", 0);
          return;
        }
        const persistedSettings = saveSettings(rootWindow, safeSettings, logger);
        setSettings(state, persistedSettings);
        discardSettingsDraft(state);
        state.ui.settingsOpen = false;
        state.ui.settingsMandatory = false;
        state.flags.missingSettingsLogged = false;
        logger.info("settings loaded");
        showToast(state.host.document, {
          message: "Settings saved"
        });
        scheduleRecovery("settings-saved", 0);
      }
    };
    async function recover(reason = "recover") {
      if (state.lifecycle.recovering) {
        state.lifecycle.queuedReason = reason;
        return;
      }
      state.lifecycle.recovering = true;
      try {
        const hostDocument = getHostDocument(rootWindow);
        state.host.document = hostDocument;
        ensureStyles(hostDocument);
        removeUiFromOtherDocuments(hostDocument);
        syncObservers({ state, onMutation: scheduleRecovery, logger });
        const nextContext = getCurrentContext(rootWindow);
        const contextDidChange = isContextChanged(state.context, nextContext);
        if (contextDidChange) {
          handleRecordChange(state, nextContext);
          logger.info(
            `record changed ${nextContext.table || "unknown"}::${nextContext.sysId || nextContext.ticketNumber || "unknown"}`
          );
        } else {
          state.context = nextContext;
        }
        if (reason === "dom-mutation") {
          logger.info("re-render detected, restoring UI");
        }
        if (!nextContext.ready || !nextContext.supported) {
          removeLauncher(hostDocument);
          removePanel(hostDocument);
          removeSettingsModal(hostDocument);
          return;
        }
        const settingsValid = hasRequiredSettings(state.settings);
        if (!settingsValid) {
          if (!state.flags.missingSettingsLogged) {
            logger.info("first-run settings required");
            state.flags.missingSettingsLogged = true;
          }
          openSettings(state, true);
          removeLauncher(hostDocument);
          removePanel(hostDocument);
          const shouldRefreshMissingSettings = !hostDocument.getElementById(UI_IDS.settings) || contextDidChange || reason.startsWith("settings-") || reason === "initial-start" || reason === "dom-mutation";
          if (shouldRefreshMissingSettings) {
            const draftSettings = getDraftSettings();
            const templateGroups = getTemplateGroups(draftSettings);
            ensureSettingsModal({
              hostDocument,
              state,
              draftSettings,
              templateGroups,
              handlers
            });
          }
          return;
        }
        state.flags.missingSettingsLogged = false;
        state.ui.settingsMandatory = false;
        const passiveReason = ["heartbeat", "window-focus", "visibility-change"].includes(reason);
        const launcherMissing = !hostDocument.getElementById(UI_IDS.launcher);
        const panelMissing = !hostDocument.getElementById(UI_IDS.panel);
        const settingsMissing = !hostDocument.getElementById(UI_IDS.settings);
        if (launcherMissing || contextDidChange || isLauncherRefreshReason(reason)) {
          ensureLauncher({
            hostDocument,
            state,
            context: nextContext,
            handlers
          });
        }
        const { renderedTemplate, selection } = await getRenderedSelection({
          hydrateUser: false
        });
        if (state.ui.panelOpen && (panelMissing || contextDidChange || isPanelRefreshReason(reason))) {
          ensurePanel({
            hostDocument,
            state,
            context: state.context,
            categories: selection.categories,
            templates: selection.templates,
            selectedTemplateId: selection.selectedTemplateId,
            renderedTemplate,
            handlers
          });
        } else if (!state.ui.panelOpen) {
          removePanel(hostDocument);
        }
        const shouldRefreshSettings = settingsMissing || contextDidChange || isSettingsRefreshReason(reason);
        if (state.ui.settingsOpen && shouldRefreshSettings) {
          const draftSettings = getDraftSettings();
          const templateGroups = getTemplateGroups(draftSettings);
          ensureSettingsModal({
            hostDocument,
            state,
            draftSettings,
            templateGroups,
            handlers
          });
        } else if (!state.ui.settingsOpen) {
          removeSettingsModal(hostDocument);
        }
      } finally {
        state.lifecycle.recovering = false;
        if (state.lifecycle.queuedReason && state.lifecycle.queuedReason !== reason) {
          const nextReason = state.lifecycle.queuedReason;
          state.lifecycle.queuedReason = "";
          scheduleRecovery(nextReason, 0);
        } else {
          state.lifecycle.queuedReason = "";
        }
      }
    }
    function start() {
      if (state.lifecycle.started) {
        scheduleRecovery("start-reentry", 0);
        return;
      }
      state.lifecycle.started = true;
      state.lifecycle.focusHandler = () => scheduleRecovery("window-focus", 0);
      state.lifecycle.visibilityHandler = () => {
        if (!document.hidden) {
          scheduleRecovery("visibility-change", 0);
        }
      };
      rootWindow.addEventListener("focus", state.lifecycle.focusHandler);
      rootWindow.document.addEventListener("visibilitychange", state.lifecycle.visibilityHandler);
      syncObservers({ state, onMutation: scheduleRecovery, logger });
      startHeartbeat({
        state,
        onTick: () => scheduleRecovery("heartbeat", 0)
      });
      scheduleRecovery("initial-start", 0);
    }
    function destroy(reason = "destroy") {
      if (!state.lifecycle.started) return;
      stopObserverSystem(state);
      if (state.lifecycle.recoveryTimer) {
        window.clearTimeout(state.lifecycle.recoveryTimer);
        state.lifecycle.recoveryTimer = 0;
      }
      rootWindow.removeEventListener("focus", state.lifecycle.focusHandler);
      rootWindow.document.removeEventListener("visibilitychange", state.lifecycle.visibilityHandler);
      getAccessibleDocuments().forEach(removeUiFromDocument);
      state.lifecycle.started = false;
      logger.info("bootstrap destroyed", { reason });
    }
    return api;
  }

  // Assistant/core/logger.js
  var PREFIX = "[SN Assistant]";
  function write(method, args) {
    const logger = console[method] || console.log;
    logger.call(console, PREFIX, ...args);
  }
  function createLogger() {
    return {
      info: (...args) => write("log", args),
      warn: (...args) => write("warn", args),
      error: (...args) => write("error", args)
    };
  }

  // Assistant/version.js
  var VERSION = "2.0.0";

  // Assistant/assistant.js
  var GLOBAL_KEY = "__SN_ASSISTANT__";
  function startAssistant() {
    const rootWindow = getRootWindow();
    const globalStore = rootWindow[GLOBAL_KEY] = rootWindow[GLOBAL_KEY] || {};
    if (globalStore.instance?.version === VERSION) {
      globalStore.instance.logger.info("loader already active");
      globalStore.instance.bootstrap.scheduleRecovery("duplicate-loader", 0);
      return globalStore.instance;
    }
    if (globalStore.instance?.destroy) {
      globalStore.instance.destroy("version-reload");
    }
    const logger = createLogger();
    logger.info("loader started", { version: VERSION });
    const settings = loadSettings(rootWindow, logger);
    logger.info("settings loaded", { valid: hasRequiredSettings(settings) });
    const state = createState(settings);
    const bootstrap = createBootstrap({
      rootWindow,
      state,
      logger
    });
    function destroy(reason = "destroy") {
      bootstrap.destroy(reason);
      if (globalStore.instance === instance) {
        delete globalStore.instance;
      }
    }
    const instance = {
      version: VERSION,
      logger,
      state,
      bootstrap,
      destroy
    };
    globalStore.instance = instance;
    bootstrap.start();
    return instance;
  }

  // entry.js
  startAssistant();
})();
