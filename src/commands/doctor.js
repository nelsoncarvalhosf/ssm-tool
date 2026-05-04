import fs from "fs-extra";
import os from "os";
import path from "path";
import YAML from "yaml";
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

function getInstallInstructions(tool) {
  const platform = os.platform();

  if (tool === "aws") {
    if (platform === "darwin") {
      return `
Instale o AWS CLI no macOS:

  brew install awscli

Ou via instalador oficial:
  https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html`;
    }

    if (platform === "linux") {
      return `
Instale o AWS CLI no Linux:

  curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "/tmp/awscliv2.zip"
  unzip -o /tmp/awscliv2.zip -d /tmp
  sudo /tmp/aws/install --update`;
    }

    if (platform === "win32") {
      return `
Instale o AWS CLI no Windows:

  winget install Amazon.AWSCLI

Ou via instalador oficial:
  https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html`;
    }
  }

  if (tool === "session-manager-plugin") {
    if (platform === "darwin") {
      return `
Instale o Session Manager Plugin no macOS:

  brew install --cask session-manager-plugin

Ou veja a documentação:
  https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html`;
    }

    if (platform === "linux") {
      return `
Instale o Session Manager Plugin no Linux:

Ubuntu/Debian:
  curl "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb" -o "/tmp/session-manager-plugin.deb"
  sudo dpkg -i /tmp/session-manager-plugin.deb

Amazon Linux / RHEL:
  curl "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/linux_64bit/session-manager-plugin.rpm" -o "/tmp/session-manager-plugin.rpm"
  sudo yum install -y /tmp/session-manager-plugin.rpm`;
    }

    if (platform === "win32") {
      return `
Instale o Session Manager Plugin no Windows:

  winget install Amazon.SessionManagerPlugin

Ou veja a documentação:
  https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html`;
    }
  }

  return `
Consulte a documentação oficial:
  https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
  https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html`;
}

function formatError(error) {
  const message =
    error?.shortMessage ||
    error?.stderr ||
    error?.stdout ||
    error?.message ||
    "Erro desconhecido";

  return String(message);
}

function printIndented(text) {
  String(text)
    .trim()
    .split("\n")
    .forEach((line) => {
      console.log(`   ${line}`);
    });
}

export async function doctor() {
  const configFile = path.join(os.homedir(), ".ssm-tool", "config.yaml");

  console.log("");
  console.log("🩺 SSM Doctor");
  console.log("");

  let hasError = false;
  let awsCli = null;

  async function check(label, fn) {
    try {
      await fn();
      console.log(`✅ ${label}`);
    } catch (error) {
      hasError = true;
      console.log(`❌ ${label}`);
      printIndented(formatError(error));
      console.log("");
    }
  }

  await check("AWS CLI instalado", async () => {
    awsCli = await resolveAwsCli();

    if (!awsCli) {
      throw new Error(`AWS CLI não encontrado.

${getInstallInstructions("aws")}`);
    }
  });

  if (awsCli) {
    console.log(`   usando: ${awsCli}`);
  }

  await check("Session Manager Plugin instalado", async () => {
    try {
      await execa("session-manager-plugin", ["--version"]);
    } catch {
      throw new Error(`Session Manager Plugin não encontrado no PATH.

${getInstallInstructions("session-manager-plugin")}`);
    }
  });

  let config = null;

  await check("Arquivo de configuração encontrado", async () => {
    if (!(await fs.pathExists(configFile))) {
      throw new Error(`Arquivo não encontrado: ${configFile}

Rode:
  ssm init`);
    }

    const content = await fs.readFile(configFile, "utf-8");
    config = YAML.parse(content);

    if (!config || typeof config !== "object") {
      throw new Error("config.yaml inválido ou vazio.");
    }
  });

  if (!config) {
    return;
  }

  await check("Profile configurado", async () => {
    if (!config.profile) {
      throw new Error(`Campo "profile" não encontrado no config.yaml.`);
    }
  });

  if (config.profile && awsCli) {
    await check(`Profile AWS válido: ${config.profile}`, async () => {
      try {
        await execa(awsCli, [
          "sts",
          "get-caller-identity",
          "--profile",
          config.profile
        ]);
      } catch (error) {
        const output = formatError(error);

        if (
          output.includes("The config profile") ||
          output.includes("could not be found")
        ) {
          throw new Error(`Profile AWS não encontrado.

Configure o profile com:
  ${awsCli} configure sso --profile ${config.profile}

Ou rode:
  ssm init`);
        }

        if (
          output.includes("Token has expired") ||
          output.includes("refresh failed") ||
          output.includes("UnauthorizedException")
        ) {
          throw new Error(`Sessão SSO expirada.

Rode:
  ${awsCli} sso login --profile ${config.profile}`);
        }

        if (output.includes("No AWS accounts are available to you")) {
          throw new Error(`Nenhuma conta AWS disponível para este usuário.

Isso significa que o login SSO funcionou, mas o usuário não está associado a nenhuma conta no IAM Identity Center.

Corrija em:
  IAM Identity Center > AWS accounts > Assign users or groups`);
        }

        if (
          output.includes("ForbiddenException") ||
          output.includes("GetRoleCredentials") ||
          output.includes("No access")
        ) {
          throw new Error(`Sem acesso ao role configurado no profile.

O usuário loga no SSO, mas não consegue assumir o role da conta.

Verifique:
  AWS Access Portal
  IAM Identity Center > AWS accounts > Assigned users/groups

Depois rode:
  ${awsCli} sso login --profile ${config.profile}`);
        }

        throw error;
      }
    });
  }

  await check("Servidores cadastrados", async () => {
    if (!Array.isArray(config.servers) || config.servers.length === 0) {
      throw new Error(`Nenhum servidor cadastrado.

Rode:
  ssm add`);
    }
  });

  if (Array.isArray(config.servers)) {
    for (const server of config.servers) {
      await check(`Servidor válido: ${server.name || "sem nome"}`, async () => {
        if (!server.name) throw new Error("Servidor sem name.");
        if (!server.instanceId) throw new Error("Servidor sem instanceId.");
        if (!server.region) throw new Error("Servidor sem region.");
        if (!server.path) throw new Error("Servidor sem path.");
      });
    }
  }

  console.log("");

  if (hasError) {
    console.log("⚠️ Foram encontrados problemas.");
    console.log("Corrija os itens acima e rode novamente:");
    console.log("  ssm doctor");
    return;
  }

  console.log("🎉 Tudo certo! Ambiente pronto para usar o SSM CLI.");
}