(function trackPageview() {
  const endpoint = "https://visitor-analysis.haoyanghowyoung.workers.dev/collect";
  const noop = () => {};

  try {
    const payload = {
      page_url: window.location.href,
      page_path: window.location.pathname,
      referrer: document.referrer || null,
      title: document.title || null,
      screen_width: window.screen.width,
      screen_height: window.screen.height,
      language: navigator.language || null,
      timezone:
        Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    };

    const body = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(endpoint, blob)) {
        return;
      }
    }

    void fetch(endpoint, {
      method: "POST",
      mode: "cors",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
      },
      body,
    }).catch(noop);
  } catch {
    // Ignore analytics send failures so page rendering stays unaffected.
  }
})();
