import fs from "fs-extra";
import os from "os";
import path from "path";
import YAML from "yaml";
import { execa } from "execa";

export async function doctor() {
  const configFile = path.join(os.homedir(), ".ssm-tool", "config.yaml");

  console.log("");
  console.log("🩺 SSM Doctor");
  console.log("");

  let hasError = false;

  async function check(label, fn) {
    try {
      await fn();
      console.log(`✅ ${label}`);
    } catch (error) {
      hasError = true;
      console.log(`❌ ${label}`);
      if (error.message) {
        console.log(`   ${error.message.split("\n")[0]}`);
      }
    }
  }

  await check("AWS CLI instalado", async () => {
    await execa("/usr/local/bin/aws", ["--version"]);
  });

  await check("Session Manager Plugin instalado", async () => {
    await execa("session-manager-plugin", ["--version"]);
  });

  let config = null;

  await check("Arquivo de configuração encontrado", async () => {
    if (!(await fs.pathExists(configFile))) {
      throw new Error(`Arquivo não encontrado: ${configFile}`);
    }

    const content = await fs.readFile(configFile, "utf-8");
    config = YAML.parse(content);
  });

  if (!config) {
    console.log("");
    console.log("➡️ Rode: ssm init");
    return;
  }

  await check("Profile configurado", async () => {
    if (!config.profile) {
      throw new Error("Campo profile não encontrado no config.yaml");
    }
  });

  await check(`Profile AWS válido: ${config.profile}`, async () => {
    await execa("/usr/local/bin/aws", [
      "sts",
      "get-caller-identity",
      "--profile",
      config.profile
    ]);
  });

  await check("Servidores cadastrados", async () => {
    if (!Array.isArray(config.servers) || config.servers.length === 0) {
      throw new Error("Nenhum servidor cadastrado. Rode: ssm add");
    }
  });

  if (Array.isArray(config.servers)) {
    for (const server of config.servers) {
      await check(`Servidor válido: ${server.name}`, async () => {
        if (!server.name) throw new Error("Servidor sem name");
        if (!server.instanceId) throw new Error("Servidor sem instanceId");
        if (!server.region) throw new Error("Servidor sem region");
      });
    }
  }

  console.log("");

  if (hasError) {
    console.log("⚠️ Foram encontrados problemas.");
    console.log("Corrija os itens acima e rode novamente: ssm doctor");
    return;
  }

  console.log("🎉 Tudo certo! Ambiente pronto para usar o SSM CLI.");
}