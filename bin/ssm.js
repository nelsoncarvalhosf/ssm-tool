#!/usr/bin/env node

import { Command } from "commander";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { init } from "../src/commands/init.js";
import { add } from "../src/commands/add.js";
import { list } from "../src/commands/list.js";
import { connect } from "../src/commands/connect.js";
import { doctor } from "../src/commands/doctor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packagePath = path.resolve(__dirname, "../package.json");
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf-8"));

const program = new Command();

program
  .name("ssm")
  .description("CLI para gerenciar conexões AWS SSM")
  .version(packageJson.version);

program
  .command("init")
  .description("Inicializar configuração")
  .action(init);

program
  .command("add")
  .description("Adicionar servidor")
  .action(add);

program
  .command("list")
  .description("Listar servidores")
  .action(list);

program
  .command("connect")
  .description("Conectar em um servidor via SSM")
  .option("-t, --tunnel", "Abrir túnel para banco")
  .action(connect);

program
  .command("doctor")
  .description("Verificar ambiente")
  .action(doctor);

program
  .action(connect);  

program.parse();