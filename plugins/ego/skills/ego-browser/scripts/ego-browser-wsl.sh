#!/bin/sh
# ego-browser WSL bridge; managed by install-wsl.sh.
set -eu

fail() {
    printf 'ego-browser: %s\n' "$*" >&2
    exit 127
}

if [ -z "${WSL_DISTRO_NAME:-}${WSL_INTEROP:-}" ]; then
    case "$(uname -r)" in
        *[Mm]icrosoft*) ;;
        *) fail 'this bridge requires WSL and Windows executable interop.' ;;
    esac
fi

command -v powershell.exe >/dev/null 2>&1 ||
    fail 'powershell.exe is unavailable; enable WSL interop and Windows PATH integration.'
command -v wslpath >/dev/null 2>&1 || fail 'wslpath is unavailable; run this bridge inside WSL.'

# Keep script stdin for the native CLI, including when PowerShell starts slowly.
windows_cli=$(
    powershell.exe -NoProfile -NonInteractive -Command \
        '$ErrorActionPreference = "Stop"; [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); (Get-Command ego-browser.exe -CommandType Application -ErrorAction Stop).Source' \
        </dev/null
) || fail 'Windows ego-browser.exe was not found; complete ego lite onboarding in Windows and reopen your terminal.'
windows_cli=$(printf '%s' "$windows_cli" | tr -d '\r')
[ -n "$windows_cli" ] || fail 'Windows ego-browser.exe was not found; complete ego lite onboarding in Windows.'
cli=$(wslpath -u "$windows_cli") || fail 'could not translate the Windows ego-browser.exe path.'
[ -f "$cli" ] && [ -x "$cli" ] || fail "Windows ego-browser.exe is not executable at $cli."

exec "$cli" "$@"
