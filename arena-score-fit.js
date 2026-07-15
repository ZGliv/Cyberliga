(function (global) {
  'use strict';

  const SELECTOR = '[data-score-fit]';
  const READOUT_SELECTOR = '.arena-score-readout';
  const EPSILON = 0.75;
  let scheduled = false;
  let resizeObserver = null;
  let observedElements = new Set();

  function cssNumber(style, name, fallback) {
    const value = Number.parseFloat(style.getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  }

  function fits(element) {
    const verticalRoom = element.parentElement?.clientHeight || element.clientHeight;
    return element.scrollWidth <= element.clientWidth + EPSILON
      && element.scrollHeight <= verticalRoom + 1;
  }

  function setMetrics(element, size, tracking) {
    element.style.fontSize = `${size.toFixed(2)}px`;
    element.style.letterSpacing = `${tracking.toFixed(2)}px`;
  }

  function fitElement(element) {
    if (!(element instanceof HTMLElement) || !element.isConnected) return null;
    if (element.getClientRects().length === 0) {
      element.dataset.scoreFitHidden = 'true';
      delete element.dataset.scoreFitOverflow;
      return null;
    }

    const style = getComputedStyle(element);
    const maxSize = Math.max(1, cssNumber(style, '--score-fit-max', Number.parseFloat(style.fontSize) || 14));
    const preferredMin = Math.min(maxSize, Math.max(1, cssNumber(style, '--score-fit-min', 8)));
    const floor = Math.min(preferredMin, Math.max(1, cssNumber(style, '--score-fit-floor', 5.75)));
    const maxTracking = cssNumber(style, '--score-fit-tracking', Number.parseFloat(style.letterSpacing) || 0);
    const minTracking = Math.min(maxTracking, cssNumber(style, '--score-fit-min-tracking', Math.min(0, maxTracking)));
    const trackingAt = (size) => {
      if (maxSize <= preferredMin || size <= preferredMin) return minTracking;
      const mix = (size - preferredMin) / (maxSize - preferredMin);
      return minTracking + (maxTracking - minTracking) * mix;
    };

    setMetrics(element, maxSize, maxTracking);
    let chosen = maxSize;
    if (!fits(element)) {
      let low = floor;
      let high = maxSize;
      setMetrics(element, low, trackingAt(low));
      if (fits(element)) {
        for (let pass = 0; pass < 12; pass += 1) {
          const candidate = (low + high) / 2;
          setMetrics(element, candidate, trackingAt(candidate));
          if (fits(element)) low = candidate;
          else high = candidate;
        }
        chosen = low;
        setMetrics(element, chosen, trackingAt(chosen));
      } else {
        chosen = floor;
      }
    }

    const overflow = !fits(element);
    element.dataset.scoreFitSize = chosen.toFixed(2);
    element.dataset.scoreFitOverflow = overflow ? 'true' : 'false';
    delete element.dataset.scoreFitHidden;
    return {
      text: element.textContent.trim(),
      size: chosen,
      width: element.clientWidth,
      scrollWidth: element.scrollWidth,
      height: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflow
    };
  }

  function fitAll() {
    const elements = Array.from(document.querySelectorAll(SELECTOR));
    if (resizeObserver) {
      const nextObserved = new Set();
      for (const element of elements) {
        nextObserved.add(element);
        if (element.parentElement) nextObserved.add(element.parentElement);
      }
      for (const element of observedElements) {
        if (!nextObserved.has(element)) resizeObserver.unobserve(element);
      }
      for (const element of nextObserved) {
        if (!observedElements.has(element)) resizeObserver.observe(element);
      }
      observedElements = nextObserved;
    }
    return elements.map(fitElement).filter(Boolean);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      fitAll();
    });
  }

  function mutationTouchesScoreFit(mutation) {
    const owner = mutation.target.nodeType === Node.ELEMENT_NODE
      ? mutation.target
      : mutation.target.parentElement;
    if (owner?.closest?.(`${SELECTOR}, ${READOUT_SELECTOR}`)) return true;
    return Array.from(mutation.addedNodes).some((node) => (
      node.nodeType === Node.ELEMENT_NODE
      && (node.matches?.(SELECTOR) || node.querySelector?.(SELECTOR))
    ));
  }

  function state() {
    return Array.from(document.querySelectorAll(SELECTOR)).map((element) => ({
      text: element.textContent.trim(),
      visible: element.getClientRects().length > 0,
      fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflow: element.dataset.scoreFitOverflow === 'true'
    }));
  }

  function init() {
    resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    const mutationObserver = new MutationObserver((mutations) => {
      if (mutations.some(mutationTouchesScoreFit)) schedule();
    });
    mutationObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    addEventListener('resize', schedule, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    schedule();
  }

  global.CyberligaScoreFit = Object.freeze({ fitAll, fitElement, state });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
