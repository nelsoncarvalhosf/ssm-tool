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

  const servers = config.servers || [];

  if (!servers.length) {
    console.log("⚠️ Nenhum servidor cadastrado. Rode: ssm add");
    return;
  }

  console.log("\n📋 Servidores cadastrados:\n");

  servers.forEach((server, index) => {
    console.log(`${index + 1}. ${server.name}`);
    console.log(`   Instance ID: ${server.instanceId}`);
    console.log(`   Region: ${server.region}`);
    console.log(`   Path: ${server.path || "/var/www"}`);
    console.log("");
  });
}