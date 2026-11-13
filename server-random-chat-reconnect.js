"use strict";

function createRandomChatReconnect({ activeUsernames, graceMs, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const pending = new Map();

  function release(ghost) {
    const key = ghost.userName.toLowerCase();
    const entry = pending.get(key);
    if (entry?.ghost !== ghost) return;
    clearTimer(entry.timer);
    pending.delete(key);
    activeUsernames.delete(key);
    ghost._messageQueue = [];
  }

  function close(ghost) {
    const partner = ghost.partner;
    ghost.partner = null;
    release(ghost);
    if (!partner || partner.partner !== ghost) return;
    partner.partner = null;
    if (partner._isGhost) release(partner);
    else if (partner.isSupportAI) partner.disconnect();
    else if (partner.connected) {
      partner.emit("partnerDisconnected", { name: ghost.userName });
      partner.emit("music:stop");
    }
  }

  function park(socket) {
    const partner = socket.partner;
    if (!socket.userName || !partner || partner.partner !== socket) return false;
    socket._isGhost = true;
    socket._messageQueue = [];
    partner.lastPartnerName = socket.userName;
    partner.lastPartnerIP = socket.clientIP || "";
    partner.lastPartnerSocketId = socket.id;
    partner.hasReportedLast = false;
    const key = socket.userName.toLowerCase();
    const timer = setTimer(() => close(socket), graceMs);
    timer?.unref?.();
    pending.set(key, { ghost: socket, timer });
    if (partner.isSupportAI) partner.emit("partnerDisconnected", { name: socket.userName });
    else if (partner.connected) {
      partner.emit("partnerReconnecting", { name: socket.userName });
      partner.emit("partnerTyping", false);
    }
    return true;
  }

  function canResume(socket, key) {
    const ghost = pending.get(key)?.ghost;
    if (!ghost) return false;
    if (ghost._regUser && !ghost._regUser.isGuest) {
      return socket._regUser?.usernameLower === ghost._regUser.usernameLower && !socket._regUser.isGuest;
    }
    if (ghost._guestWalletKey) return ghost._guestWalletKey === socket._guestWalletKey;
    return !!ghost._did && ghost._did === socket._did;
  }

  function restore(socket, key) {
    if (!canResume(socket, key)) return false;
    const { ghost, timer } = pending.get(key);
    const partner = ghost.partner;
    if (!partner || partner.partner !== ghost || (!partner.connected && !partner._isGhost)) {
      close(ghost);
      return false;
    }
    clearTimer(timer);
    pending.delete(key);
    ghost.partner = null;
    socket.partner = partner;
    partner.partner = socket;
    socket._recvIds = ghost._recvIds;
    socket._reportSnapshot = ghost._reportSnapshot;
    socket.blockedNames = ghost.blockedNames;
    socket.blockedIds = ghost.blockedIds;
    socket.lastPartnerName = partner.userName;
    socket.lastPartnerIP = partner.clientIP || "";
    socket.lastPartnerSocketId = partner.id;
    socket.emit("partnerRestored", { name: partner.userName });
    if (partner.connected) partner.emit("partnerReconnected", { name: socket.userName });
    else socket.emit("partnerReconnecting", { name: partner.userName });
    for (const { event, data } of ghost._messageQueue) socket.emit(event, data);
    ghost._messageQueue = [];
    return true;
  }

  function deliver(socket, event, data) {
    const id = data.messageId;
    if (id && socket._recvIds?.includes(id)) return true;
    if (socket._isGhost) {
      if (socket._messageQueue.length >= 120) return false;
      socket._messageQueue.push({ event, data });
    } else if (socket.connected || socket.isSupportAI) socket.emit(event, data);
    else return false;
    if (id) {
      (socket._recvIds ??= []).push(id);
      if (socket._recvIds.length > 180) socket._recvIds.shift();
    }
    return true;
  }

  return { pending, release, park, restore, canResume, deliver };
}

module.exports = { createRandomChatReconnect };
