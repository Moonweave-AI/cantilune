#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "${script_dir}/.." && pwd)"
pdf="${project_dir}/build/moonweave-technical-report.pdf"
log="${project_dir}/build/release/main.log"

cd "${project_dir}"

if [[ ! -f "${pdf}" || ! -f "${log}" ]]; then
  echo "Build artifacts are missing. Run make first." >&2
  exit 1
fi

if rg -n '(^!|Missing character|undefined citations|undefined references|There were undefined)' "${log}"; then
  echo "LaTeX log contains a blocking issue." >&2
  exit 1
fi

if rg -n 'Overfull \\hbox' "${log}"; then
  echo "Horizontal overflow detected." >&2
  exit 1
fi

if pdffonts "${pdf}" | awk 'NR > 2 && $5 != "yes" { bad=1 } END { exit bad }'; then
  :
else
  echo "At least one PDF font is not embedded." >&2
  exit 1
fi

text_file="$(mktemp /tmp/moonweave-report-text.XXXXXX)"
pdftotext "${pdf}" "${text_file}"
rg -q 'A Governable' "${text_file}"
rg -q '可治理的智能体运行时' "${text_file}"

pages="$(pdfinfo "${pdf}" | awk '/^Pages:/ {print $2}')"
size="$(du -h "${pdf}" | awk '{print $1}')"
echo "QA passed: ${pages} pages, ${size}, all fonts embedded, bilingual text extractable."
