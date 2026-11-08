#!/bin/sh
set -eu

[ "$#" -eq 0 ] || { printf 'Usage: sh install-wsl.sh\n' >&2; exit 1; }
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
source_path="$script_dir/ego-browser-wsl.sh"
target_dir="$HOME/.local/bin"
target_path="$target_dir/ego-browser"

# Verify discovery before touching a working user command.
sh "$source_path" skill >/dev/null

if [ -e "$target_path" ] || [ -L "$target_path" ]; then
    if [ -L "$target_path" ] || ! grep -Fx '# ego-browser WSL bridge; managed by install-wsl.sh.' "$target_path" >/dev/null; then
        printf 'Refusing to replace existing %s; move your command aside before installing this bridge.\n' "$target_path" >&2
        exit 1
    fi
    if cmp -s "$source_path" "$target_path"; then
        chmod 755 "$target_path"
        printf 'WSL bridge already current: %s\n' "$target_path"
        exit 0
    fi
    backup_dir="${XDG_STATE_HOME:-$HOME/.local/state}/ego-browser/wsl-backups"
    mkdir -p "$backup_dir"
    backup_path=$(mktemp "$backup_dir/ego-browser.XXXXXX")
    cp -p "$target_path" "$backup_path"
    printf 'Previous bridge saved: %s\n' "$backup_path"
fi

mkdir -p "$target_dir"
staged_path=$(mktemp "$target_dir/.ego-browser.XXXXXX")
trap 'rm -f "$staged_path"' EXIT HUP INT TERM
cp "$source_path" "$staged_path"
chmod 755 "$staged_path"
mv -f "$staged_path" "$target_path"
trap - EXIT HUP INT TERM
printf 'Installed WSL bridge: %s\n' "$target_path"
case ":$PATH:" in
    *":$target_dir:"*) ;;
    *) printf 'Add %s to your WSL PATH, then open a new terminal.\n' "$target_dir" ;;
esac
