import { Writable } from 'node:stream'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { randomBytes } from 'node:crypto'
import { hashPassword } from '../auth.js'
import { countActiveAdminUsers, createUserRecord, initializeStore } from '../store.js'

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
    force: false,
    name: '',
    email: '',
    autoPassword: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (current === '--help' || current === '-h') {
      options.help = true
      continue
    }

    if (current === '--force') {
      options.force = true
      continue
    }

    if (current === '--auto-password') {
      options.autoPassword = true
      continue
    }

    if (current === '--name' || current === '--email') {
      const nextValue = argv[index + 1]
      if (!nextValue) {
        throw new Error(`Argumento ausente para ${current}.`)
      }

      if (current === '--name') {
        options.name = nextValue
      } else {
        options.email = nextValue
      }
      index += 1
      continue
    }

    if (current.startsWith('--name=')) {
      options.name = current.slice('--name='.length)
      continue
    }

    if (current.startsWith('--email=')) {
      options.email = current.slice('--email='.length)
      continue
    }

    throw new Error(`Argumento inválido: ${current}`)
  }

  return options
}

function printHelp() {
  console.log('Uso:')
  console.log('  npm run admin:create [-- --name "Nome" --email admin@salon.com] [--force] [--auto-password]')
  console.log('')
  console.log('Opcoes:')
  console.log('  --name   Nome inicial do administrador (opcional).')
  console.log('  --email  Email do administrador (opcional).')
  console.log('  --force  Permite criar novo admin mesmo se ja existir admin ativo.')
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

  const activeAdmins = await countActiveAdminUsers()
  if (activeAdmins > 0 && !options.force) {
    throw new Error('Ja existe administrador ativo. Use --force para criar outro admin.')
  }

  const mutableOutput = new MutableOutput(output)
  const rl = readline.createInterface({
    input,
    output: mutableOutput,
    terminal: true,
  })

  try {
    const defaultName = options.name.trim() || 'Administrador'
    const defaultEmail = options.email.trim().toLowerCase()

    const name = (await askWithDefault(rl, 'Nome do admin', defaultName)).trim()
    if (!name) {
      throw new Error('Nome e obrigatorio.')
    }

    if (name.length > 120) {
      throw new Error('Nome deve ter no maximo 120 caracteres.')
    }

    const email = (await askWithDefault(rl, 'Email do admin', defaultEmail)).trim().toLowerCase()
    if (!isEmail(email) || email.length > 254) {
      throw new Error('Informe um email valido.')
    }

    let password = ''
    let usedAutoPassword = options.autoPassword

    if (options.autoPassword) {
      password = generateTemporaryPassword()
    } else {
      const typedPassword = await askHidden(rl, mutableOutput, 'Senha (deixe vazio para gerar automaticamente)')
      if (!typedPassword) {
        password = generateTemporaryPassword()
        usedAutoPassword = true
      } else {
        if (typedPassword.length < 8 || typedPassword.length > 1024) {
          throw new Error('A senha deve ter entre 8 e 1024 caracteres.')
        }

        const confirmPassword = await askHidden(rl, mutableOutput, 'Confirmar senha')
        if (confirmPassword !== typedPassword) {
          throw new Error('As senhas nao conferem.')
        }

        password = typedPassword
      }
    }

    const created = await createUserRecord({
      name,
      email,
      passwordHash: hashPassword(password),
      role: 'admin',
      mustChangePassword: true,
    })

    console.log('')
    console.log(`Admin criado com sucesso: ${created.email}`)
    console.log('Troca de senha obrigatoria no primeiro login: ativa.')
    if (usedAutoPassword) {
      console.log(`Senha temporaria do admin: ${password}`)
    }
  } finally {
    rl.close()
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : 'Erro ao criar administrador.'

  if (typeof message === 'string' && message.startsWith('CONFLICT:')) {
    console.error(message.replace('CONFLICT:', '').trim())
  } else if (typeof message === 'string' && message.startsWith('VALIDATION:')) {
    console.error(message.replace('VALIDATION:', '').trim())
  } else {
    console.error(message)
  }

  process.exit(1)
})
