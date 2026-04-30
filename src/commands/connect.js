import fs from "fs-extra";
import os from "os";
import path from "path";
import YAML from "yaml";
import inquirer from "inquirer";
import { execa } from "execa";

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

  const { selectedServer } = await inquirer.prompt([
    {
      type: "rawlist",
      name: "selectedServer",
      message: "Escolha o servidor:",
      choices: servers.map((server) => ({
        name: `${server.name} (${server.region})`,
        value: server
      }))
    }
  ]);

  const profile = config.profile || "default";
  const region = selectedServer.region || config.defaultRegion || "us-east-1";
  const target = selectedServer.instanceId;
  const startPath = selectedServer.path || "/var/www";

  if (options.tunnel) {
    const remotePort = selectedServer.db?.remotePort || 3306;
    const localPort = selectedServer.db?.localPort || config.defaultLocalDbPort || 13306;

    console.log("");
    console.log(`🗄️ Abrindo túnel para: ${selectedServer.name}`);
    console.log(`Host: 127.0.0.1`);
    console.log(`Porta: ${localPort}`);
    console.log("");

    await execa(
      "/usr/local/bin/aws",
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

  const useSudo = selectedServer.useSudo !== false;

  const command = useSudo
    ? `sudo su - -c "cd ${startPath} && exec bash"`
    : `cd ${startPath} && exec bash`;

  console.log("");
  console.log(`🚀 Conectando em: ${selectedServer.name}`);
  console.log("");

  await execa(
    "/usr/local/bin/aws",
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
}