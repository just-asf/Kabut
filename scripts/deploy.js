const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');

function loadEnv() {
  if (!fs.existsSync(envPath)) {
    console.error('Error: .env file not found at project root.');
    process.exit(1);
  }
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/(^['"]|['"]$)/g, '');
      env[key] = value;
    }
  });
  return env;
}

const env = loadEnv();

const token = env.SUPABASE_ACCESS_TOKEN;
const dbPassword = env.SUPABASE_DB_PASSWORD;

if (!token || !dbPassword) {
  console.error('\n--- DEPLOYMENT ERROR ---');
  console.error('Missing required deployment environment variables in .env:');
  if (!token) console.error('  - SUPABASE_ACCESS_TOKEN');
  if (!dbPassword) console.error('  - SUPABASE_DB_PASSWORD');
  console.error('\nPlease run the following commands to add them to your .env:');
  console.error('  printf "Enter SUPABASE_ACCESS_TOKEN (typing hidden): " && read -s val && echo && echo "SUPABASE_ACCESS_TOKEN=$val" >> ".env"');
  console.error('  printf "Enter SUPABASE_DB_PASSWORD (typing hidden): " && read -s val && echo && echo "SUPABASE_DB_PASSWORD=$val" >> ".env"\n');
  process.exit(1);
}

// Helper to run commands
function runCmd(command, extraEnv = {}) {
  console.log(`Running: ${command}`);
  try {
    execSync(command, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        SUPABASE_ACCESS_TOKEN: token,
        ...extraEnv
      }
    });
  } catch (err) {
    console.error(`Command failed: ${command}`);
    console.error(err.message);
    process.exit(1);
  }
}

console.log('--- Starting Supabase Synchronization & Deployment ---');

// 1. Link project
console.log('\n[1/3] Linking Supabase Project...');
runCmd(`npx supabase link --project-ref dvbgfjjzggnlrixsqkss -p "${dbPassword}"`);

// 2. Push Database Migrations
console.log('\n[2/3] Pushing database migrations...');
runCmd('npx supabase db push');

// 3. Deploy Edge Functions
console.log('\n[3/3] Deploying Edge Functions...');
const functions = ['submit-observation', 'submit-clean-vote', 'cleanup-expired', 'get-heatmap'];
for (const fn of functions) {
  console.log(`\nDeploying function: ${fn}...`);
  runCmd(`npx supabase functions deploy ${fn} --no-verify-jwt`);
}

console.log('\n--- Synchronization and Deployment Completed Successfully ---');
