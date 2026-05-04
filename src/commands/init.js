import fs from "fs-extra";
import os from "os";
import path from "path";
import YAML from "yaml";
import inquirer from "inquirer";
import { execa } from "execa";

async function resolveAwsCli() {
  const candidates = ["aws", "/usr/local/bin/aws", "/opt/homebrew/bin/aws"];

  for (const candidate of candidates) {
    try {
      await execa(candidate, ["--version"]);
      return candidate;
    } catch {}
  }

  return null;
}

export async function init() {
  const configDir = path.join(os.homedir(), ".ssm-tool");
  const configFile = path.join(configDir, "config.yaml");

  const awsCli = await resolveAwsCli();

  if (!awsCli) {
    console.log("");
    console.log("⚠️ AWS CLI não encontrado.");
    console.log("Rode:");
    console.log("  ssm doctor");
    return;
  }

  const { profile } = await inquirer.prompt([
    {
      name: "profile",
      message: "Qual profile AWS você quer usar?",
      default: "MeuPerfilDeAcesso"
    }
  ]);

  await fs.ensureDir(configDir);

  let profileExists = true;

  try {
    await execa(awsCli, [
      "configure",
      "list",
      "--profile",
      profile
    ]);
  } catch {
    profileExists = false;
  }

  if (!profileExists) {
    console.log("");
    console.log(`🔐 Profile "${profile}" não encontrado.`);
    console.log("➡️ Vamos configurar o AWS SSO agora...");
    console.log("");

    await execa(
      awsCli,
      ["configure", "sso", "--profile", profile],
      { stdio: "inherit" }
    );
  }

  if (await fs.pathExists(configFile)) {
    console.log("");
    console.log("⚠️ Config já existe:");
    console.log(`📄 ${configFile}`);
    return;
  }

  const config = {
    profile,
    defaultRegion: "us-east-1",
    defaultLocalDbPort: 13306,
    servers: []
  };

  await fs.writeFile(configFile, YAML.stringify(config));

  console.log("");
  console.log("✅ CLI inicializada com sucesso!");
  console.log(`📄 Arquivo criado: ${configFile}`);
}