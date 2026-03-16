(() => {
  // utils.js
  (function () {
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
  (function () {
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
    servicenow.getFieldDisplayValue = (fieldName) => {
      const docs = servicenow.getAllDocs();
      const selectors = [
        `#sys_display\\.${fieldName.replace(/\./g, "\\.")}`,
        `#${fieldName.replace(/\./g, "\\.")}`,
        `input[id="sys_display.${fieldName}"]`,
        `input[id="${fieldName}"]`,
        `input[name="${fieldName}"]`,
        `textarea[id="${fieldName}"]`,
        `textarea[name="${fieldName}"]`
      ];
      for (const doc of docs) {
        for (const selector of selectors) {
          try {
            const el = doc.querySelector(selector);
            if (!el) continue;
            const value = utils.cleanValue(el.value || el.innerText || el.textContent || "");
            if (value) return value;
          } catch (e) {
          }
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
    servicenow.getUserFromForm = () => {
      const gf = servicenow.getBestGForm();
      const fieldCandidates = [
        "requested_for",
        "request.requested_for",
        "caller_id",
        "opened_for",
        "u_requested_for"
      ];
      const user = {
        firstName: "",
        lastName: "",
        email: ""
      };
      for (const fieldName of fieldCandidates) {
        try {
          if (!gf) continue;
          const displayValue = utils.cleanValue(gf.getDisplayValue && gf.getDisplayValue(fieldName)) || servicenow.getFieldDisplayValue(fieldName);
          if (displayValue && !user.firstName && !user.lastName) {
            const parts = displayValue.split(/\s+/).filter(Boolean);
            if (parts.length === 1) {
              user.firstName = parts[0];
            } else if (parts.length > 1) {
              user.firstName = parts[0];
              user.lastName = parts.slice(1).join(" ");
            }
          }
        } catch (e) {
        }
      }
      const emailCandidates = [
        "u_email",
        "email",
        "caller_id.email",
        "requested_for.email",
        "opened_for.email"
      ];
      for (const fieldName of emailCandidates) {
        try {
          const fromForm = utils.cleanValue(gf && gf.getValue && gf.getValue(fieldName)) || servicenow.getFieldDisplayValue(fieldName);
          if (fromForm && fromForm.includes("@")) {
            user.email = fromForm;
            break;
          }
        } catch (e) {
        }
      }
      return user;
    };
    servicenow.getUserFromSession = () => {
      try {
        const raw = sessionStorage.getItem(CONFIG.STORAGE_KEY);
        if (!raw) return null;
        const user = JSON.parse(raw);
        if (user && utils.cleanValue(user.email)) return user;
      } catch (e) {
      }
      return null;
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
    servicenow.getUserContext = async () => {
      try {
        const previewUser = await servicenow.getRequestedForFromPreview();
        if (utils.cleanValue(previewUser.email)) return previewUser;
      } catch (e) {
        utils.log("Preview-based user lookup unavailable, using fallback.", e);
      }
      const formUser = servicenow.getUserFromForm();
      if (utils.cleanValue(formUser.email)) {
        sessionStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(formUser));
        return formUser;
      }
      const sessionUser = servicenow.getUserFromSession();
      if (sessionUser) return sessionUser;
      return { firstName: "", lastName: "", email: "" };
    };
    servicenow.composeWorkNote = ({ user, mail, ticket }) => {
      const recipient = utils.cleanValue(user && user.email) || "the user";
      const lines = [
        `Email has sent for ${recipient}.`,
        `Ticket: ${utils.cleanValue(ticket) || "Ticket"}`,
        `Subject: ${utils.cleanValue(mail && mail.subject)}`,
        "",
        utils.cleanValue(mail && mail.body)
      ];
      return lines.filter((line, index) => line || index === 3).join("\n");
    };
    servicenow.setWorkNotesDraft = (text) => {
      const value = utils.cleanValue(text);
      if (!value) return false;
      const gf = servicenow.getBestGForm();
      try {
        if (gf && typeof gf.setValue === "function") {
          gf.setValue("work_notes", value);
          return true;
        }
      } catch (e) {
        utils.log("g_form.setValue(work_notes) failed", e);
      }
      const docs = servicenow.getAllDocs();
      const selectors = [
        "#activity-stream-work_notes-textarea",
        "#work_notes",
        'textarea[id="work_notes"]',
        'textarea[name="work_notes"]',
        'textarea[id*="work_notes"]'
      ];
      for (const doc of docs) {
        for (const selector of selectors) {
          try {
            const el = doc.querySelector(selector);
            if (!el) continue;
            el.value = value;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          } catch (e) {
          }
        }
      }
      return false;
    };
    servicenow.getShortDescription = () => {
      try {
        const fromGForm = servicenow.safeGetField("short_description");
        if (fromGForm) return fromGForm;
      } catch (e) {
      }
      return servicenow.getFirstExistingValue([
        "#sc_task\\.short_description",
        "#incident\\.short_description",
        "#ticket\\.short_description",
        "#short_description",
        'input[id="sc_task.short_description"]',
        'input[id="incident.short_description"]',
        'input[id="ticket.short_description"]',
        'input[name="short_description"]',
        'textarea[name="short_description"]'
      ]);
    };
  })();

  // templates.js
  (function () {
    const ns = window.__SN_SMART_EMAIL__ = window.__SN_SMART_EMAIL__ || {};
    const utils = ns.utils || {};
    const templates = ns.templates = ns.templates || {};
    const TICKET_PATTERNS = {
      incident: /^INC\d+$/i,
      ritm: /^RITM\d+$/i,
      sctask: /^SCTASK\d+$/i,
      req: /^REQ\d+$/i
    };
    const REQUEST_CATEGORY_RULES = [
      {
        type: "schedule_smartphone_delivery_closure",
        match: (text) => text.includes("schedule smartphone delivery, delivery and closure") || text.includes("schedule smartphone delivery") && text.includes("delivery and closure")
      },
      {
        type: "iphone_replacement",
        match: (text) => text.includes("iphone replacement") || text.includes("replacement plan")
      },
      {
        type: "smartphone",
        match: (text) => text.includes("smartphone") || text.includes("iphone") || text.includes("samsung")
      },
      {
        type: "headset",
        match: (text) => text.includes("headset")
      },
      {
        type: "token",
        match: (text) => text.includes("token") || text.includes("virtual token")
      },
      {
        type: "mdm",
        match: (text) => text.includes("mdm") || text.includes("mobile device management") || text.includes("intune")
      },
      {
        type: "collection",
        match: (text) => text.includes("collect") || text.includes("pickup") || text.includes("return old device")
      },
      {
        type: "laptop",
        match: (text) => text.includes("laptop") || text.includes("surface")
      }
    ];
    const INCIDENT_TEMPLATE_LIBRARY = {
      incident_acknowledgement: {
        label: "Incident Acknowledgement",
        subject: (ctx) => `Incident acknowledged - ${ctx.ticketLabel}`,
        body: (ctx) => `${ctx.salutation}

Thank you for contacting the IT Service Desk regarding the reported incident.

This message confirms that your incident has been received and is currently under review by our support team. An initial assessment is in progress, and we will continue with the appropriate troubleshooting steps.

${ctx.details}Should immediate action or additional coordination be required, we will contact you accordingly.

${ctx.signature}`
      },
      incident_follow_up: {
        label: "Incident Follow-up / Request for Information",
        subject: (ctx) => `Additional information required - ${ctx.ticketLabel}`,
        body: (ctx) => `${ctx.salutation}

We are following up on the reported incident and require a few additional details in order to continue the investigation efficiently.

${ctx.details}At your convenience, please share any relevant information such as the exact behaviour observed, the time of occurrence, screenshots, error messages, impacted users, or recent changes related to the issue.

Once this information is received, we will continue our analysis without delay.

${ctx.signature}`
      },
      incident_resolution_proposal: {
        label: "Incident Resolution Proposal",
        subject: (ctx) => `Proposed resolution for ${ctx.ticketLabel}`,
        body: (ctx) => `${ctx.salutation}

Following our review of the reported incident, we have identified a proposed resolution path.

${ctx.details}Based on the information currently available, we are ready to proceed with the corrective action or validation step required to restore normal service.

Please confirm whether we may proceed, or let us know if the issue has already been resolved from your side.

${ctx.signature}`
      },
      incident_closure_confirmation: {
        label: "Incident Closure Confirmation",
        subject: (ctx) => `Closure confirmation - ${ctx.ticketLabel}`,
        body: (ctx) => `${ctx.salutation}

We are contacting you to confirm whether the reported incident can now be considered resolved.

${ctx.details}If the service is operating as expected, we will proceed with the closure of the incident. If the issue persists, please reply with the current status so that we may continue our investigation.

Unless we receive further information indicating that support is still required, the ticket may be closed accordingly.

${ctx.signature}`
      },
      incident_generic: {
        label: "Generic Incident Communication",
        subject: (ctx) => `Incident update - ${ctx.ticketLabel}`,
        body: (ctx) => `${ctx.salutation}

We are contacting you regarding the reported incident.

${ctx.details}The case is being handled by the support team, and the current status remains under active review. We will provide further updates as soon as additional information becomes available.

If you have any relevant update in the meantime, please feel free to share it by replying to this message.

${ctx.signature}`
      }
    };
    function safeClean(value) {
      return typeof utils.cleanValue === "function" ? utils.cleanValue(value) : String(value || "").trim();
    }
    function safeNormalize(value) {
      if (typeof utils.normalize === "function") return utils.normalize(value);
      return safeClean(value).toLowerCase();
    }
    function joinParagraphs(parts) {
      return parts.filter(Boolean).join("\n\n");
    }
    function getTicketLabel(ticket) {
      return safeClean(ticket) || "Ticket";
    }
    function createContext({ user, ticket, shortDesc, desc, ci, device, ticketType, requestType }) {
      return {
        salutation: templates.buildSalutation(user),
        signature: templates.buildSignature(),
        details: templates.buildDetailsBlock({ device, ci, shortDesc, ticket }),
        ticketLabel: getTicketLabel(ticket),
        shortDesc: safeClean(shortDesc),
        desc: safeClean(desc),
        ci: safeClean(ci),
        device: safeClean(device),
        ticketType: safeClean(ticketType),
        requestType: safeClean(requestType)
      };
    }
    templates.buildSalutation = (user = {}) => {
      const firstName = safeClean(user.firstName);
      const lastName = safeClean(user.lastName);
      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
      if (fullName) return `Dear ${fullName},`;
      if (firstName) return `Dear ${firstName},`;
      return "Dear colleague,";
    };
    templates.buildSignature = () => "Kind regards,";
    templates.buildDetailsBlock = ({ device, ci, shortDesc, ticket }) => {
      const lines = [
        safeClean(ticket) ? `Ticket: ${safeClean(ticket)}` : "",
        safeClean(device) ? `Device: ${safeClean(device)}` : "",
        safeClean(ci) ? `Configuration item: ${safeClean(ci)}` : "",
        safeClean(shortDesc) ? `Subject: ${safeClean(shortDesc)}` : ""
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
    templates.detectTicketType = (ticket) => {
      const cleanTicket = safeClean(ticket).toUpperCase();
      if (TICKET_PATTERNS.incident.test(cleanTicket)) return "incident";
      if (TICKET_PATTERNS.ritm.test(cleanTicket)) return "ritm";
      if (TICKET_PATTERNS.sctask.test(cleanTicket)) return "sctask";
      if (TICKET_PATTERNS.req.test(cleanTicket)) return "req";
      return "generic";
    };
    templates.isIncidentTicket = (ticket) => templates.detectTicketType(ticket) === "incident";
    templates.detectRequestType = (text) => {
      const normalized = safeNormalize(text);
      for (const rule of REQUEST_CATEGORY_RULES) {
        if (rule.match(normalized)) return rule.type;
      }
      return "generic";
    };
    templates.detectType = (text, ticket) => {
      const ticketType = templates.detectTicketType(ticket);
      if (ticketType === "incident") return "incident_generic";
      return templates.detectRequestType(text);
    };
    templates.getCategoryFromShortDescription = (shortDesc) => {
      const value = safeNormalize(shortDesc);
      if (value === "any other request related to outlook email and calendar") {
        return "outlook_calendar";
      }
      if (value.includes("outlook") || value.includes("calendar")) {
        return "outlook_calendar";
      }
      return "default";
    };
    templates.buildSuggestedTemplate = (templateId, ctx) => {
      const template = INCIDENT_TEMPLATE_LIBRARY[templateId];
      if (!template) return null;
      return {
        id: templateId,
        label: template.label,
        subject: safeClean(template.subject(ctx)),
        body: safeClean(template.body(ctx))
      };
    };
    templates.getSuggestedTemplates = ({ user, ticket, shortDesc, desc, ci, device, ticketType }) => {
      const ctx = createContext({
        user,
        ticket,
        shortDesc,
        desc,
        ci,
        device,
        ticketType,
        requestType: templates.detectRequestType(`${safeClean(shortDesc)} ${safeClean(desc)} ${safeClean(ci)}`)
      });
      const category = templates.getCategoryFromShortDescription(shortDesc);
      const suggestions = [];
      if (category === "outlook_calendar") {
        suggestions.push(
          {
            id: "outlook_calendar_generic",
            label: "Generic Outlook / Calendar Request",
            subject: `Outlook and calendar service request - ${ctx.ticketLabel}`,
            body: joinParagraphs([
              ctx.salutation,
              "We are contacting you regarding your request related to Outlook email and calendar services.",
              "Your request has been received and is currently under review by the support team.",
              `${ctx.details}If any clarification, approval, or additional detail is required, we will contact you accordingly.`,
              ctx.signature
            ])
          },
          {
            id: "outlook_distribution_list",
            label: "Distribution List / Mail Group Request",
            subject: `Distribution list request - ${ctx.ticketLabel}`,
            body: joinParagraphs([
              ctx.salutation,
              "We are contacting you regarding your request related to a distribution list or mail-enabled group.",
              "The request is currently being reviewed so that the required change can be processed accurately and in line with the defined access model.",
              `${ctx.details}If needed, we may contact you to confirm the list name, requested action, ownership, or target recipients.`,
              ctx.signature
            ])
          },
          {
            id: "outlook_shared_mailbox_access",
            label: "Shared Mailbox / Access / Delegation Request",
            subject: `Shared mailbox or delegation request - ${ctx.ticketLabel}`,
            body: joinParagraphs([
              ctx.salutation,
              "We are contacting you regarding your request for shared mailbox access, mailbox delegation, or calendar permission changes.",
              "The request has been received and is currently under assessment by the support team.",
              `${ctx.details}If required, we may follow up to confirm the mailbox name, requested permission level, approver, or business justification.`,
              ctx.signature
            ])
          }
        );
      }
      if (ticketType === "incident") {
        Object.keys(INCIDENT_TEMPLATE_LIBRARY).forEach((templateId) => {
          const template = templates.buildSuggestedTemplate(templateId, ctx);
          if (template) suggestions.push(template);
        });
      }
      return suggestions;
    };
    templates.emailTemplate = (type, device, ci, user, ticket, shortDesc, desc, ticketType) => {
      const ctx = createContext({
        user,
        ticket,
        shortDesc,
        desc,
        ci,
        device,
        ticketType,
        requestType: type
      });
      if (ticketType === "incident") {
        return templates.buildSuggestedTemplate("incident_generic", ctx);
      }
      const map = {
        schedule_smartphone_delivery_closure: () => ({
          subject: `Corporate smartphone handover scheduling - ${ctx.ticketLabel}`,
          body: joinParagraphs([
            ctx.salutation,
            `We are contacting you regarding the handover of your corporate smartphone${ctx.device ? ` (${ctx.device})` : ""}.`,
            "The device is prepared and ready for delivery. To complete the fulfilment process and close the related activity, we kindly ask you to confirm your availability.",
            ctx.details + "Once your availability is confirmed, we will arrange the handover accordingly.",
            ctx.signature
          ])
        }),
        iphone_replacement: () => ({
          subject: `iPhone replacement coordination - ${ctx.ticketLabel}`,
          body: joinParagraphs([
            ctx.salutation,
            `We are contacting you regarding your corporate smartphone replacement${ctx.device ? ` (${ctx.device})` : ""}.`,
            "The replacement device is ready, and the request can proceed to the delivery stage.",
            ctx.details + "Please share your availability so that we may coordinate the handover and complete the related request.",
            ctx.signature
          ])
        }),
        smartphone: () => ({
          subject: `Corporate smartphone request update - ${ctx.ticketLabel}`,
          body: joinParagraphs([
            ctx.salutation,
            `We are contacting you regarding your corporate smartphone request${ctx.device ? ` (${ctx.device})` : ""}.`,
            "The required action is ready to move forward.",
            ctx.details + "Please let us know your availability so that we may arrange the handover or next operational step.",
            ctx.signature
          ])
        }),
        laptop: () => ({
          subject: `Corporate laptop request update - ${ctx.ticketLabel}`,
          body: joinParagraphs([
            ctx.salutation,
            `We are contacting you regarding your corporate laptop request${ctx.device ? ` (${ctx.device})` : ""}.`,
            "The device is prepared and ready for the next fulfilment step.",
            ctx.details + "Please confirm your availability so that we may arrange the handover.",
            ctx.signature
          ])
        }),
        headset: () => ({
          subject: `Headset request update - ${ctx.ticketLabel}`,
          body: joinParagraphs([
            ctx.salutation,
            "We are contacting you regarding your headset request.",
            "The equipment is available and ready for handover or collection.",
            ctx.details + "Please let us know your availability so that we may coordinate the next step.",
            ctx.signature
          ])
        }),
        token: () => ({
          subject: `Authentication token support - ${ctx.ticketLabel}`,
          body: joinParagraphs([
            ctx.salutation,
            "We are contacting you regarding the setup or activation of your authentication token.",
            "The support team is ready to assist with the required configuration and validation steps.",
            "Please let us know your availability so that we may continue.",
            ctx.signature
          ])
        }),
        mdm: () => ({
          subject: `Mobile device management request - ${ctx.ticketLabel}`,
          body: joinParagraphs([
            ctx.salutation,
            `We are contacting you regarding the Mobile Device Management configuration of your device${ctx.device ? ` (${ctx.device})` : ""}.`,
            "The request is ready to proceed with the required configuration actions.",
            ctx.details + "Please let us know your availability so that we may continue.",
            ctx.signature
          ])
        }),
        collection: () => ({
          subject: `Previous device collection - ${ctx.ticketLabel}`,
          body: joinParagraphs([
            ctx.salutation,
            "We would like to coordinate the collection of the previous device related to your request.",
            ctx.details + "Please let us know your availability so that we may organise the pickup or handover.",
            ctx.signature
          ])
        }),
        generic: () => ({
          subject: `IT service request follow-up - ${ctx.ticketLabel}`,
          body: joinParagraphs([
            ctx.salutation,
            "We are contacting you regarding your IT service request.",
            ctx.details + "Please share any additional information or confirmation required so that we may proceed with the next step.",
            ctx.signature
          ])
        })
      };
      return (map[type] || map.generic)();
    };
    templates.buildMail = ({ user, ticket, shortDesc, desc, ci }) => {
      const fullText = `${safeClean(shortDesc)} ${safeClean(desc)} ${safeClean(ci)}`;
      const device = safeClean(templates.detectDevice(fullText, ci));
      const ticketType = templates.detectTicketType(ticket);
      const type = safeClean(templates.detectType(fullText, ticket)) || "generic";
      const mail = templates.emailTemplate(type, device, ci, user, ticket, shortDesc, desc, ticketType);
      const recipient = safeClean(user && user.email);
      return {
        ...mail,
        type,
        ticketType,
        device,
        ci: safeClean(ci),
        shortDesc: safeClean(shortDesc),
        desc: safeClean(desc),
        ticket: getTicketLabel(ticket),
        suggestedTemplates: templates.getSuggestedTemplates({
          user,
          ticket,
          shortDesc,
          desc,
          ci,
          device,
          ticketType
        }),
        mailto: `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(safeClean(mail.subject))}&body=${encodeURIComponent(safeClean(mail.body))}`
      };
    };
  })();

  // ui.js
  (function () {
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
    const UI_CLOSE_BUTTON_ID = "sn-smart-email-close-btn";
    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }
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
      if (container && container.dataset && container.dataset.dragged === "true") return;
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
    function makeContainerDraggable(container) {
      if (!container || container.__snSmartEmailDragBound) return;
      container.__snSmartEmailDragBound = true;
      const onPointerDown = (event) => {
        const target = event.target;
        if (!target || target.closest(`button[id="${UI_CLOSE_BUTTON_ID}"]`)) return;
        if (target.tagName !== "BUTTON" && !target.closest("button")) return;
        const doc = container.ownerDocument || document;
        const w = doc.defaultView || window;
        const rect = container.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;
        container.dataset.dragged = "true";
        container.style.right = "auto";
        container.style.bottom = "auto";
        container.style.left = `${rect.left}px`;
        container.style.top = `${rect.top}px`;
        container.style.cursor = "grabbing";
        const onPointerMove = (moveEvent) => {
          const maxLeft = Math.max((w.innerWidth || 0) - rect.width - 8, 8);
          const maxTop = Math.max((w.innerHeight || 0) - rect.height - 8, 8);
          const nextLeft = clamp(moveEvent.clientX - offsetX, 8, maxLeft);
          const nextTop = clamp(moveEvent.clientY - offsetY, 8, maxTop);
          container.style.left = `${nextLeft}px`;
          container.style.top = `${nextTop}px`;
        };
        const stopDragging = () => {
          container.style.cursor = "grab";
          w.removeEventListener("pointermove", onPointerMove);
          w.removeEventListener("pointerup", stopDragging);
        };
        w.addEventListener("pointermove", onPointerMove);
        w.addEventListener("pointerup", stopDragging);
      };
      container.style.cursor = "grab";
      container.addEventListener("pointerdown", onPointerDown);
    }
    function ensureCloseButton(container) {
      const doc = container.ownerDocument || document;
      let button = doc.getElementById(UI_CLOSE_BUTTON_ID);
      if (button) return button;
      button = doc.createElement("button");
      button.id = UI_CLOSE_BUTTON_ID;
      button.type = "button";
      button.textContent = "X";
      button.setAttribute("aria-label", "Close smart email controls");
      Object.assign(button.style, {
        background: "#fff1f2",
        color: "#b42318",
        border: "1px solid #fda29b",
        width: "28px",
        height: "28px",
        padding: "0",
        borderRadius: "999px",
        cursor: "pointer",
        boxShadow: "0 2px 8px rgba(0,0,0,.08)",
        fontSize: "12px",
        fontWeight: "700",
        lineHeight: "1",
        fontFamily: "Arial, sans-serif"
      });
      button.addEventListener("click", () => {
        container.remove();
      });
      container.appendChild(button);
      return button;
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
      ensureCloseButton(container);
      makeContainerDraggable(container);
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
    ui.closeControls = () => {
      for (const doc of getAllDocs()) {
        try {
          const container = doc.getElementById(UI_CONTAINER_ID);
          if (container) container.remove();
        } catch (e) {
        }
      }
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
      btn.addEventListener("click", function () {
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
      container.insertBefore(b, ensureCloseButton(container));
    };
  })();

  // core.js
  (function () {
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
        const user = await servicenow.getUserContext();
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
        const workNoteDraft = servicenow.composeWorkNote({ user, mail, ticket });
        const workNotesPrepared = servicenow.setWorkNotesDraft(workNoteDraft);
        utils.log("Work notes prepared:", workNotesPrepared);
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
  (function () {
    const ns = window.__SN_SMART_EMAIL__;
    if (!ns || !ns.core || typeof ns.core.init !== "function") {
      console.error("[SN Smart Email] core.init not found");
      return;
    }
    ns.core.init();
  })();
})();
