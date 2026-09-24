/* ╔══════════════════════════════════════════════════════════════════╗
   ║  MESSENGER ADAPTER                                                ║
   ║                                                                  ║
   ║  TG (telegram.js) now owns the chat list, the thread and every    ║
   ║  message-level feature. This file keeps the small pieces that     ║
   ║  sit outside it: the simulated peer reply for DMs, the sidebar    ║
   ║  unread pill, the attachment menu, and back-compatible shims for  ║
   ║  the handful of names the pane template still calls by hand.      ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

function allConversations() {
  return (typeof DATA !== 'undefined' && Array.isArray(DATA.conversations)) ? DATA.conversations : [];
}
function conversationById(id) {
  return allConversations().find(c => String(c.id) === String(id));
}

/* Sidebar pill showing total unread across every conversation. */
function updateUnreadBadge() {
  const badge = $id('msg-badge');
  if (!badge) return;
  const total = allConversations().reduce((s, c) => s + (c.unread || 0), 0);
  badge.textContent = total;
  badge.style.display = total ? '' : 'none';
}

/* ── Simulated peer reply ────────────────────────────────────────────
   Only DMs and groups answer back; channels broadcast and community
   rooms have their own responder inside CH. */
function replyBack() {
  if (typeof TG === 'undefined') return;
  const c = TG.activeChat();
  if (!c || c.src !== 'convo' || c.kind === 'channels') return;

  const chatId = c.raw.id;
  S.peerTyping = chatId;
  TG.paintThread();

  const arr = (DATA.chatHistory || {})[chatId] || [];
  let lastSaid = '';
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i].me && !arr[i].fi) { lastSaid = arr[i].text; break; }

  setTimeout(() => {
    S.peerTyping = null;
    const pool = (typeof DATA !== 'undefined' && Array.isArray(DATA.aiResponses) && DATA.aiResponses.length)
      ? DATA.aiResponses
      : ['Got it 👍', 'Interesting — tell me more.', 'Makes sense!', 'Let me get back to you on that.'];
    const reply = (typeof CFI !== 'undefined' && CFI.isBot(chatId))
      ? CFI.botReply(lastSaid)
      : pool[Math.floor(Math.random() * pool.length)];

    DATA.chatHistory[chatId] = DATA.chatHistory[chatId] || [];
    DATA.chatHistory[chatId].push({ me: false, text: reply, time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), ts: Date.now() });

    const convo = conversationById(chatId);
    if (convo) { convo.preview = reply; convo.time = 'now'; }
    TG.paintAll();
  }, 1400);
}

/* ── Composer extras ─────────────────────────────────────────────── */
function toggleAttachmentMenu() {
  const menu = $id('chat-attach-menu');
  if (!menu) return;
  menu.classList.toggle('hidden');
  const emoji = $id('chat-emoji-menu');
  if (emoji) emoji.classList.add('hidden');
}

function closeChatAttach() {
  const menu = $id('chat-attach-menu');
  if (menu) menu.classList.add('hidden');
}

function sendMockAttachment(kind) {
  const menu = $id('chat-attach-menu');
  if (menu) menu.classList.add('hidden');
  const label = { image: '📷 Photo', document: '📄 Document', location: '📍 Location' }[kind] || '📎 Attachment';
  TG.send(label);
}

/* The crypto sheet needs a numeric conversation id, so it only opens on
   the DM/group side — community rooms have their own crypto surface. */
function openChatCrypto(kind) {
  const menu = $id('chat-attach-menu');
  if (menu) menu.classList.add('hidden');
  if (typeof CFI === 'undefined' || typeof TG === 'undefined') { showToast('Crypto tools unavailable.'); return; }
  const c = TG.activeChat();
  if (!c || c.src !== 'convo') { showToast('Open a direct chat or group to send crypto.'); return; }
  S.activeChatId = c.raw.id;
  CFI.open(kind || 'send');
}

/* The timer button in the chat header. It used to flip a flag that no
   code ever read, while promising messages would vanish after 5s. It now
   opens the per-chat timer on the details page, which does what it says. */
function toggleDisappearingMessages() {
  if (window.CI && CI.openVanish) { CI.openVanish(); return; }
  S.disappearingMessages = !S.disappearingMessages;
  showToast(S.disappearingMessages
    ? '⏳ Disappearing messages on — your messages vanish after 5s'
    : '⏳ Disappearing messages off');
}

/* Enter in "Search or ask ALINA": a matching chat opens; otherwise the
   words go to ALINA, the assistant chat, which answers on this device. */
function searchEnter(value) {
  const q = String(value || '').trim();
  if (!q || typeof TG === 'undefined') return;
  const hit = TG.visibleChats()[0];
  if (hit && TG.state.search) { TG.open(hit.key); return; }
  askAlina(q);
}

function askAlina(value) {
  const q = String(value || '').trim();
  if (!q || typeof TG === 'undefined') return;
  const alina = allConversations().find(c => c.type === 'bots' && /alina/i.test(c.name));
  if (!alina) { showToast('ALINA is not available right now.'); return; }
  const inp = $id('msgr-search-input');
  if (inp) inp.value = '';
  TG.setSearch('');
  TG.open('c:' + alina.id);
  TG.send(q);
}

function msgrBack() {
  const root = $id('msgr-root');
  if (root) root.classList.remove('show-chat');
}

/* ── Boot ────────────────────────────────────────────────────────── */
function setupMessages() {
  if (!$id('chat-list')) return;
  if (typeof TG === 'undefined') return;
  TG.setup();
}

/* ── Back-compatible shims ───────────────────────────────────────── */
/* Older call sites still reach for these names; route them to TG so
   nothing has to know the chat list changed owners. */
function renderConversations() { if (typeof TG !== 'undefined') TG.paintList(); }
function renderChatMessages() { if (typeof TG !== 'undefined') TG.paintThread(); }
function openChat(id) { if (typeof TG !== 'undefined') TG.open('c:' + id); }
function sendChatMessage(preset) { if (typeof TG !== 'undefined') TG.send(preset); }
function filterChats(type) { if (typeof TG !== 'undefined') TG.setFolder(type === 'all' ? 'all' : type); }
function searchChats(v) { if (typeof TG !== 'undefined') TG.setSearch(v); }

window.setupMessages = setupMessages;
window.renderConversations = renderConversations;
window.renderChatMessages = renderChatMessages;
window.openChat = openChat;
window.sendChatMessage = sendChatMessage;
window.filterChats = filterChats;
window.searchChats = searchChats;
window.msgrBack = msgrBack;
window.searchEnter = searchEnter;
window.askAlina = askAlina;
window.replyBack = replyBack;
window.toggleAttachmentMenu = toggleAttachmentMenu;
window.openChatCrypto = openChatCrypto;
window.sendMockAttachment = sendMockAttachment;
window.toggleDisappearingMessages = toggleDisappearingMessages;
window.updateUnreadBadge = updateUnreadBadge;

/* ── Global bridge ───────────────────────────────────────────────────
   This file is an ES module now, so its top-level names are private
   to it. Inline onclick= handlers and every other module still look
   them up on the global object, so they are republished here.

   Each one is a thunk because the list is produced by scanning, and
   scanning over-collects — a line inside a template literal can look
   like a declaration. publish() calls each thunk and skips the ones
   that do not resolve, so a phantom costs one caught error and not a
   dead module graph. */
import { publish } from '../globals.js?v=3';
publish('pages/messenger.js', {
  allConversations: () => allConversations,
  conversationById: () => conversationById,
  updateUnreadBadge: () => updateUnreadBadge, replyBack: () => replyBack,
  toggleAttachmentMenu: () => toggleAttachmentMenu,
  closeChatAttach: () => closeChatAttach,
  sendMockAttachment: () => sendMockAttachment,
  openChatCrypto: () => openChatCrypto,
  toggleDisappearingMessages: () => toggleDisappearingMessages,
  searchEnter: () => searchEnter, askAlina: () => askAlina,
  msgrBack: () => msgrBack, setupMessages: () => setupMessages,
  renderConversations: () => renderConversations,
  renderChatMessages: () => renderChatMessages, openChat: () => openChat,
  sendChatMessage: () => sendChatMessage, filterChats: () => filterChats,
  searchChats: () => searchChats
});
