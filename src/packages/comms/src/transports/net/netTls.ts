import { type ConnectionOptions, type TlsOptions, type TLSSocket } from "node:tls";
import { fingerprintCertificateDer } from "../../security/certificateFingerprint.js";

export interface NetTransportTlsMaterial {
  readonly cert: string;
  readonly key: string;
  readonly ca: string;
}

export const NET_TLS_MIN_VERSION = "TLSv1.3";

export function assertTlsMaterial(tls: NetTransportTlsMaterial): void {
  if (tls.cert.trim().length === 0 || tls.key.trim().length === 0 || tls.ca.trim().length === 0) {
    throw new Error("NetTransport requires non-empty tls.cert, tls.key, and tls.ca PEMs");
  }
}

export function buildServerTlsOptions(tls: NetTransportTlsMaterial): TlsOptions {
  return {
    key: tls.key,
    cert: tls.cert,
    ca: tls.ca,
    requestCert: true,
    rejectUnauthorized: true,
    minVersion: NET_TLS_MIN_VERSION,
  };
}

export function buildClientTlsOptions(
  tls: NetTransportTlsMaterial,
  connect: { readonly host: string; readonly port: number },
): ConnectionOptions {
  return {
    host: connect.host,
    port: connect.port,
    key: tls.key,
    cert: tls.cert,
    ca: tls.ca,
    rejectUnauthorized: true,
    minVersion: NET_TLS_MIN_VERSION,
    servername: connect.host === "127.0.0.1" || connect.host === "::1" ? "localhost" : connect.host,
  };
}

export function extractPeerFingerprint(socket: TLSSocket): string | undefined {
  const cert = socket.getPeerX509Certificate();
  if (cert === undefined) {
    return undefined;
  }
  return fingerprintCertificateDer(cert.raw);
}
