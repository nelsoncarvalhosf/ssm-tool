import inquirer from "inquirer";
import fs from "fs-extra";
import os from "os";
import path from "path";
import YAML from "yaml";

export async function add() {
  const configDir = path.join(os.homedir(), ".ssm-tool");
  const configFile = path.join(configDir, "config.yaml");

  await fs.ensureDir(configDir);

  let config = {
    profile: "MeuPerfilDeAcesso",
    defaultRegion: "us-east-1",
    defaultLocalDbPort: 13306,
    servers: []
  };

  if (await fs.pathExists(configFile)) {
    const content = await fs.readFile(configFile, "utf-8");
    config = YAML.parse(content) || config;
  }

  if (!Array.isArray(config.servers)) {
    config.servers = [];
  }

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
      default: config.defaultRegion || "us-east-1"
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
    },
    {
      type: "confirm",
      name: "enableDbTunnel",
      message: "Configurar túnel de banco?",
      default: true
    },
    {
      name: "remotePort",
      message: "Porta remota do banco:",
      default: "3306",
      when: (answers) => answers.enableDbTunnel
    },
    {
      name: "localPort",
      message: "Porta local do túnel:",
      default: String(config.defaultLocalDbPort || 13306),
      when: (answers) => answers.enableDbTunnel
    }
  ]);

  const exists = config.servers.some(
    (server) =>
      server.name?.toLowerCase() === answers.name.toLowerCase() ||
      server.instanceId === answers.instanceId
  );

  if (exists) {
    console.log("⚠️ Já existe um servidor com esse nome ou Instance ID.");
    return;
  }

  const server = {
    name: answers.name,
    instanceId: answers.instanceId,
    region: answers.region,
    path: answers.path || "/var/www",
    useSudo: answers.useSudo
  };

  if (answers.enableDbTunnel) {
    server.db = {
      remotePort: Number(answers.remotePort || 3306),
      localPort: Number(answers.localPort || config.defaultLocalDbPort || 13306)
    };
  }

  config.servers.push(server);

  await fs.writeFile(configFile, YAML.stringify(config));

  console.log("✅ Servidor salvo com sucesso!");
}