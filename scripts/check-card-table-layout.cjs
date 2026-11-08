// Optional browser QA: real page renderers and controls, controlled socket room snapshots.
// Requires Playwright, Express and Socket.IO. No production accounts or coin balances are used.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict'), express = require('express');
const { Server } = require('socket.io'), { chromium } = require('playwright');
const repo = path.resolve(__dirname, '..');
const baseline = process.env.CARD_QA_BASELINE === '1';
const output = process.env.CARD_QA_OUTPUT || path.join(require('node:os').tmpdir(), 'gaicani-card-tables');
const names = ['ნიკა', 'მარიამი', 'გიორგი', 'თაკო', 'ლუკა', 'ანა'];
const players = n => names.slice(0, n).map((username, i) => ({ username, avatar: `avatar${i + 1}.png`, seat: i, seatIndex: i, stack: 24500 - i * 750, connected: true, handCount: 9 }));
const poker = () => ({ roomId: 'qa-poker', hostUsername: names[0], status: 'playing', stage: 'river', pot: 6250, currentBet: 250, minRaise: 250, dealerSeatIndex: 2, actingSeatIndex: 0, actionDeadline: Date.now() + 25000, communityCards: ['Ah', 'Ks', 'Tc', '7d', '2h'], players: players(6).map((p, i) => ({ ...p, hasCards: true, folded: false, allIn: false, currentBet: i === 0 ? 0 : 250, ...(i === 0 ? { holeCards: ['Qh', 'Jh'] } : {}) })) });
const joker = () => ({ roomId: 'qa-joker', hostUsername: names[0], status: 'playing', phase: 'playing', mySeat: 0, handIndex: 5, setIdx: 1, handSize: 9, dealerSeat: 2, turnSeat: 0, bids: [3, 2, 1, 3], tricksWon: [1, 1, 0, 0], totals: [460, 390, 280, 420], myHand: ['Ah', 'Kh', 'Qd', 'Js', 'Tc', '9d', '8s', 'JK1', 'JK2'], currentTrick: [{ seat: 1, card: '6h' }, { seat: 2, card: 'Th' }, { seat: 3, card: '8h' }], ledSuit: 'h', trumpCard: 'Ac', trumpSuit: 'c', trickLeader: 1, actionDeadline: Date.now() + 25000, players: players(4), bidOrder: [0, 1, 2, 3], bidTurnIdx: 0 });
const blackjack = () => ({ roomId: 'qa-blackjack', hostUsername: names[0], status: 'playing', phase: 'playing', turnSeat: 0, turnHandIdx: 0, dealerCards: ['As'], dealerHoleRevealed: false, actionDeadline: Date.now() + 25000, players: players(5).map((p, i) => ({ ...p, hasBet: true, hands: [{ cards: i === 0 ? ['8h', '8s'] : [['Qd', '7c'], ['Ac', 'Th'], ['3c', '5h', '9s'], ['Kh', '6d']][i - 1], bet: 500, status: 'playing' }] })) });
const factories = { poker, joker, blackjack };
const screens = { poker: '#tableScreen', joker: '#gameScreen', blackjack: '#tableScreen' };
const pause = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const app = express(), server = http.createServer(app), io = new Server(server), emitted = [], errors = [];
  app.use(express.json());
  app.use('/api', (_q, res) => res.json({ success: true, username: names[0], coins: 24500 }));
  if (baseline) app.get('/:game.html', (q, res, next) => {
    if (!factories[q.params.game]) return next();
    res.type('html').send(require('node:child_process').execFileSync('git', ['show', `HEAD:${q.params.game}.html`], { cwd: repo, encoding: 'utf8' }));
  });
  require(path.join(repo, 'server-assets')).mountAssets(app, { root: repo });
  app.use(express.static(repo));
  io.on('connection', s => {
    s.onAny((event, data) => emitted.push({ event, data }));
    const auth = () => s.emit('auth:authenticated', { username: names[0], isGuest: false });
    s.on('auth:token', auth); s.on('auth:guest', auth);
    s.on('users:listOnline', () => s.emit('users:onlineList', { users: players(6) }));
    for (const game of Object.keys(factories)) {
      s.on(`${game}:join`, () => s.emit(`${game}:room`, factories[game]()));
      s.on(`${game}:listPublicRooms`, () => s.emit(`${game}:publicRooms`, []));
    }
    s.on('poker:getBalance', () => s.emit('poker:balance', { coins: 24500 }));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CITY_QA_CHROME || undefined, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, hasTouch: true });
    await context.addInitScript(() => { localStorage.setItem('gaicani_auth_token', 'qa-card-tables'); localStorage.setItem('gaicani_auth_user', 'ნიკა'); });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    async function room(game, data) { io.emit(`${game}:room`, data); await pause(1400); }
    async function capture(game, label) { await page.screenshot({ path: path.join(output, `${baseline ? 'before-' : ''}${game}-${label}.png`) }); }
    async function checkBounds(selectors, label) {
      const result = await page.evaluate(selectors => {
        const boxes = selectors.flatMap(selector => [...document.querySelectorAll(selector)].filter(e => e.getClientRects().length && getComputedStyle(e).display !== 'none').map(e => {
          const r = e.getBoundingClientRect(); return { selector, x: r.x, y: r.y, right: r.right, bottom: r.bottom, w: r.width, h: r.height };
        }));
        return { boxes, w: innerWidth, h: innerHeight, scroll: document.documentElement.scrollWidth };
      }, selectors);
      for (const b of result.boxes) assert(b.x >= -1 && b.y >= -1 && b.right <= result.w + 1 && b.bottom <= result.h + 1 && b.w > 0 && b.h > 0, `${label}: out of viewport ${JSON.stringify(b)}`);
      assert(result.scroll <= result.w, `${label}: horizontal page overflow`);
    }
    async function noOverlap(a, b, label) {
      const ar = await page.locator(a).first().boundingBox(), br = await page.locator(b).first().boundingBox();
      assert(ar && br, label + ': missing element');
      assert(ar.x + ar.width <= br.x + 1 || br.x + br.width <= ar.x + 1 || ar.y + ar.height <= br.y + 1 || br.y + br.height <= ar.y + 1, label + ': elements overlap');
    }
    for (const game of Object.keys(factories).filter(g => !process.env.CARD_QA_GAMES || process.env.CARD_QA_GAMES.split(',').includes(g))) {
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto(`${base}/${game}.html?room=qa-${game}`);
      await page.locator(screens[game] + '.visible').waitFor();
      await pause(1600);
      await capture(game, 'desktop');
      if (!baseline) {
        assert(await page.locator('.gc-deck-face').count() > 0, game + ': deck artwork missing');
        const motion = factories[game]();
        let moving;
        if (game === 'poker') {
          motion.communityCards.pop();
          motion.players[1].holeCards = ['3c', '3d'];
          moving = '.pk-opp-cardback-row.revealed [data-table-card]';
        } else if (game === 'joker') {
          motion.myHand.shift();
          motion.currentTrick.push({ seat: 0, card: 'Ah' });
          moving = '.slot-bottom [data-table-card]';
        } else {
          motion.dealerCards.push('7s');
          motion.dealerHoleRevealed = true;
          moving = '#dealerCards [data-table-face="7s"]';
        }
        io.emit(`${game}:room`, motion);
        await page.waitForFunction(selector => [...document.querySelectorAll(selector)].some(el => el.getAnimations().length), moving);
        await page.waitForFunction(() => !document.querySelector('[data-table-face][inert]'));
        await page.emulateMedia({ reducedMotion: 'reduce' });
        io.emit(`${game}:room`, factories[game]());
        await page.locator(moving).first().waitFor({state:'detached'});
        assert.equal(await page.locator('[data-table-card]').evaluateAll(cards => cards.flatMap(card => card.getAnimations()).length), 0);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        if (game === 'poker') for (const [button, action] of [['#foldBtn', 'fold'], ['#checkCallBtn', 'call'], ['#raiseBtn', 'raise'], ['#allinBtn', 'allin']]) {
          await page.click(button); await pause(50); assert(emitted.some(e => e.event === 'poker:action' && e.data.action === action), 'poker control ' + action);
        }
        if (game === 'blackjack') for (const action of ['hit', 'stand', 'double', 'split']) {
          await page.click(`#${action}Btn`); await pause(50); assert(emitted.some(e => e.event === 'blackjack:action' && e.data.action === action), 'blackjack control ' + action);
        }
        if (game === 'joker') {
          const before = emitted.filter(e => e.event === 'joker:playCard').length;
          await page.locator('.jk-hand-card.illegal').first().click(); await pause(50);
          assert.equal(emitted.filter(e => e.event === 'joker:playCard').length, before, 'illegal joker move emitted');
          await page.locator('.jk-hand-card[aria-label="ტუზი გული"]').click(); await pause(50);
          assert(emitted.some(e => e.event === 'joker:playCard' && e.data.card === 'Ah'), 'legal joker move');
        }
      }
      for (const [width, height] of [[844, 390], [667, 375], [568, 320], [390, 844], [320, 568]]) {
        await page.setViewportSize({ width, height }); await pause(650);
        await room(game, factories[game]());
        await capture(game, `${width}x${height}`);
        if (baseline) continue;
        if (game === 'poker') {
          await checkBounds(['.pk-community-cards', '#myCards', '#foldBtn', '#checkCallBtn', '#raiseBtn', '#allinBtn', '#raiseSlider', '.pk-opp-avatar'], `poker ${width}x${height}`);
          await noOverlap('.pk-table-body', '#actionBar', 'poker table/actions');
          await noOverlap('#myCards', '#communityCards', 'poker own/community');
          await noOverlap('#centerPot', '#communityCards', 'poker pot/community');
          const waiting = poker(); waiting.actingSeatIndex = 1; await room(game, waiting);
          assert(await page.locator('#foldBtn').isDisabled(), 'waiting poker controls enabled');
          await checkBounds(['#foldBtn', '#checkCallBtn', '#raiseBtn', '#allinBtn'], 'waiting poker');
        } else if (game === 'joker') {
          await checkBounds(['#trumpChip', '#myHandEl', '.jk-hand-card', '.jk-opp-avatar', '#scoreboard', '.jk-trick-slot'], `joker ${width}x${height}`);
          await noOverlap('#oppTop', '.jk-trick-slot.slot-top', `joker top seat/trick ${width}x${height}`);
          await noOverlap('#scoreboard', '#oppLeft', `joker scores/left seat ${width}x${height}`);
          await noOverlap('#oppLeft', '.jk-trick-slot.slot-left', `joker left seat/trick ${width}x${height}`);
          await noOverlap('#oppRight', '.jk-trick-slot.slot-right', `joker right seat/trick ${width}x${height}`);
          await page.locator('.jk-hand-card[aria-label="ჯოკერი"]').first().click();
          await checkBounds(['#jokerHighBtn', '#jokerLowBtn'], 'joker choice modal');
          await page.click('#jokerHighBtn'); await pause(50);
          assert(emitted.some(e => e.event === 'joker:playCard' && e.data.card === 'JK1' && e.data.jokerChoice === 'high'), 'joker selection');
          const leading = joker(); leading.currentTrick = []; leading.ledSuit = null; await room(game, leading);
          await page.locator('.jk-hand-card[aria-label="ჯოკერი"]').first().click();
          await checkBounds(['#jokerHighBtn', '#jokerLowBtn', '.jk-suit-choice'], 'leading joker choices');
          await page.click('#jokerLowBtn'); await page.click('.jk-suit-choice[data-suit="h"]'); await pause(50);
          assert(emitted.some(e => e.event === 'joker:playCard' && e.data.jokerChoice === 'low' && e.data.declaredSuit === 'h'), 'leading joker suit selection');
          const bidding = joker(); Object.assign(bidding, { phase: 'bidding', bids: [null, 2, 1, 3] }); await room(game, bidding);
          await checkBounds(['.jk-bid-choice', '#bidTrumpCardSlot'], 'joker bidding');
          await capture(game, `bid-${width}x${height}`);
          await page.locator('.jk-bid-choice').filter({ hasText: /^3$/ }).click(); await pause(50);
          assert(emitted.some(e => e.event === 'joker:bid' && e.data.bid === 3), 'joker bidding control');
        } else {
          await checkBounds(['#dealerCards', '#hitBtn', '#standBtn', '#doubleBtn', '#splitBtn'], `blackjack ${width}x${height}`);
          await noOverlap('#tableBody', '#playPanel', 'blackjack table/actions');
          const bet = blackjack(); bet.phase = 'betting'; bet.dealerCards = []; bet.players.forEach(p => { p.hands = []; p.hasBet = false; }); await room(game, bet);
          await checkBounds(['.bj-bet-chip-btn', '#betSubmitBtn'], 'blackjack betting');
          await capture(game, `bet-${width}x${height}`);
          await page.locator('.bj-bet-chip-btn').first().click(); await page.click('#betSubmitBtn'); await pause(50);
          assert(emitted.some(e => e.event === 'blackjack:placeBet' && Number.isFinite(e.data.amount)), 'blackjack bet submit');
        }
      }
      if (!baseline) {
        await page.setViewportSize({ width: 844, height: 390 });
        await room(game, { ...factories[game](), status: 'lobby' });
        await checkBounds([game === 'poker' ? '#startTableBtn' : '#startGameBtn', '#lobbyLeaveBtn'], game + ' lobby controls');
        await capture(game, 'lobby-landscape');
        await page.click('#lobbyLeaveBtn'); await pause(200);
        await checkBounds([game === 'poker' ? '#createTableBtn' : '#createGameBtn'], game + ' setup');
        await capture(game, 'setup-landscape');
        await page.evaluate(() => localStorage.setItem('gaicani_site_theme', 'midnight'));
        await page.goto(`${base}/${game}.html?room=qa-${game}`);
        await page.locator(screens[game] + '.visible').waitFor();
        assert.equal(await page.locator('html').getAttribute('data-gc-theme'), null);
        await page.evaluate(() => localStorage.removeItem('gaicani_site_theme'));
        if (game === 'blackjack') {
          await page.setViewportSize({ width: 568, height: 320 });
          const split = blackjack(); split.dealerCards = ['As', '2h', '3c', '4d']; split.dealerHoleRevealed = true;
          split.players[0].hands = [{ cards: ['Ah', '2s', 'Ac', '3h', 'Ad', '2c', 'As'], bet: 500, status: 'playing' }, { cards: ['Th', 'Kd'], bet: 500, status: 'playing' }];
          await room(game, split); await capture(game, 'split-many-cards');
          await checkBounds(['#hitBtn', '#standBtn', '#dealerCards'], 'blackjack large hands');
          const head = await page.locator('.bj-seat.me .bj-seat-head').boundingBox(), table = await page.locator('#tableBody').boundingBox();
          assert(head.y >= table.y + 8, 'large hand clips its player header');
          await page.locator('.bj-seat.me .bj-hand-block').last().scrollIntoViewIfNeeded();
          await checkBounds(['.bj-seat.me .bj-hand-block:last-child'], 'blackjack split hand reachable');
          await page.locator('.bj-seat').last().scrollIntoViewIfNeeded();
          await checkBounds(['.bj-seat:last-child'], 'blackjack last player reachable');
        }
      }
    }
    assert.deepEqual(errors, [], 'browser JavaScript errors');
    console.log('PASS: card artwork, original action payloads, turn/legality gating, betting and joker choices; desktop, portrait and three landscape sizes. Screenshots: ' + output);
  } finally { await browser.close(); await new Promise(r => io.close(r)); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
