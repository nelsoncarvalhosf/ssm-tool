import fs from "fs-extra";
import os from "os";
import path from "path";
import YAML from "yaml";
import inquirer from "inquirer";
import { execa } from "execa";

/**
 * Resolve AWS CLI em qualquer OS
 */
async function resolveAwsCli() {
  const candidates = ["aws", "/usr/local/bin/aws", "/opt/homebrew/bin/aws"];

  for (const candidate of candidates) {
    try {
      await execa(candidate, ["--version"]);
      return candidate;
    } catch {}
  }

  throw new Error("AWS CLI não encontrado. Rode: ssm doctor");
}

/**
 * Garante sessão SSO válida
 */
async function ensureSSOSession(awsCli, profile) {
  try {
    await execa(
      awsCli,
      ["sts", "get-caller-identity", "--profile", profile],
      { stdio: "ignore" }
    );
  } catch {
    console.log("");
    console.log("🔐 Sessão SSO inválida ou expirada. Fazendo login...");
    console.log("");

    await execa(
      awsCli,
      ["sso", "login", "--profile", profile],
      { stdio: "inherit" }
    );

    console.log("");
  }
}

function getErrorOutput(error) {
  return `${error.stderr || ""}\n${error.stdout || ""}\n${error.message || ""}`;
}

function isInteractiveDenied(output) {
  return (
    output.includes("AccessDeniedException") &&
    output.includes("AWS-StartInteractiveCommand")
  );
}

/**
 * Sessão padrão (sempre funciona)
 */
async function startDefaultSession({ awsCli, profile, region, target }) {
  console.log("");
  console.log("➡️ Abrindo sessão padrão do SSM...");
  console.log("");

  await execa(
    awsCli,
    [
      "ssm",
      "start-session",
      "--profile",
      profile,
      "--region",
      region,
      "--target",
      target
    ],
    { stdio: "inherit" }
  );
}

/**
 * Sessão avançada (com sudo + path)
 */
async function startAdvancedSession({
  awsCli,
  profile,
  region,
  target,
  command
}) {
  try {
    await execa(
      awsCli,
      [
        "ssm",
        "start-session",
        "--profile",
        profile,
        "--region",
        region,
        "--target",
        target,
        "--document-name",
        "AWS-StartInteractiveCommand",
        "--parameters",
        JSON.stringify({ command: [command] })
      ],
      { stdio: "inherit" }
    );
  } catch (error) {
    const output = getErrorOutput(error);

    if (isInteractiveDenied(output)) {
      console.log("");
      console.log("⚠️ Sem permissão para comando avançado.");
      console.log("➡️ Conectando em modo básico...");
      console.log("");
      console.log("👉 Depois rode:");
      console.log("   sudo su");
      console.log("   cd /var/www");
      console.log("");

      await startDefaultSession({ awsCli, profile, region, target });
      return;
    }

    throw error;
  }
}

/**
 * CONNECT PRINCIPAL
 */
export async function connect(options = {}) {
  const configFile = path.join(os.homedir(), ".ssm-tool", "config.yaml");

  if (!(await fs.pathExists(configFile))) {
    console.log("⚠️ Config não encontrada. Rode: ssm init");
    return;
  }

  const content = await fs.readFile(configFile, "utf-8");
  const config = YAML.parse(content) || {};
  const servers = Array.isArray(config.servers) ? config.servers : [];

  if (!servers.length) {
    console.log("⚠️ Nenhum servidor cadastrado. Rode: ssm add");
    return;
  }

  const awsCli = await resolveAwsCli();

  const { selectedServer } = await inquirer.prompt([
    {
      type: "rawlist",
      name: "selectedServer",
      message: "Escolha o servidor:",
      choices: servers.map((server) => ({
        name: `${server.name} (${server.region || config.defaultRegion || "us-east-1"})`,
        value: server
      }))
    }
  ]);

  const profile = config.profile || "default";
  const region = selectedServer.region || config.defaultRegion || "us-east-1";
  const target = selectedServer.instanceId;
  const startPath = selectedServer.path || "/var/www";

  if (!target) {
    console.log("⚠️ Servidor sem Instance ID.");
    return;
  }

  await ensureSSOSession(awsCli, profile);

  /**
   * 🔹 TÚNEL DB
   */
  if (options.tunnel) {
    const remotePort = selectedServer.db?.remotePort || 3306;
    const localPort =
      selectedServer.db?.localPort || config.defaultLocalDbPort || 13306;

    console.log("");
    console.log(`🗄️ Túnel DB: ${selectedServer.name}`);
    console.log(`Local: 127.0.0.1:${localPort}`);
    console.log(`Remoto: ${remotePort}`);
    console.log("");

    await execa(
      awsCli,
      [
        "ssm",
        "start-session",
        "--profile",
        profile,
        "--region",
        region,
        "--target",
        target,
        "--document-name",
        "AWS-StartPortForwardingSession",
        "--parameters",
        JSON.stringify({
          portNumber: [String(remotePort)],
          localPortNumber: [String(localPort)]
        })
      ],
      { stdio: "inherit" }
    );

    return;
  }

  /**
   * 🔹 CONEXÃO NORMAL
   */
  const useAdvanced = selectedServer.advancedCommand !== false;
  const useSudo = selectedServer.useSudo !== false;

  const command = useSudo
    ? `sudo su - -c "cd ${startPath} && exec bash"`
    : `cd ${startPath} && exec bash`;

  console.log("");
  console.log(`🚀 Conectando em: ${selectedServer.name}`);
  console.log("");

  if (!useAdvanced) {
    await startDefaultSession({ awsCli, profile, region, target });
    return;
  }

  await startAdvancedSession({
    awsCli,
    profile,
    region,
    target,
    command
  });
}