type ClockOffsetListener = (offset: number) => void;
const listeners = new Set<ClockOffsetListener>();

let globalClockOffset = 0;
let isOffsetCalculated = false;
let isSyncing = false;

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 4000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

export const syncClock = async () => {
  if (isOffsetCalculated || isSyncing) return;
  isSyncing = true;
  try {
    const start = Date.now();
    
    // Strategy 1: WorldTimeAPI (CORS-enabled, standard UTC)
    try {
      const response = await fetchWithTimeout('https://worldtimeapi.org/api/timezone/Etc/UTC', {}, 4000);
      if (response.ok) {
        const data = await response.json();
        if (data && data.utc_datetime) {
          const serverTime = new Date(data.utc_datetime).getTime();
          const latency = (Date.now() - start) / 2;
          const calculatedOffset = Date.now() - (serverTime + latency);
          updateGlobalClockOffset(calculatedOffset);
          return;
        }
      }
    } catch (e) {
      console.warn("WorldTimeAPI sync failed, trying fallback:", e);
    }

    // Strategy 2: TimeAPI (Backup)
    try {
      const response = await fetchWithTimeout('https://timeapi.io/api/Time/current/zone?timeZone=UTC', {}, 4000);
      if (response.ok) {
        const data = await response.json();
        if (data && data.dateTime) {
          const serverTime = new Date(data.dateTime + 'Z').getTime();
          const latency = (Date.now() - start) / 2;
          const calculatedOffset = Date.now() - (serverTime + latency);
          updateGlobalClockOffset(calculatedOffset);
          return;
        }
      }
    } catch (e) {
      console.warn("TimeAPI sync failed, trying fallback:", e);
    }

    // Strategy 3: Same-Origin fetch of the document to parse Date header (Fast & zero CORS issue)
    try {
      const response = await fetchWithTimeout(window.location.origin + '/?t=' + Date.now(), { method: 'HEAD' }, 3000);
      const serverDateStr = response.headers.get('Date') || response.headers.get('date');
      if (serverDateStr) {
        const serverTime = new Date(serverDateStr).getTime();
        const latency = (Date.now() - start) / 2;
        const calculatedOffset = Date.now() - (serverTime + latency);
        updateGlobalClockOffset(calculatedOffset);
        return;
      }
    } catch (e) {
      console.warn("Same-origin HEAD sync failed:", e);
    }

    // Strategy 4: Fallback GET fetch of index.html
    try {
      const response = await fetchWithTimeout('/', { method: 'GET' }, 3000);
      const serverDateStr = response.headers.get('Date') || response.headers.get('date');
      if (serverDateStr) {
        const serverTime = new Date(serverDateStr).getTime();
        const latency = (Date.now() - start) / 2;
        const calculatedOffset = Date.now() - (serverTime + latency);
        updateGlobalClockOffset(calculatedOffset);
        return;
      }
    } catch (e) {
      console.warn("Same-origin GET sync failed:", e);
    }

  } catch (error) {
    console.warn("Could not sync clock with any server, using local time:", error);
  } finally {
    isSyncing = false;
  }
};

export const addOffsetListener = (listener: ClockOffsetListener) => {
  listeners.add(listener);
  if (isOffsetCalculated) {
    listener(globalClockOffset);
  }
};

export const removeOffsetListener = (listener: ClockOffsetListener) => {
  listeners.delete(listener);
};

export const updateGlobalClockOffset = (offset: number) => {
  globalClockOffset = offset;
  isOffsetCalculated = true;
  listeners.forEach(l => {
    try {
      l(offset);
    } catch (err) {
      console.error(err);
    }
  });
};

export const getSyncedDate = (): Date => {
  return new Date(Date.now() - globalClockOffset);
};

export const getSyncedISOString = (): string => {
  return getSyncedDate().toISOString();
};

export const getGlobalClockOffset = (): number => {
  return globalClockOffset;
};

// Auto-run sync on load
if (typeof window !== 'undefined') {
  syncClock();
}
