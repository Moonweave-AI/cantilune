#!/usr/bin/env bash
# Official gVisor + Docker Engine inside a Linux WSL distro (ADR-0024).
# Prefers the gVisor apt repository; falls back to the official release tarball.
# https://gvisor.dev/docs/user_guide/install/
set -euo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "install-gvisor-wsl.sh must run inside a Linux WSL distro" >&2
  exit 2
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  apt-transport-https \
  ca-certificates \
  curl \
  gnupg \
  iptables \
  iproute2 \
  docker.io

if [[ -x /usr/sbin/iptables-legacy ]]; then
  update-alternatives --set iptables /usr/sbin/iptables-legacy || true
fi

install_runsc_apt() {
  curl -fsSL https://gvisor.dev/archive.key | gpg --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" \
    >/etc/apt/sources.list.d/gvisor.list
  apt-get update
  apt-get install -y runsc
}

install_runsc_tarball() {
  local arch url tmp
  arch="$(uname -m)"
  url="https://storage.googleapis.com/gvisor/releases/release/latest/${arch}"
  tmp="$(mktemp -d)"
  curl -fsSL "${url}/gvisor.tar.bz2" -o "${tmp}/gvisor.tar.bz2"
  curl -fsSL "${url}/gvisor.tar.bz2.sha512" -o "${tmp}/gvisor.tar.bz2.sha512"
  (
    cd "${tmp}"
    sha512sum -c gvisor.tar.bz2.sha512
  )
  tar -xjf "${tmp}/gvisor.tar.bz2" -C /usr/local/bin
  rm -rf "${tmp}"
}

if ! command -v runsc >/dev/null 2>&1; then
  if ! install_runsc_apt; then
    echo "gVisor apt repository failed; installing official release tarball" >&2
    install_runsc_tarball
  fi
fi

if ! command -v runsc >/dev/null 2>&1; then
  echo "runsc is still missing after official install paths" >&2
  exit 1
fi

runsc --version
runsc install || true

start_docker() {
  if command -v service >/dev/null 2>&1; then
    service docker start || true
  fi
  if docker info >/dev/null 2>&1; then
    return 0
  fi
  mkdir -p /var/log
  dockerd >/var/log/dockerd.log 2>&1 &
  local i
  for i in $(seq 1 40); do
    if docker info >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "dockerd failed to start" >&2
  tail -n 80 /var/log/dockerd.log >&2 || true
  return 1
}

start_docker
if command -v runsc >/dev/null 2>&1; then
  runsc install || true
  if command -v service >/dev/null 2>&1; then
    service docker restart || true
  fi
  start_docker
fi

docker info
docker pull alpine:3.20
docker run --rm --runtime=runsc alpine:3.20 echo sandbox-ok
