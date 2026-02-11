import net from "node:net";

/** Normalize host/hostname strings to a canonical comparison form. */
export function normalizeHost(hostname) {
  if (typeof hostname !== "string") return "";

  let host = hostname.trim().toLowerCase();
  if (!host) return "";

  // URL.hostname for IPv6 may include brackets.
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }

  // Strip IPv6 zone index (e.g. fe80::1%lo0).
  const zoneIdx = host.indexOf("%");
  if (zoneIdx >= 0) {
    host = host.slice(0, zoneIdx);
  }

  return host;
}

/** Parse ALLOWED_TARGET_HOSTS env var into a normalized host set. */
export function parseAllowedTargetHosts(raw) {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return new Set();
  }

  const out = new Set();
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    let host = "";

    // Accept full URLs in env var for convenience.
    if (trimmed.includes("://")) {
      try {
        host = normalizeHost(new URL(trimmed).hostname);
      } catch {
        host = "";
      }
    } else {
      host = normalizeHost(trimmed);
    }

    if (host) out.add(host);
  }

  return out;
}

export function isIpLiteral(hostname) {
  const host = normalizeHost(hostname);
  if (!host) return false;
  return net.isIP(host) !== 0;
}

function parseIPv4(ip) {
  const host = normalizeHost(ip);
  const parts = host.split(".");
  if (parts.length !== 4) return null;

  const bytes = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const n = Number.parseInt(part, 10);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    bytes.push(n);
  }

  return bytes;
}

function parseIPv6Side(raw) {
  if (raw === "") return [];

  const segments = raw.split(":");
  const out = [];

  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (seg === "") return null;

    if (seg.includes(".")) {
      // IPv4 tail is only valid in final segment.
      if (i !== segments.length - 1) return null;
      const bytes = parseIPv4(seg);
      if (!bytes) return null;
      out.push((bytes[0] << 8) | bytes[1]);
      out.push((bytes[2] << 8) | bytes[3]);
      continue;
    }

    if (!/^[0-9a-f]{1,4}$/i.test(seg)) return null;
    out.push(Number.parseInt(seg, 16));
  }

  return out;
}

function parseIPv6Hextets(ip) {
  const host = normalizeHost(ip);
  if (!host) return null;

  const firstDouble = host.indexOf("::");
  if (firstDouble >= 0 && firstDouble !== host.lastIndexOf("::")) {
    return null;
  }

  if (firstDouble === -1) {
    const full = parseIPv6Side(host);
    if (!full || full.length !== 8) return null;
    return full;
  }

  const leftRaw = host.slice(0, firstDouble);
  const rightRaw = host.slice(firstDouble + 2);

  const left = parseIPv6Side(leftRaw);
  const right = parseIPv6Side(rightRaw);
  if (!left || !right) return null;

  const missing = 8 - (left.length + right.length);
  if (missing < 1) return null;

  return [...left, ...Array.from({ length: missing }, () => 0), ...right];
}

function isLoopbackIPv6Hextets(hextets) {
  if (!Array.isArray(hextets) || hextets.length !== 8) return false;
  for (let i = 0; i < 7; i += 1) {
    if (hextets[i] !== 0) return false;
  }
  return hextets[7] === 1;
}

function mappedIPv4FromIPv6Hextets(hextets) {
  if (!Array.isArray(hextets) || hextets.length !== 8) return null;

  for (let i = 0; i < 5; i += 1) {
    if (hextets[i] !== 0) return null;
  }

  if (hextets[5] !== 0xffff) return null;

  const a = (hextets[6] >> 8) & 0xff;
  const b = hextets[6] & 0xff;
  const c = (hextets[7] >> 8) & 0xff;
  const d = hextets[7] & 0xff;
  return `${a}.${b}.${c}.${d}`;
}

export function isLoopbackHostname(hostname) {
  const host = normalizeHost(hostname);
  if (!host) return false;

  if (host === "localhost") return true;

  const family = net.isIP(host);
  if (family === 4) {
    return host.startsWith("127.");
  }

  if (family === 6) {
    const hextets = parseIPv6Hextets(host);
    if (!hextets) return false;

    if (isLoopbackIPv6Hextets(hextets)) return true;

    const mapped = mappedIPv4FromIPv6Hextets(hextets);
    return mapped !== null && mapped.startsWith("127.");
  }

  return false;
}

/**
 * True for loopback, RFC1918, and link-local addresses.
 */
export function isPrivateOrLocalIp(ip) {
  const host = normalizeHost(ip);
  const family = net.isIP(host);

  if (family === 4) {
    const bytes = parseIPv4(host);
    if (!bytes) return false;

    const [a, b] = bytes;

    // 127.0.0.0/8 loopback
    if (a === 127) return true;
    // 10.0.0.0/8 private
    if (a === 10) return true;
    // 172.16.0.0/12 private
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 private
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 link-local
    if (a === 169 && b === 254) return true;

    return false;
  }

  if (family === 6) {
    const hextets = parseIPv6Hextets(host);
    if (!hextets) return false;

    if (isLoopbackIPv6Hextets(hextets)) return true;

    // IPv4-mapped IPv6 (e.g. ::ffff:192.168.1.2)
    const mapped = mappedIPv4FromIPv6Hextets(hextets);
    if (mapped !== null) {
      return isPrivateOrLocalIp(mapped);
    }

    const first = hextets[0];

    // fc00::/7 unique local
    if ((first & 0xfe00) === 0xfc00) return true;

    // fe80::/10 link-local
    if ((first & 0xffc0) === 0xfe80) return true;

    return false;
  }

  return false;
}

/**
 * Host allowlist check.
 * - Empty allowlist => allow all hosts.
 * - Non-empty allowlist => exact normalized host match.
 */
export function isAllowedTargetHost(hostname, allowedHosts) {
  const host = normalizeHost(hostname);
  if (!host) return false;

  if (!(allowedHosts instanceof Set) || allowedHosts.size === 0) {
    return true;
  }

  return allowedHosts.has(host);
}

/**
 * Hostname-only block decision (no DNS resolution context).
 */
export function getBlockedTargetReasonForHostname(hostname, opts = {}) {
  const {
    allowLoopbackTargets = false,
    allowPrivateTargets = false,
    allowedHosts = new Set(),
  } = opts;

  if (!isAllowedTargetHost(hostname, allowedHosts)) {
    return "blocked_target_not_allowlisted";
  }

  const host = normalizeHost(hostname);
  if (!host) return "blocked_target_invalid_host";

  const loopback = isLoopbackHostname(host);
  if (loopback && !allowLoopbackTargets) {
    return "blocked_target_loopback";
  }

  // Preserve legacy semantics: if loopback is explicitly allowed, do not
  // re-block it under private/local checks.
  if (loopback && allowLoopbackTargets) {
    return null;
  }

  if (!allowPrivateTargets && isIpLiteral(host) && isPrivateOrLocalIp(host)) {
    return "blocked_target_private_ip";
  }

  return null;
}

/**
 * DNS-resolution-based block decision.
 * Resolved IPs should come from dns.lookup(host, { all: true }).
 */
export function getBlockedTargetReasonForResolvedIps(resolvedIps, opts = {}) {
  const {
    allowLoopbackTargets = false,
    allowPrivateTargets = false,
  } = opts;

  if (!Array.isArray(resolvedIps) || resolvedIps.length === 0) {
    return null;
  }

  for (const ip of resolvedIps) {
    const normalized = normalizeHost(ip);
    if (!normalized) continue;

    const loopback = isLoopbackHostname(normalized);
    if (loopback && !allowLoopbackTargets) {
      return "blocked_target_loopback";
    }

    if (loopback && allowLoopbackTargets) {
      continue;
    }

    if (!allowPrivateTargets && isPrivateOrLocalIp(normalized)) {
      return "blocked_target_private_ip";
    }
  }

  return null;
}

/**
 * Final target policy decision used by proxy server.
 */
export function evaluateTargetHostPolicy(opts = {}) {
  const {
    hostname,
    resolvedIps = [],
    allowLoopbackTargets = false,
    allowPrivateTargets = false,
    allowedHosts = new Set(),
  } = opts;

  const hostReason = getBlockedTargetReasonForHostname(hostname, {
    allowLoopbackTargets,
    allowPrivateTargets,
    allowedHosts,
  });

  if (hostReason) {
    return { allowed: false, reason: hostReason };
  }

  const dnsReason = getBlockedTargetReasonForResolvedIps(resolvedIps, {
    allowLoopbackTargets,
    allowPrivateTargets,
  });

  if (dnsReason) {
    return { allowed: false, reason: dnsReason };
  }

  return { allowed: true };
}

/** Backward-compatible convenience helper. */
export function isBlockedTargetByHostname(hostname) {
  return getBlockedTargetReasonForHostname(hostname) !== null;
}
