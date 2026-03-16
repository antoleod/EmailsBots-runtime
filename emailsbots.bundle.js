(() => {
  // utils.js
  (function() {
    const ns = window.__SN_SMART_EMAIL__ = window.__SN_SMART_EMAIL__ || {};
    ns.CONFIG = {
      BUTTON_ID: "sn-smart-email-generator",
      ACTION_BUTTON_ID: "sn-open-outlook-draft-btn",
      TOAST_ID: "sn-smart-email-toast",
      PREVIEW_ID: "viewr.sc_task.request_item.request.requested_for",
      CI_SELECTORS: [
        "#sys_display\\.sc_task\\.cmdb_ci",
        "#sys_display\\.sc_req_item\\.cmdb_ci",
        "#sys_display\\.task\\.cmdb_ci",
        'input[id*="cmdb_ci"]'
      ],
      PREVIEW_WAIT_MS: 2e4,
      POPUP_WAIT_MS: 5e3,
      STORAGE_KEY: "sn_requested_for_user_info"
    };
    const utils = ns.utils = ns.utils || {};
    utils.delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    utils.log = (...args) => {
      console.log("[SN Smart Email]", ...args);
    };
    utils.cleanValue = (value) => {
      if (value === null || value === void 0) return "";
      const text = String(value).trim();
      return text === "undefined" || text === "null" ? "" : text;
    };
    utils.normalize = (text) => {
      return utils.cleanValue(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
    };
  })();

  // servicenow.js
  (function() {
    const ns = window.__SN_SMART_EMAIL__ = window.__SN_SMART_EMAIL__ || {};
    const { CONFIG } = ns;
    const utils = ns.utils || {};
    const servicenow = ns.servicenow = ns.servicenow || {};
    servicenow.getAllDocs = () => {
      const docs = [document];
      for (let i = 0; i < window.frames.length; i++) {
        try {
          const frameDoc = window.frames[i].document;
          if (frameDoc) docs.push(frameDoc);
        } catch (e) {
        }
      }
      return docs;
    };
    servicenow.getAllWindows = () => {
      const wins = [window];
      for (let i = 0; i < window.frames.length; i++) {
        try {
          const w = window.frames[i];
          if (w) wins.push(w);
        } catch (e) {
        }
      }
      return wins;
    };
    servicenow.getBestGForm = () => {
      const wins = servicenow.getAllWindows();
      for (const w of wins) {
        try {
          if (w.g_form && typeof w.g_form.getValue === "function") {
            const tableName = utils.cleanValue(w.g_form.getTableName && w.g_form.getTableName()) || "";
            const number = utils.cleanValue(w.g_form.getValue("number")) || "";
            const shortDesc = utils.cleanValue(w.g_form.getValue("short_description")) || "";
            if (tableName || number || shortDesc) {
              return w.g_form;
            }
          }
        } catch (e) {
        }
      }
      return null;
    };
    servicenow.safeGetField = (name) => {
      try {
        const gf = servicenow.getBestGForm();
        if (gf && typeof gf.getValue === "function") {
          return utils.cleanValue(gf.getValue(name));
        }
      } catch (e) {
        utils.log(`safeGetField failed for ${name}`, e);
      }
      return "";
    };
    servicenow.getFirstExistingValue = (selectors) => {
      const docs = servicenow.getAllDocs();
      for (const doc of docs) {
        for (const selector of selectors) {
          try {
            const el = doc.querySelector(selector);
            if (!el) continue;
            const value = utils.cleanValue(
              el.value || el.innerText || el.textContent || ""
            );
            if (value) return value;
          } catch (e) {
          }
        }
      }
      return "";
    };
    servicenow.waitForPreviewButtonInAnyFrame = async (id, timeoutMs = CONFIG.PREVIEW_WAIT_MS, intervalMs = 300) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const docs = servicenow.getAllDocs();
        for (const doc of docs) {
          try {
            const el = doc.getElementById(id);
            if (el) return { el, doc };
          } catch (e) {
          }
        }
        await utils.delay(intervalMs);
      }
      return null;
    };
    servicenow.findPopupInAnyFrame = () => {
      const docs = servicenow.getAllDocs();
      for (const doc of docs) {
        try {
          const pops = doc.querySelectorAll(
            '.popover,[role="dialog"],div[id^="popover"],.modal,.glide_box'
          );
          for (const p of pops) {
            const html = p.innerHTML || "";
            if (html.includes("sys_user.email") || html.includes("sys_user.first_name") || html.includes("sys_user.last_name")) {
              return { popup: p, doc };
            }
          }
        } catch (e) {
        }
      }
      return null;
    };
    servicenow.waitForPopupInAnyFrame = async (timeoutMs = CONFIG.POPUP_WAIT_MS, intervalMs = 200) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const found = servicenow.findPopupInAnyFrame();
        if (found) return found;
        await utils.delay(intervalMs);
      }
      return null;
    };
    servicenow.getPopupValue = (popup, selectors) => {
      for (const selector of selectors) {
        const el = popup.querySelector(selector);
        if (el && typeof el.value === "string" && el.value.trim()) {
          return utils.cleanValue(el.value);
        }
      }
      return "";
    };
    servicenow.getUserFromPopup = (popup) => {
      return {
        firstName: servicenow.getPopupValue(popup, [
          "#sys_readonly\\.sys_user\\.first_name",
          "#sys_user\\.first_name",
          'input[id="sys_readonly.sys_user.first_name"]',
          'input[id="sys_user.first_name"]'
        ]),
        lastName: servicenow.getPopupValue(popup, [
          "#sys_readonly\\.sys_user\\.last_name",
          "#sys_user\\.last_name",
          'input[id="sys_readonly.sys_user.last_name"]',
          'input[id="sys_user.last_name"]'
        ]),
        email: servicenow.getPopupValue(popup, [
          "#sys_readonly\\.sys_user\\.email",
          "#sys_user\\.email",
          'input[id="sys_readonly.sys_user.email"]',
          'input[id="sys_user.email"]'
        ])
      };
    };
    servicenow.hidePreview = (popup, popupDoc = document) => {
      if (!popup) return false;
      try {
        popup.style.display = "none";
        popup.style.visibility = "hidden";
        popup.style.opacity = "0";
        popup.style.pointerEvents = "none";
        popup.setAttribute("aria-hidden", "true");
        popup.classList.remove("in", "show", "active");
      } catch (e) {
      }
      try {
        const overlays = popupDoc.querySelectorAll(
          '.modal-backdrop, .popover-backdrop, .glide_box_overlay, .sn-modal-backdrop, [class*="backdrop"], [class*="overlay"]'
        );
        overlays.forEach((el) => {
          try {
            el.style.display = "none";
            el.style.visibility = "hidden";
            el.style.opacity = "0";
            el.style.pointerEvents = "none";
          } catch (e) {
          }
        });
      } catch (e) {
      }
      try {
        popupDoc.body.classList.remove("modal-open");
        popupDoc.body.style.overflow = "";
        popupDoc.body.style.pointerEvents = "";
      } catch (e) {
      }
      return true;
    };
    servicenow.getRequestedForFromPreview = async () => {
      const foundButton = await servicenow.waitForPreviewButtonInAnyFrame(
        CONFIG.PREVIEW_ID,
        CONFIG.PREVIEW_WAIT_MS,
        300
      );
      if (!foundButton) {
        throw new Error(`Preview button not found: ${CONFIG.PREVIEW_ID}`);
      }
      foundButton.el.click();
      const foundPopup = await servicenow.waitForPopupInAnyFrame(
        CONFIG.POPUP_WAIT_MS,
        200
      );
      if (!foundPopup) {
        throw new Error("Popup not found after clicking preview");
      }
      const popup = foundPopup.popup;
      const popupDoc = foundPopup.doc || document;
      const user = servicenow.getUserFromPopup(popup);
      if (!utils.cleanValue(user.email)) {
        throw new Error("Email field not found inside popup");
      }
      sessionStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(user));
      servicenow.hidePreview(popup, popupDoc);
      return user;
    };
  })();

  // templates.js
  (function() {
    const ns = window.__SN_SMART_EMAIL__ = window.__SN_SMART_EMAIL__ || {};
    const utils = ns.utils || {};
    const templates = ns.templates = ns.templates || {};
    function safeClean(value) {
      return typeof utils.cleanValue === "function" ? utils.cleanValue(value) : String(value || "").trim();
    }
    function safeNormalize(value) {
      if (typeof utils.normalize === "function") return utils.normalize(value);
      return safeClean(value).toLowerCase();
    }
    templates.buildSalutation = (user = {}) => {
      const firstName = safeClean(user.firstName);
      const lastName = safeClean(user.lastName);
      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
      if (fullName) return `Dear ${fullName},`;
      if (firstName) return `Dear ${firstName},`;
      return "Dear colleague,";
    };
    templates.buildSignature = () => {
      return "Kind regards,";
    };
    templates.buildDetailsBlock = ({ device, ci, shortDesc }) => {
      const lines = [
        safeClean(device) ? `Device: ${safeClean(device)}` : "",
        safeClean(ci) ? `PI / Configuration item: ${safeClean(ci)}` : "",
        safeClean(shortDesc) ? `Request: ${safeClean(shortDesc)}` : ""
      ].filter(Boolean);
      return lines.length ? `${lines.join("\n")}

` : "";
    };
    templates.detectDevice = (rawText, ciText) => {
      const text = safeClean(`${safeClean(rawText)} ${safeClean(ciText)}`).replace(/\s+/g, " ").trim().toLowerCase();
      const patterns = [
        /\bapple iphone \d+(?:\s+\d+gb)?(?:\s+[a-z]+)?\b/i,
        /\biphone \d+(?:\s+\d+gb)?(?:\s+[a-z]+)?\b/i,
        /\bipad(?:\s+[a-z0-9]+)*\b/i,
        /\bsamsung galaxy [a-z0-9+\- ]+\b/i,
        /\bmicrosoft surface [a-z0-9+\- ]+\b/i
      ];
      for (const regex of patterns) {
        const match = text.match(regex);
        if (match) {
          return safeClean(match[0]).replace(/\s+/g, " ").trim().toUpperCase();
        }
      }
      if (text.includes("iphone")) return "APPLE IPHONE";
      if (text.includes("ipad")) return "APPLE IPAD";
      if (text.includes("samsung")) return "SAMSUNG SMARTPHONE";
      if (text.includes("surface")) return "MICROSOFT SURFACE";
      if (text.includes("headset")) return "HEADSET";
      if (text.includes("laptop")) return "LAPTOP";
      return "";
    };
    templates.detectType = (text) => {
      text = safeNormalize(text);
      if (text.includes("schedule smartphone delivery, delivery and closure") || text.includes("schedule smartphone delivery") && text.includes("delivery and closure")) {
        return "schedule_smartphone_delivery_closure";
      }
      if (text.includes("iphone replacement") || text.includes("replacement plan")) {
        return "iphone_replacement";
      }
      if (text.includes("smartphone") || text.includes("iphone") || text.includes("samsung")) {
        return "smartphone";
      }
      if (text.includes("headset")) return "headset";
      if (text.includes("token") || text.includes("virtual token")) return "token";
      if (text.includes("mdm") || text.includes("mobile device management") || text.includes("intune")) {
        return "mdm";
      }
      if (text.includes("collect") || text.includes("pickup") || text.includes("return old device")) {
        return "collection";
      }
      if (text.includes("laptop") || text.includes("surface")) return "laptop";
      return "generic";
    };
    templates.emailTemplate = (type, device, ci, user, ticket, shortDesc) => {
      const salutation = templates.buildSalutation(user);
      const signature = templates.buildSignature();
      const details = templates.buildDetailsBlock({ device, ci, shortDesc });
      const cleanTicket = safeClean(ticket) || "Ticket";
      const cleanDevice = safeClean(device);
      const map = {
        schedule_smartphone_delivery_closure: () => ({
          subject: `Schedule smartphone delivery - ${cleanTicket}`,
          body: `${salutation}

We are contacting you regarding the delivery of your corporate smartphone.

Your new device has been prepared and is ready for handover${cleanDevice ? ` (${cleanDevice})` : ""}.

As part of the iPhone Replacement Plan 2026, we would be grateful if you could let us know your availability so that we may arrange the handover and complete the request afterwards.

${details}${signature}`
        }),
        iphone_replacement: () => ({
          subject: `Smartphone delivery - ${cleanTicket}`,
          body: `${salutation}

We are contacting you regarding the delivery of your corporate smartphone and the completion of the related request.

Your new device has been prepared and is ready for handover${cleanDevice ? ` (${cleanDevice})` : ""}.

As part of the iPhone Replacement Plan 2026, we would be grateful if you could let us know your availability so that we may arrange the handover and proceed with the closure of the request.

${details}${signature}`
        }),
        smartphone: () => ({
          subject: `Smartphone delivery - ${cleanTicket}`,
          body: `${salutation}

We are contacting you regarding your corporate smartphone${cleanDevice ? ` (${cleanDevice})` : ""}.

Your device is now ready for handover.

${details}Please let us know your availability so that we may arrange the delivery.

${signature}`
        }),
        laptop: () => ({
          subject: `Laptop delivery - ${cleanTicket}`,
          body: `${salutation}

We are contacting you regarding your corporate laptop${cleanDevice ? ` (${cleanDevice})` : ""}.

Your device is now ready for handover.

${details}Please let us know your availability so that we may arrange the delivery.

${signature}`
        }),
        headset: () => ({
          subject: `Headset handover - ${cleanTicket}`,
          body: `${salutation}

We are contacting you regarding your headset request.

Your equipment is ready for collection or handover.

${details}Please let us know your availability so that we may arrange this with you.

${signature}`
        }),
        token: () => ({
          subject: `Token setup assistance - ${cleanTicket}`,
          body: `${salutation}

We are contacting you regarding the setup of your authentication token.

We would like to assist you with the configuration and final verification.

Please let us know your availability so that we may proceed.

${signature}`
        }),
        mdm: () => ({
          subject: `MDM setup - ${cleanTicket}`,
          body: `${salutation}

We are contacting you regarding the Mobile Device Management (MDM) setup of your device${cleanDevice ? ` (${cleanDevice})` : ""}.

${details}Please let us know your availability so that we may continue with the configuration.

${signature}`
        }),
        collection: () => ({
          subject: `Collection of previous device - ${cleanTicket}`,
          body: `${salutation}

We would like to arrange the collection of your previous device.

${details}Please let us know your availability so that we may organise the pickup or handover.

${signature}`
        }),
        generic: () => ({
          subject: `IT equipment follow-up - ${cleanTicket}`,
          body: `${salutation}

We are contacting you regarding your IT equipment request.

${details}Please let us know your availability so that we may proceed with the next step.

${signature}`
        })
      };
      return (map[type] || map.generic)();
    };
    templates.buildMail = ({ user, ticket, shortDesc, desc, ci }) => {
      const fullText = `${safeClean(shortDesc)} ${safeClean(desc)} ${safeClean(ci)}`;
      const device = safeClean(templates.detectDevice(fullText, ci));
      const type = safeClean(templates.detectType(fullText)) || "generic";
      const mail = templates.emailTemplate(type, device, ci, user, ticket, shortDesc);
      const recipient = safeClean(user && user.email);
      return {
        ...mail,
        type,
        device,
        ci: safeClean(ci),
        shortDesc: safeClean(shortDesc),
        desc: safeClean(desc),
        ticket: safeClean(ticket) || "Ticket",
        mailto: `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(safeClean(mail.subject))}&body=${encodeURIComponent(safeClean(mail.body))}`
      };
    };
  })();

  // ui.js
  (function() {
    const ns = window.__SN_SMART_EMAIL__ = window.__SN_SMART_EMAIL__ || {};
    const CONFIG = ns.CONFIG || {
      BUTTON_ID: "sn-smart-email-generator",
      ACTION_BUTTON_ID: "sn-open-outlook-draft-btn",
      TOAST_ID: "sn-smart-email-toast",
      PREVIEW_ID: "viewr.sc_task.request_item.request.requested_for",
      CI_SELECTORS: [
        "#sys_display\\.sc_task\\.cmdb_ci",
        "#sys_display\\.sc_req_item\\.cmdb_ci",
        "#sys_display\\.task\\.cmdb_ci",
        'input[id*="cmdb_ci"]'
      ]
    };
    const utils = ns.utils || {};
    const servicenow = ns.servicenow || {};
    const ui = ns.ui = ns.ui || {};
    const UI_CONTAINER_ID = "sn-smart-email-ui-container";
    function getAllDocs() {
      if (servicenow && typeof servicenow.getAllDocs === "function") return servicenow.getAllDocs();
      return [document];
    }
    function findPrimaryDoc() {
      const docs = getAllDocs();
      for (const doc of docs) {
        try {
          if (doc.getElementById(CONFIG.PREVIEW_ID)) return doc;
        } catch (e) {
        }
      }
      for (const doc of docs) {
        try {
          const w = doc.defaultView;
          if (w && w.g_form && typeof w.g_form.getValue === "function") return doc;
        } catch (e) {
        }
      }
      for (const doc of docs) {
        for (const sel of CONFIG.CI_SELECTORS || []) {
          try {
            if (doc.querySelector(sel)) return doc;
          } catch (e) {
          }
        }
      }
      return document;
    }
    function findFormRoot(doc) {
      const selectors = [
        "#sys_form",
        'form[name="sys_form"]',
        "#sysparm_form",
        "form"
      ];
      for (const sel of selectors) {
        try {
          const el = doc.querySelector(sel);
          if (!el) continue;
          const r = el.getBoundingClientRect && el.getBoundingClientRect();
          if (r && r.width && r.width > 600) return el;
        } catch (e) {
        }
      }
      return doc.body || doc.documentElement || null;
    }
    function positionContainer(container) {
      try {
        const doc = container.ownerDocument || document;
        const w = doc.defaultView || window;
        const formRoot = findFormRoot(doc);
        if (!w || !formRoot || typeof formRoot.getBoundingClientRect !== "function") return;
        const rect = formRoot.getBoundingClientRect();
        const rightPx = Math.max((w.innerWidth || 0) - rect.right + 12, 16);
        const topPx = Math.max(rect.top + 12, 72);
        container.style.right = `${rightPx}px`;
        container.style.top = `${topPx}px`;
      } catch (e) {
      }
    }
    function ensureContainer() {
      for (const doc of getAllDocs()) {
        try {
          const existing = doc.getElementById(UI_CONTAINER_ID);
          if (existing) return existing;
        } catch (e) {
        }
      }
      const primaryDoc = findPrimaryDoc();
      const container = primaryDoc.createElement("div");
      container.id = UI_CONTAINER_ID;
      Object.assign(container.style, {
        // Fixed inside the form document (usually the iframe), so it won't collide with global Update/Save/Follow.
        position: "fixed",
        top: "72px",
        right: "20px",
        zIndex: "999999",
        display: "flex",
        gap: "8px",
        alignItems: "center"
      });
      (primaryDoc.body || primaryDoc.documentElement).appendChild(container);
      positionContainer(container);
      try {
        const w = primaryDoc.defaultView;
        if (w && !container.__snSmartEmailBound) {
          container.__snSmartEmailBound = true;
          w.addEventListener("resize", () => positionContainer(container), { passive: true });
          w.addEventListener("scroll", () => positionContainer(container), { passive: true });
        }
      } catch (e) {
      }
      return container;
    }
    ui.toast = () => {
    };
    ui.purgeToasts = () => {
      for (const doc of getAllDocs()) {
        try {
          const old = doc.getElementById(CONFIG.TOAST_ID);
          if (old) old.remove();
        } catch (e) {
        }
      }
    };
    ui.removeActionButton = () => {
      for (const doc of getAllDocs()) {
        try {
          const old = doc.getElementById(CONFIG.ACTION_BUTTON_ID);
          if (old) old.remove();
        } catch (e) {
        }
      }
    };
    ui.removeMainButton = () => {
      for (const doc of getAllDocs()) {
        try {
          const old = doc.getElementById(CONFIG.BUTTON_ID);
          if (old) old.remove();
        } catch (e) {
        }
      }
    };
    ui.removeAllButtons = () => {
      ui.removeActionButton();
      ui.removeMainButton();
    };
    ui.openMailto = (mailto) => {
      window.location.href = mailto;
    };
    ui.showOpenOutlookButton = (mail) => {
      ui.removeActionButton();
      const container = ensureContainer();
      const doc = container.ownerDocument || document;
      const btn = doc.createElement("button");
      btn.id = CONFIG.ACTION_BUTTON_ID;
      btn.textContent = "Open Outlook Draft";
      Object.assign(btn.style, {
        // Mandatory: fully hidden, no layout space, not user-clickable.
        display: "none"
      });
      btn.addEventListener("click", function() {
        ui.openMailto(mail.mailto);
      });
      btn.setAttribute("aria-hidden", "true");
      btn.tabIndex = -1;
      btn.disabled = true;
      container.appendChild(btn);
      return btn;
    };
    ui.injectMainButton = (onClick) => {
      ui.removeMainButton();
      const container = ensureContainer();
      const doc = container.ownerDocument || document;
      const b = doc.createElement("button");
      b.id = CONFIG.BUTTON_ID;
      b.textContent = "Prepare Outlook Draft";
      Object.assign(b.style, {
        position: "relative",
        background: "#0055A4",
        color: "#fff",
        border: "none",
        padding: "10px 14px",
        borderRadius: "8px",
        cursor: "pointer",
        boxShadow: "0 2px 10px rgba(0,0,0,.12)",
        fontSize: "13px",
        fontFamily: "Arial, sans-serif"
      });
      b.addEventListener("click", onClick);
      container.appendChild(b);
    };
  })();

  // core.js
  (function() {
    const ns = window.__SN_SMART_EMAIL__ = window.__SN_SMART_EMAIL__ || {};
    const CONFIG = ns.CONFIG || {
      CI_SELECTORS: [
        "#sys_display\\.sc_task\\.cmdb_ci",
        "#sys_display\\.sc_req_item\\.cmdb_ci",
        "#sys_display\\.task\\.cmdb_ci",
        'input[id*="cmdb_ci"]'
      ]
    };
    const utils = ns.utils || {};
    const ui = ns.ui || {};
    const servicenow = ns.servicenow || {};
    const templates = ns.templates || {};
    const core = ns.core = ns.core || {};
    core.run = async () => {
      try {
        if (ui && typeof ui.purgeToasts === "function") ui.purgeToasts();
        const user = await servicenow.getRequestedForFromPreview();
        const ticket = utils.cleanValue(servicenow.safeGetField("number")) || "Ticket";
        const shortDesc = utils.cleanValue(servicenow.safeGetField("short_description"));
        const desc = utils.cleanValue(servicenow.safeGetField("description"));
        const ci = utils.cleanValue(servicenow.getFirstExistingValue(CONFIG.CI_SELECTORS));
        const mail = templates.buildMail({ user, ticket, shortDesc, desc, ci });
        utils.log("User:", user);
        utils.log("Mail:", mail);
        utils.log("Debug fields:", {
          number: servicenow.safeGetField("number"),
          short_description: servicenow.safeGetField("short_description"),
          description: servicenow.safeGetField("description"),
          cmdb_ci: servicenow.getFirstExistingValue(CONFIG.CI_SELECTORS),
          detected_type: mail.type
        });
        ui.openMailto(mail.mailto);
      } catch (err) {
        utils.log("Run failed:", err);
      }
    };
    core.init = () => {
      if (ui && typeof ui.purgeToasts === "function") ui.purgeToasts();
      ui.injectMainButton(core.run);
    };
  })();

  // entry.js
  (function() {
    const ns = window.__SN_SMART_EMAIL__;
    if (!ns || !ns.core || typeof ns.core.init !== "function") {
      console.error("[SN Smart Email] core.init not found");
      return;
    }
    ns.core.init();
  })();
})();
