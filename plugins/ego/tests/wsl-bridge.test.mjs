import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scripts = fileURLToPath(
  new URL("../../../skills/ego-browser/scripts/", import.meta.url),
);
const launcher = join(scripts, "ego-browser-wsl.sh");
const installer = join(scripts, "install-wsl.sh");
const posixOnly = { skip: process.platform === "win32" };

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "ego-wsl-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, "bin");
  const home = join(root, "home");
  mkdirSync(bin);
  mkdirSync(home);
  const executable = (path, body) => {
    writeFileSync(path, `#!${process.execPath}\n${body}\n`);
    chmodSync(path, 0o755);
  };
  const cli = join(bin, "ego CLI кириллица.exe");
  executable(
    cli,
    `const chunks = [];
process.stdin.on("data", chunk => chunks.push(chunk));
process.stdin.on("end", () => {
  console.log(JSON.stringify({ args: process.argv.slice(2), input: [...Buffer.concat(chunks)] }));
  process.stderr.write("native stderr\\n");
  process.exitCode = Number(process.env.FAKE_CLI_EXIT || 0);
});`,
  );
  executable(
    join(bin, "powershell.exe"),
    `const chunks = [];
process.stdin.on("data", chunk => chunks.push(chunk));
process.stdin.on("end", () => {
  if (Buffer.concat(chunks).length) process.exit(91);
  if (process.env.FAKE_DISCOVERY_FAIL) process.exit(1);
  process.stdout.write("C:\\\\Users\\\\Example User\\\\ego-browser.exe\\r\\n");
});`,
  );
  executable(
    join(bin, "wslpath"),
    `if (process.env.FAKE_PATH_FAIL) process.exit(1);
process.stdout.write(process.env.FAKE_CLI_PATH + "\\n");`,
  );
  const env = {
    ...process.env,
    HOME: home,
    XDG_STATE_HOME: join(root, "state"),
    WSL_DISTRO_NAME: "Ubuntu",
    PATH: `${bin}:${process.env.PATH}`,
    FAKE_CLI_PATH: cli,
  };
  const run = (file, args = [], input = "", overrides = {}) =>
    spawnSync("/bin/sh", [file, ...args], {
      env: { ...env, ...overrides },
      input,
      encoding: "utf8",
    });
  return { root, bin, home, env, run };
}

test(
  "WSL bridge preserves native arguments, UTF-8 stdin, stderr and exit",
  posixOnly,
  (t) => {
    const { run } = fixture(t);
    const input = Buffer.from('console.log("кириллица → Windows");\n\0');
    const args = ["nodejs", "-e", 'space "quote" $literal `text`', ""];
    const result = run(launcher, args, input, { FAKE_CLI_EXIT: "23" });
    assert.equal(result.status, 23, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { args, input: [...input] });
    assert.equal(result.stderr, "native stderr\n");
  },
);

test(
  "WSL bridge reports missing Windows CLI and invalid path translation",
  posixOnly,
  (t) => {
    const { run } = fixture(t);
    const missing = run(launcher, [], "script", { FAKE_DISCOVERY_FAIL: "1" });
    assert.equal(missing.status, 127);
    assert.match(missing.stderr, /complete ego lite onboarding in Windows/);
    const badPath = run(launcher, [], "script", { FAKE_PATH_FAIL: "1" });
    assert.equal(badPath.status, 127);
    assert.match(badPath.stderr, /could not translate/);
  },
);

test(
  "WSL bridge explains disabled Windows PATH integration",
  posixOnly,
  (t) => {
    const { root, run } = fixture(t);
    const empty = join(root, "empty");
    mkdirSync(empty);
    const result = run(launcher, [], "", { PATH: empty });
    assert.equal(result.status, 127);
    assert.match(
      result.stderr,
      /enable WSL interop and Windows PATH integration/,
    );
  },
);

test(
  "WSL installer installs once, updates its bridge with backup and preserves user commands",
  posixOnly,
  (t) => {
    const { root, home, env, run } = fixture(t);
    const target = join(home, ".local/bin/ego-browser");
    const first = run(installer);
    assert.equal(first.status, 0, first.stderr);
    const invoked = spawnSync(target, ["nodejs"], {
      env,
      input: "existing browser",
      encoding: "utf8",
    });
    assert.equal(invoked.status, 0, invoked.stderr);
    assert.deepEqual(JSON.parse(invoked.stdout).args, ["nodejs"]);
    assert.equal(
      Buffer.from(JSON.parse(invoked.stdout).input).toString(),
      "existing browser",
    );
    chmodSync(target, 0o644);
    const repeat = run(installer);
    assert.equal(repeat.status, 0, repeat.stderr);
    assert.match(repeat.stdout, /already current/);
    assert.equal(
      spawnSync(target, ["skill"], { env, input: "", encoding: "utf8" }).status,
      0,
      "reinstall restores an executable bridge whose mode was lost",
    );

    writeFileSync(
      target,
      "#!/bin/sh\n# ego-browser WSL bridge; managed by install-wsl.sh.\nexit 9\n",
    );
    assert.equal(run(installer).status, 0);
    const backups = join(root, "state/ego-browser/wsl-backups");
    assert.equal(readdirSync(backups).length, 1);
    assert.match(
      readFileSync(join(backups, readdirSync(backups)[0]), "utf8"),
      /exit 9/,
    );

    writeFileSync(target, "#!/bin/sh\necho custom launcher\n");
    const conflict = run(installer);
    assert.equal(conflict.status, 1);
    assert.match(conflict.stderr, /Refusing to replace/);
    assert.equal(
      readFileSync(target, "utf8"),
      "#!/bin/sh\necho custom launcher\n",
    );
  },
);
