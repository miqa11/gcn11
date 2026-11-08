/* Keep notices and controls in document flow so translated text cannot overlap buttons. */
(function () {
  const world = document.querySelector('.city-world');
  const stack = document.createElement('div');
  stack.className = 'city-hud-stack';
  for (const id of ['gardenWayfinder', 'cityToast', 'carInvitation', 'carMessages', 'cityQuickActions', 'cityActivityHud']) {
    const element = document.getElementById(id);
    if (element) stack.append(element);
  }
  world.append(stack);
  const context = document.createElement('div');
  context.className = 'city-context-actions';
  context.append(document.getElementById('vehicleHud'), document.getElementById('gardenControls'));
  const bottom = document.createElement('div');
  bottom.className = 'city-bottom-hud';
  bottom.append(document.getElementById('cityStamina'), context, document.getElementById('interiorExit'));
  world.append(bottom);
  // Size the reserved input area from actual controls, including rotation and safe areas.
  let frame = 0;
  function measure() {
    frame = 0;
    const bounds = world.getBoundingClientRect();
    const inputs = [document.getElementById('touchControls'), document.querySelector('.city-fire-control')];
    const tops = inputs.filter(e => e && e.getClientRects().length && !e.hidden).map(e => e.getBoundingClientRect().top);
    world.style.setProperty('--city-input-reserve', Math.ceil(tops.length ? bounds.bottom - Math.min(...tops) + 12 : 90) + 'px');
    world.style.setProperty('--city-bottom-height', Math.ceil(bottom.getBoundingClientRect().height) + 'px');
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
  const observer = new ResizeObserver(schedule);
  for (const element of [world, bottom, document.getElementById('touchControls')]) if (element) observer.observe(element);
  new MutationObserver(() => { const fire = document.querySelector('.city-fire-control'); if (fire) observer.observe(fire); schedule(); }).observe(world, {childList:true});
  window.addEventListener('resize', schedule, {passive:true});
  window.visualViewport?.addEventListener('resize', schedule, {passive:true});
  schedule();
  const row = document.querySelector('.garden-actions');
  const choices = document.querySelector('.garden-dance-choices');
  row.append(choices, document.getElementById('gardenExpand'));
  document.getElementById('gardenExpand').setAttribute('aria-label', 'ცეკვისა და ბაღის პარამეტრები');
  document.getElementById('carMore').textContent = 'ადგილები · რადიო';
})();
