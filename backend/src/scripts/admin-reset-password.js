import { Writable } from 'node:stream'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { randomBytes } from 'node:crypto'
import { hashPassword } from '../auth.js'
import { getUserCredentialByEmail, initializeStore, revokeAuthSessionsByUser, updateUserPasswordRecord } from '../store.js'

class MutableOutput extends Writable {
  constructor(target) {
    super()
    this.target = target
    this.muted = false
  }

  _write(chunk, encoding, callback) {
    if (!this.muted) {
      this.target.write(chunk, encoding)
    }
    callback()
  }
}

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function parseArgs(argv) {
  const options = {
    email: '',
    password: '',
    autoPassword: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (current === '--help' || current === '-h') {
      options.help = true
      continue
    }

    if (current === '--auto-password') {
      options.autoPassword = true
      continue
    }

    if (current === '--email' || current === '--password') {
      const nextValue = argv[index + 1]
      if (!nextValue) {
        throw new Error(`Argumento ausente para ${current}.`)
      }

      if (current === '--email') {
        options.email = nextValue
      } else {
        options.password = nextValue
      }

      index += 1
      continue
    }

    if (current.startsWith('--email=')) {
      options.email = current.slice('--email='.length)
      continue
    }

    if (current.startsWith('--password=')) {
      options.password = current.slice('--password='.length)
      continue
    }

    throw new Error(`Argumento inválido: ${current}`)
  }

  return options
}

function printHelp() {
  console.log('Uso:')
  console.log('  npm run admin:reset-password -- --email admin@salon.com [--auto-password]')
  console.log('  npm run admin:reset-password -- --email admin@salon.com --password "NovaSenhaForte"')
  console.log('')
  console.log('Opcoes:')
  console.log('  --email  E-mail do administrador alvo.')
  console.log('  --password  Nova senha (opcional).')
  console.log('  --auto-password  Gera senha temporaria automaticamente.')
  console.log('  -h, --help  Exibe esta ajuda.')
}

function generateTemporaryPassword() {
  return randomBytes(18).toString('base64url')
}

async function askWithDefault(rl, label, defaultValue) {
  const suffix = defaultValue ? ` (${defaultValue})` : ''
  const answer = (await rl.question(`${label}${suffix}: `)).trim()
  return answer || defaultValue
}

async function askHidden(rl, mutableOutput, label) {
  output.write(`${label}: `)
  mutableOutput.muted = true
  const value = await rl.question('')
  mutableOutput.muted = false
  output.write('\n')
  return value
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  await initializeStore()

  const mutableOutput = new MutableOutput(output)
  const rl = readline.createInterface({
    input,
    output: mutableOutput,
    terminal: true,
  })

  try {
    const providedEmail = options.email.trim().toLowerCase()
    const email = providedEmail
      ? providedEmail
      : (await askWithDefault(rl, 'Email do admin', '')).trim().toLowerCase()

    if (!isEmail(email) || email.length > 254) {
      throw new Error('Informe um email valido.')
    }

    const target = await getUserCredentialByEmail(email)
    if (!target) {
      throw new Error('Administrador nao encontrado para o e-mail informado.')
    }

    if (target.role !== 'admin') {
      throw new Error('O e-mail informado pertence a um usuario sem perfil admin.')
    }

    let password = ''
    let usedAutoPassword = options.autoPassword

    if (options.password) {
      password = options.password
    } else if (options.autoPassword) {
      password = generateTemporaryPassword()
    } else {
      const typedPassword = await askHidden(rl, mutableOutput, 'Nova senha (deixe vazio para gerar automaticamente)')
      if (!typedPassword) {
        password = generateTemporaryPassword()
        usedAutoPassword = true
      } else {
        if (typedPassword.length < 8 || typedPassword.length > 1024) {
          throw new Error('A senha deve ter entre 8 e 1024 caracteres.')
        }

        const confirmPassword = await askHidden(rl, mutableOutput, 'Confirmar nova senha')
        if (confirmPassword !== typedPassword) {
          throw new Error('As senhas nao conferem.')
        }

        password = typedPassword
      }
    }

    if (password.length < 8 || password.length > 1024) {
      throw new Error('A senha deve ter entre 8 e 1024 caracteres.')
    }

    const updated = await updateUserPasswordRecord(target.id, hashPassword(password), {
      mustChangePassword: true,
    })
    await revokeAuthSessionsByUser(target.id)

    console.log('')
    console.log(`Senha redefinida com sucesso para: ${updated.email}`)
    console.log('Troca obrigatoria no proximo login: ativa.')
    console.log('Sessoes ativas do usuario foram revogadas.')
    if (usedAutoPassword) {
      console.log(`Senha temporaria gerada: ${password}`)
    }
  } finally {
    rl.close()
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : 'Erro ao redefinir senha do administrador.'
  if (typeof message === 'string' && message.startsWith('VALIDATION:')) {
    console.error(message.replace('VALIDATION:', '').trim())
  } else {
    console.error(message)
  }
  process.exit(1)
})
