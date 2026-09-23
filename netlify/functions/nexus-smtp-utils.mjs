/**
 * NeXus SMTP Utilities (Shared)
 *
 * Gemeinsame SMTP-Funktionen für:
 * - nexus-email-verify.mjs (HTTP Handler)
 * - nexus-elite-enrichment.mjs (Elite Pipeline)
 *
 * NICHT eigenständig aufrufbar — wird von anderen Modulen importiert.
 */

import net from 'net';

/**
 * Führt einen SMTP-Handshake durch (ohne DATA)
 * @param {string} mxHost - MX-Server Hostname
 * @param {string} email - Zu prüfende E-Mail-Adresse
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<{success: boolean, code: number, message: string}>}
 */
export async function smtpCheck(mxHost, email, timeout = 10000) {
  return new Promise((resolve) => {
    const socket = net.createConnection(25, mxHost);
    let buffer = '';
    let resolved = false;
    let step = 0;

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      try { socket.destroy(); } catch(e) {}
    };

    const finish = (success, code, message) => {
      cleanup();
      resolve({ success, code, message });
    };

    socket.setTimeout(timeout, () => {
      finish(false, 0, 'Connection timeout');
    });

    socket.on('error', (err) => {
      finish(false, 0, err.message);
    });

    socket.on('data', (data) => {
      buffer += data.toString();

      if (step === 0 && buffer.includes('220')) {
        step = 1;
        socket.write(`HELO neXus-verify.local\r\n`);
        buffer = '';
        return;
      }

      if (step === 1 && (buffer.includes('250') || buffer.includes('502'))) {
        step = 2;
        socket.write(`MAIL FROM:<verify@neXus-verify.local>\r\n`);
        buffer = '';
        return;
      }

      if (step === 2 && (buffer.includes('250') || buffer.includes('550'))) {
        step = 3;
        socket.write(`RCPT TO:<${email}>\r\n`);
        buffer = '';
        return;
      }

      if (step === 3) {
        const code = parseInt(buffer.substring(0, 3));
        const message = buffer.trim();
        socket.write(`QUIT\r\n`);
        finish(code === 250, code, message);
      }
    });
  });
}

/**
 * Findet MX-Server für eine Domain
 * @param {string} domain
 * @returns {Promise<string[]>}
 */
export async function findMxHosts(domain) {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
    const data = await res.json();

    if (data.Answer) {
      return data.Answer
        .filter(a => a.type === 15)
        .sort((a, b) => a.data.split(' ')[0] - b.data.split(' ')[0])
        .map(a => a.data.split(' ')[1]);
    }
  } catch(e) {}

  return [domain];
}

/**
 * Prüft ob eine Domain Catch-All ist
 * @param {string} mxHost
 * @param {string} domain
 * @returns {Promise<boolean>}
 */
export async function isCatchAll(mxHost, domain) {
  const fakeEmail = `xyzabc123nonexistent@${domain}`;
  const result = await smtpCheck(mxHost, fakeEmail, 8000);
  return result.success;
}
