// Keep navigation available even when a browser cannot initialize the broadcast.
setTimeout(() => {
  if (document.documentElement.dataset.arcadeReady === 'true') return;
  const heading = document.querySelector('.arcade-loading h1');
  const detail = document.querySelector('.arcade-loading-copy p');
  if (heading) heading.textContent = 'The broadcast is taking longer.';
  if (detail) detail.textContent = 'Head back to the world and choose another game.';
}, 30000);
