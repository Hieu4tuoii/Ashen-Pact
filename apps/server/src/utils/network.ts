import os from 'node:os';

const VIRTUAL_ADAPTER_PATTERNS = [
  /virtualbox/i,
  /vmware/i,
  /vbox/i,
  /wsl/i,
  /hyper-v/i,
  /vethernet/i,
  /docker/i,
  /tap-/i,
  /tun/i,
  /hamachi/i,
  /tailscale/i,
  /zerotier/i,
  /loopback/i,
];

export interface LanAddressInfo {
  interfaceName: string;
  address: string;
  preferred: boolean;
}

/**
 * Discovers valid LAN IPv4 addresses while filtering out virtual adapters (WSL, VirtualBox, VPNs).
 */
export function getLanIPv4Addresses(): LanAddressInfo[] {
  const interfaces = os.networkInterfaces();
  const results: LanAddressInfo[] = [];

  for (const [name, netList] of Object.entries(interfaces)) {
    if (!netList) continue;
    const isVirtual = VIRTUAL_ADAPTER_PATTERNS.some((rx) => rx.test(name));
    if (isVirtual) continue;

    for (const net of netList) {
      if (net.family !== 'IPv4' || net.internal) continue;
      if (net.address.startsWith('169.254.')) continue; // Ignore APIPA link-local

      const preferred = /wi-?fi|wlan|ethernet|eth/i.test(name);
      results.push({
        interfaceName: name,
        address: net.address,
        preferred,
      });
    }
  }

  results.sort((a, b) => Number(b.preferred) - Number(a.preferred));
  return results;
}
