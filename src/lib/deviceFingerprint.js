function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

export function getDeviceInfo() {
  const ua = navigator.userAgent;

  if (/iPhone/.test(ua))   return { brand: 'Apple',   model: 'iPhone',      os: 'iOS'       };
  if (/iPad/.test(ua))     return { brand: 'Apple',   model: 'iPad',        os: 'iPadOS'    };
  // "like Mac OS X" appears in iOS/iPadOS strings — exclude those
  if (/Macintosh/.test(ua) && !/like Mac OS X/.test(ua))
                           return { brand: 'Apple',   model: 'Mac',         os: 'macOS'     };

  if (/Android/.test(ua)) {
    const m = ua.match(/;\s([^;)]+)\sBuild\//);
    if (m) {
      const parts = m[1].trim().split(' ');
      return { brand: parts[0] || 'Android', model: parts.slice(1).join(' ') || 'Device', os: 'Android' };
    }
    return { brand: 'Android', model: 'Device', os: 'Android' };
  }

  if (/Windows NT/.test(ua)) return { brand: 'Windows', model: 'PC',         os: 'Windows'  };
  if (/CrOS/.test(ua))       return { brand: 'Google',  model: 'Chromebook', os: 'ChromeOS' };
  if (/Linux/.test(ua))      return { brand: 'Linux',   model: 'PC',         os: 'Linux'    };

  return { brand: 'Unknown', model: 'Device', os: 'Unknown' };
}

export function getOrCreateSessionId() {
  try {
    let id = sessionStorage.getItem('_vsid');
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('_vsid', id);
    }
    return id;
  } catch {
    return `fallback_${Date.now()}`;
  }
}

export function normalizeQuery(q) {
  return q.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function getOrCreateFingerprint() {
  try {
    let fp = localStorage.getItem('_dfp');
    if (!fp) {
      fp = djb2([
        navigator.userAgent,
        `${screen.width}x${screen.height}x${screen.colorDepth}`,
        navigator.language || '',
        Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        String(navigator.hardwareConcurrency || 0),
        navigator.platform || '',
      ].join('|||'));
      localStorage.setItem('_dfp', fp);
    }
    return fp;
  } catch {
    return djb2(navigator.userAgent + String(Date.now()));
  }
}
