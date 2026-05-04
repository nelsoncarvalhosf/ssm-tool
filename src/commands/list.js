import fs from "fs-extra";
import os from "os";
import path from "path";
import YAML from "yaml";

export async function list() {
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

  console.log("\n📋 Servidores cadastrados:\n");

  servers.forEach((server, index) => {
    const region = server.region || config.defaultRegion || "us-east-1";
    const pathDir = server.path || "/var/www";
    const useSudo = server.useSudo !== false;

    console.log(`${index + 1}. ${server.name || "Sem nome"}`);
    console.log(`   Instance ID: ${server.instanceId || "-"}`);
    console.log(`   Region: ${region}`);
    console.log(`   Path: ${pathDir}`);
    console.log(`   Sudo: ${useSudo ? "Sim" : "Não"}`);

    if (server.db) {
      console.log(`   DB Remote: ${server.db.remotePort || 3306}`);
      console.log(`   DB Local: ${server.db.localPort || 13306}`);
    }

    console.log("");
  });
}