import inquirer from "inquirer";
import fs from "fs-extra";
import os from "os";
import path from "path";
import YAML from "yaml";

export async function add() {
  const answers = await inquirer.prompt([
    {
      name: "name",
      message: "Nome do servidor:"
    },
    {
      name: "instanceId",
      message: "Instance ID:"
    },
    {
      name: "region",
      message: "Região:",
      default: "us-east-1"
    },
    {
      name: "path",
      message: "Diretório inicial:",
      default: "/var/www"
    },
    {
      type: "confirm",
      name: "useSudo",
      message: "Logar como root?",
      default: true
    }
  ]);

  const configDir = path.join(os.homedir(), ".ssm-tool");
  const configFile = path.join(configDir, "config.yaml");

  await fs.ensureDir(configDir);

  let config = {
    profile: "MeuPerfilDeAcesso",
    defaultRegion: "us-east-1",
    servers: []
  };

  if (await fs.pathExists(configFile)) {
    const content = await fs.readFile(configFile, "utf-8");
    config = YAML.parse(content) || config;
  }

  if (!Array.isArray(config.servers)) {
    config.servers = [];
  }

  config.servers.push({
    name: answers.name,
    instanceId: answers.instanceId,
    region: answers.region,
    path: answers.path || "/var/www",
    useSudo: answers.useSudo
  });

  await fs.writeFile(configFile, YAML.stringify(config));

  console.log("✅ Servidor salvo com sucesso!");
}