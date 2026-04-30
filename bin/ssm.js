#!/usr/bin/env node

import { Command } from "commander";
import { init } from "../src/commands/init.js";
import { add } from "../src/commands/add.js";
import { list } from "../src/commands/list.js";
import { connect } from "../src/commands/connect.js";
import { doctor } from "../src/commands/doctor.js";

const program = new Command();

program
  .name("ssm")
  .description("🚀 CLI para gerenciar conexões AWS SSM")
  .version("0.1.0");

program
  .command("init")
  .description("Inicializar configuração da CLI")
  .action(init);

program
  .command("add")
  .description("Adicionar servidor")
  .action(add);

program
  .command("list")
  .description("Listar servidores cadastrados")
  .action(list);
  
program
  .command("connect")
  .description("Conectar em um servidor via SSM")
  .option("-t, --tunnel", "Abrir túnel para banco")
  .action(connect); 

program
  .command("doctor")
  .description("Verificar ambiente e configuração")
  .action(doctor);
  
program
  .action(connect);

program.parse();