import 'dotenv/config';
import * as argon2 from 'argon2';
import { OfficerRole } from '../dist/generated/prisma/enums.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import { createInterface } from 'node:readline';
import { StringDecoder } from 'node:string_decoder';

if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be supplied by the production host.');
}
if (!process.env.DATABASE_URL) {
  throw new Error('Set DATABASE_URL in backend/.env before provisioning.');
}
if (!process.stdin.isTTY || !process.stdin.setRawMode) {
  throw new Error('Run this command in an interactive terminal.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const localDemoMode = process.argv.includes('--local-demo');

if (localDemoMode) {
  const databaseHost = new URL(process.env.DATABASE_URL).hostname;
  if (
    process.env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1', '::1'].includes(databaseHost)
  ) {
    throw new Error(
      'Local demo provisioning requires a non-production loopback database.',
    );
  }
}

function ask(question) {
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    prompt.question(question, (answer) => {
      prompt.close();
      resolve(answer);
    }),
  );
}

function askHidden(question) {
  process.stdout.write(question);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  const decoder = new StringDecoder('utf8');
  let value = '';
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdout.write('\n');
    };
    const onData = (chunk) => {
      const input = decoder.write(chunk);
      for (const character of input) {
        if (character === '\u0003') {
          cleanup();
          reject(new Error('Provisioning cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          cleanup();
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
        } else if (character >= ' ') {
          value += character;
        }
      }
    };
    process.stdin.on('data', onData);
  });
}

try {
  process.stdout.write(
    localDemoMode
      ? 'LOCAL ONLY: this adds credentials to the existing authorized-officer account; it does not create or change a user.\n'
      : 'This adds credentials to an existing officer; it does not create or change a user.\n',
  );
  const confirmationPhrase = localDemoMode ? 'LOCAL DEMO' : 'PROVISION';
  const confirmed = await ask(`Type ${confirmationPhrase} to continue: `);
  if (confirmed !== confirmationPhrase) {
    throw new Error('Provisioning cancelled.');
  }
  const officerId = localDemoMode
    ? 'demo-authorized-officer'
    : (await ask('Existing authorized officer ID: ')).trim();
  const username = (await ask('Reviewer username: '))
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US');
  const password = await askHidden('New reviewer password (hidden): ');
  const confirmation = await askHidden('Confirm reviewer password (hidden): ');

  if (!officerId || !/^[\p{L}\p{N}._@ -]{3,64}$/u.test(username)) {
    throw new Error('Enter a valid officer ID and username.');
  }
  if (
    password.length > 128 ||
    (!localDemoMode && password.length < 12) ||
    (localDemoMode && password.length === 0) ||
    password !== confirmation
  ) {
    throw new Error(
      localDemoMode
        ? 'The passwords must match and contain between 1 and 128 characters.'
        : 'Passwords must match and contain between 12 and 128 characters.',
    );
  }

  const officer = await prisma.user.findUnique({
    where: { id: officerId },
    select: { id: true, isActive: true, role: true },
  });
  if (!officer?.isActive || officer.role !== OfficerRole.AUTHORIZED_OFFICER) {
    throw new Error(
      'Credentials can only be attached to an existing active authorized officer.',
    );
  }

  const existingCredential = await prisma.officerCredential.findUnique({
    where: { userId: officer.id },
    select: { userId: true },
  });
  if (existingCredential) {
    throw new Error(
      'This officer already has credentials. Refusing to overwrite them.',
    );
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  await prisma.$transaction([
    prisma.officerCredential.create({
      data: { userId: officer.id, username, passwordHash },
    }),
  ]);
  process.stdout.write('Reviewer credentials provisioned successfully.\n');
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Provisioning failed.'}\n`,
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
