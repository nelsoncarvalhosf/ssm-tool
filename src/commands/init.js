import fs from "fs-extra";
import os from "os";
import path from "path";
import YAML from "yaml";
import inquirer from "inquirer";
import { execa } from "execa";

export async function init() {
  const configDir = path.join(os.homedir(), ".ssm-tool");
  const configFile = path.join(configDir, "config.yaml");

  const { profile } = await inquirer.prompt([
    {
      name: "profile",
      message: "Qual profile AWS você quer usar?",
      default: "MeuPerfilDeAcesso"
    }
  ]);

  await fs.ensureDir(configDir);

  // 🔍 verifica se profile já existe
  let profileExists = true;

  try {
    await execa("/usr/local/bin/aws", [
      "configure",
      "list",
      "--profile",
      profile
    ]);
  } catch (e) {
    profileExists = false;
  }

  // 🚀 se não existir → configurar SSO
  if (!profileExists) {
    console.log("");
    console.log(`🔐 Profile "${profile}" não encontrado.`);
    console.log("➡️ Vamos configurar o AWS SSO agora...");
    console.log("");

    await execa(
      "/usr/local/bin/aws",
      ["configure", "sso", "--profile", profile],
      { stdio: "inherit" }
    );
  }

  // ⚠️ não sobrescrever config existente
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