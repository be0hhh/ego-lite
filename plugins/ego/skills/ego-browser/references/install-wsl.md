# Use Windows ego lite from WSL

Use this setup when ego lite runs in Windows and the agent runs in WSL. The
agent connects to the same Windows browser, spaces and signed-in state. A Linux
browser installation is not needed.

First complete the Windows installation and onboarding in
[install-windows.md](install-windows.md). Keep ego lite open in Windows. In a new
Windows PowerShell terminal, `Get-Command ego-browser.exe` must succeed.

## Install the WSL command

From the installed ego-browser Skill directory, run:

```bash
sh scripts/install-wsl.sh
```

For a Git checkout, run `sh skills/ego-browser/scripts/install-wsl.sh` from its
root. The script checks the Windows CLI and installs `~/.local/bin/ego-browser`.
It can update its own bridge, saving the previous version under
`${XDG_STATE_HOME:-~/.local/state}/ego-browser/wsl-backups`. It leaves any other
existing command untouched and reports the conflict.

Ensure `~/.local/bin` is on the WSL `PATH`, then confirm:

```bash
command -v ego-browser
ego-browser skill
ego-browser nodejs <<'JS'
console.log({ spaces: (await listTaskSpaces()).length, text: "WSL → Windows" });
JS
```

Read the returned guide before controlling pages. Existing spaces and tabs keep
ego's normal ownership and handoff rules. The bridge does not copy profiles,
change sign-ins, or open a separate browser. It discovers the Windows CLI on
every call so it follows ego lite updates.

## Files and script arguments

The CLI and scripts run in Windows. Use Windows absolute paths for `--sdk-path`,
script imports, uploads and saved screenshots, even though the command is
invoked from WSL. Translate an existing WSL path with `wslpath -w`, and use
forward slashes in JavaScript strings to avoid backslash escapes:

```bash
wslpath -w /home/your-user/report.pdf
# \\wsl.localhost\Ubuntu\home\your-user\report.pdf
```

A screenshot returned as `C:/Users/your-user/AppData/Local/Temp/shot.png` can be
read in WSL at the path printed by:

```bash
wslpath -u 'C:/Users/your-user/AppData/Local/Temp/shot.png'
```

The bridge passes JavaScript through stdin unchanged, including UTF-8 text. It
does not interpret code with PowerShell or rewrite paths inside scripts.

## Troubleshooting

- **`powershell.exe` unavailable**: check WSL Windows interop and Windows PATH
  integration. If these are disabled in `/etc/wsl.conf`, restoring them requires
  a WSL restart; coordinate that restart with the user.
- **Windows CLI not found**: finish ego lite onboarding and verify
  `Get-Command ego-browser.exe` in Windows PowerShell. Start a new WSL terminal
  after changing Windows PATH.
- **CLI discovery succeeds but browser commands fail**: open ego lite in Windows
  and follow the error from its CLI. Installing another Skill does not start
  the browser or grant control of a user-owned space.
- **A file cannot be read**: Windows scripts cannot use `/home/...` directly.
  Translate the path and confirm the Windows user can access the WSL file.
