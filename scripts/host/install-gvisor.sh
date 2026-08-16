#!/usr/bin/env bash
# Official gVisor install (https://gvisor.dev/docs/user_guide/install/).
# Prefers the Debian apt repository; falls back to the official release tarball.
# Linux only. After install: runsc install && reload docker.
set -euo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "gVisor runsc is a Linux runtime (ADR-0024). On Windows use Hyper-V isolated containers, or a WSL Linux engine via scripts/host/install-gvisor-wsl.sh." >&2
  exit 2
fi

install_from_apt() {
  command -v apt-get >/dev/null 2>&1 || return 1
  sudo apt-get update
  sudo apt-get install -y apt-transport-https ca-certificates curl gnupg
  curl -fsSL https://gvisor.dev/archive.key | sudo gpg --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" \
    | sudo tee /etc/apt/sources.list.d/gvisor.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y runsc
}

install_from_tarball() {
  local arch url tmp
  arch="$(uname -m)"
  url="https://storage.googleapis.com/gvisor/releases/release/latest/${arch}"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN
  curl -fsSL "${url}/gvisor.tar.bz2" -o "${tmp}/gvisor.tar.bz2"
  curl -fsSL "${url}/gvisor.tar.bz2.sha512" -o "${tmp}/gvisor.tar.bz2.sha512"
  (
    cd "${tmp}"
    sha512sum -c gvisor.tar.bz2.sha512
  )
  sudo tar -xjf "${tmp}/gvisor.tar.bz2" -C /usr/local/bin
}

if ! command -v runsc >/dev/null 2>&1; then
  if ! install_from_apt; then
    echo "gVisor apt path failed; installing official release tarball" >&2
    install_from_tarball
  fi
fi

runsc --version
if command -v docker >/dev/null 2>&1; then
  sudo runsc install
  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl reload docker || sudo systemctl restart docker || true
  fi
  docker pull alpine:3.20
  docker run --rm --runtime=runsc alpine:3.20 echo sandbox-ok
fi
