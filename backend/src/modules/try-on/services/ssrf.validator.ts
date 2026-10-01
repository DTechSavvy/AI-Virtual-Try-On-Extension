import dns from 'dns/promises';
import { URL } from 'url';
import net from 'net';

export class SSRFError extends Error {
  constructor(message: string, public readonly code: string = 'SSRF_VALIDATION_FAILED') {
    super(message);
    this.name = 'SSRFError';
  }
}

/**
 * Validates URLs against Server-Side Request Forgery (SSRF) vulnerabilities.
 * Ensures the target host does not resolve to private, loopback, link-local,
 * cloud metadata endpoints, or invalid network segments.
 */
export class SSRFValidator {
  /**
   * Check if an IPv4 or IPv6 address is private, loopback, or reserved.
   */
  public static isPrivateIp(ip: string): boolean {
    const family = net.isIP(ip);
    if (!family) return true; // Invalid IP is treated as unsafe

    if (family === 4) {
      const parts = ip.split('.').map((p) => parseInt(p, 10));
      if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
        return true;
      }

      const b0 = parts[0]!;
      const b1 = parts[1]!;

      // 0.0.0.0/8 (Current network)
      if (b0 === 0) return true;

      // 10.0.0.0/8 (Private network)
      if (b0 === 10) return true;

      // 100.64.0.0/10 (Shared address / CGNAT)
      if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

      // 127.0.0.0/8 (Loopback)
      if (b0 === 127) return true;

      // 169.254.0.0/16 (Link-local & Cloud Metadata 169.254.169.254)
      if (b0 === 169 && b1 === 254) return true;

      // 172.16.0.0/12 (Private network: 172.16.0.0 - 172.31.255.255)
      if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

      // 192.168.0.0/16 (Private network)
      if (b0 === 192 && b1 === 168) return true;

      // 198.18.0.0/15 (Benchmarking)
      if (b0 === 198 && (b1 === 18 || b1 === 19)) return true;

      // 224.0.0.0/4 (Multicast)
      if (b0 >= 224 && b0 <= 239) return true;

      // 240.0.0.0/4 (Reserved) & 255.255.255.255 (Broadcast)
      if (b0 >= 240) return true;

      return false;
    }

    if (family === 6) {
      const lower = ip.toLowerCase();

      // Loopback ::1
      if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;

      // Unspecified ::
      if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return true;

      // IPv4-mapped IPv6 ::ffff:x.x.x.x
      if (lower.startsWith('::ffff:')) {
        const v4 = lower.substring(7);
        if (net.isIPv4(v4)) {
          return this.isPrivateIp(v4);
        }
      }

      // Link-local fe80::/10 (fe80 to febf)
      if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
        return true;
      }

      // Unique local fc00::/7 (fc00:: to fdff::)
      if (lower.startsWith('fc') || lower.startsWith('fd')) {
        return true;
      }

      return false;
    }

    return true;
  }

  /**
   * Validate a URL string before performing any HTTP/HTTPS fetching.
   * Resolves DNS to ensure the destination IP address is globally routable.
   */
  public static async validateUrl(rawUrl: string): Promise<URL> {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new SSRFError('Invalid URL syntax.', 'INVALID_URL_SYNTAX');
    }

    // 1. Enforce allowed protocol (HTTP/HTTPS)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new SSRFError(
        `Disallowed protocol: '${parsed.protocol}'. Only HTTP and HTTPS are permitted.`,
        'DISALLOWED_PROTOCOL'
      );
    }

    // 2. Reject credentials embedded in URL
    if (parsed.username || parsed.password) {
      throw new SSRFError('URLs containing user credentials are not allowed.', 'CREDENTIALS_IN_URL');
    }

    const hostname = parsed.hostname.toLowerCase();

    // 3. Reject forbidden explicit hosts
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      throw new SSRFError(`Access to local/internal host '${hostname}' is prohibited.`, 'LOCAL_HOST_PROHIBITED');
    }

    // 4. If hostname is an IP directly, validate directly
    if (net.isIP(hostname)) {
      if (this.isPrivateIp(hostname)) {
        throw new SSRFError(`Target IP '${hostname}' resides in a restricted private range.`, 'PRIVATE_IP_PROHIBITED');
      }
      return parsed;
    }

    // 5. Resolve DNS hostname and check resolved addresses
    try {
      const lookupResult = await dns.lookup(hostname, { all: true });

      if (!lookupResult || lookupResult.length === 0) {
        throw new SSRFError(`Could not resolve hostname '${hostname}'.`, 'DNS_RESOLUTION_FAILED');
      }

      for (const entry of lookupResult) {
        if (this.isPrivateIp(entry.address)) {
          throw new SSRFError(
            `Hostname '${hostname}' resolved to prohibited address '${entry.address}'.`,
            'DNS_REBOUND_TO_PRIVATE_IP'
          );
        }
      }
    } catch (err: unknown) {
      if (err instanceof SSRFError) throw err;
      const message = err instanceof Error ? err.message : 'DNS lookup error';
      throw new SSRFError(`Failed to verify host '${hostname}': ${message}`, 'DNS_RESOLUTION_FAILED');
    }

    return parsed;
  }
}
