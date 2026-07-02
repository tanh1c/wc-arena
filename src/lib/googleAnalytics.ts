declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function installGoogleAnalytics(measurementId: string, win: Window = window, doc: Document = document) {
  if (win.gtag) return;

  win.dataLayer = win.dataLayer ?? [];
  win.gtag = function gtag() {
    win.dataLayer?.push(arguments);
  };
  win.gtag('js', new Date());
  win.gtag('config', measurementId, { send_page_view: false });

  const script = doc.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  doc.head.append(script);
}

export function trackGoogleAnalyticsPageView(measurementId: string, pagePath: string, pageTitle = document.title, pageLocation = window.location.href, win: Window = window) {
  win.gtag?.('event', 'page_view', {
    send_to: measurementId,
    page_title: pageTitle,
    page_location: pageLocation,
    page_path: pagePath,
  });
}
