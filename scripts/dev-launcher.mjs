import { spawn } from "node:child_process";
import { constants as osConstants } from "node:os";
import process from "node:process";

const SCRIPT_NAMES = {
  backendBuild: "backend:build",
  backendStart: "backend:start",
  dbCreate: "db:create",
  frontendDev: "frontend:dev",
};

const EXIT_CODE = {
  failure: 1,
  success: 0,
};

const EXIT_SIGNAL_OFFSET = 128;
const FORWARDED_SIGNALS = ["SIGINT", "SIGTERM"];
const NPM_EXECUTABLE = process.platform === "win32" ? "npm.cmd" : "npm";

function buildScriptCommand(scriptName) {
  return ["run", scriptName];
}

function buildInheritedSpawnOptions() {
  return {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    stdio: "inherit",
  };
}

function buildDetachedSpawnOptions() {
  return {
    ...buildInheritedSpawnOptions(),
    detached: false,
  };
}

function runBlockingScript(scriptName) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      NPM_EXECUTABLE,
      buildScriptCommand(scriptName),
      buildInheritedSpawnOptions(),
    );

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${scriptName} exited from signal ${signal}`));
        return;
      }

      if (code !== EXIT_CODE.success) {
        reject(new Error(`${scriptName} exited with code ${code ?? EXIT_CODE.failure}`));
        return;
      }

      resolve();
    });
  });
}

function startLongRunningScript(scriptName) {
  return spawn(
    NPM_EXECUTABLE,
    buildScriptCommand(scriptName),
    buildDetachedSpawnOptions(),
  );
}

function stopChildProcess(childProcess, signal) {
  if (childProcess.killed) {
    return;
  }

  childProcess.kill(signal);
}

function stopAllChildProcesses(childProcesses, signal) {
  for (const childProcess of childProcesses) {
    stopChildProcess(childProcess, signal);
  }
}

function toSignalExitCode(signal) {
  const signalNumber = osConstants.signals[signal];
  return typeof signalNumber === "number"
    ? EXIT_SIGNAL_OFFSET + signalNumber
    : EXIT_CODE.failure;
}

function registerForwardedSignals(childProcesses) {
  for (const signal of FORWARDED_SIGNALS) {
    process.on(signal, () => {
      stopAllChildProcesses(childProcesses, signal);
      process.exit(toSignalExitCode(signal));
    });
  }
}

function registerChildExitHandlers(childProcesses) {
  let hasExited = false;

  for (const childProcess of childProcesses) {
    childProcess.on("exit", (code, signal) => {
      if (hasExited) {
        return;
      }

      hasExited = true;
      stopAllChildProcesses(childProcesses, "SIGTERM");

      if (signal) {
        process.exit(toSignalExitCode(signal));
        return;
      }

      process.exit(code ?? EXIT_CODE.failure);
    });
  }
}

async function prepareRuntime() {
  await runBlockingScript(SCRIPT_NAMES.dbCreate);
  await runBlockingScript(SCRIPT_NAMES.backendBuild);
}

function startRuntimeProcesses() {
  return [
    startLongRunningScript(SCRIPT_NAMES.backendStart),
    startLongRunningScript(SCRIPT_NAMES.frontendDev),
  ];
}

async function main() {
  await prepareRuntime();
  const childProcesses = startRuntimeProcesses();
  registerForwardedSignals(childProcesses);
  registerChildExitHandlers(childProcesses);
}

await main();
