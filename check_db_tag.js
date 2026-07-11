const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function getMasterKey() {
  const keyHex = process.env.ENCRYPTION_KEY;
  return Buffer.from(keyHex, 'hex');
}

function decrypt(stored) {
  const parts = stored.split(':');
  const [ivB64, tagB64, dataB64] = parts;
  const key = getMasterKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

async function run() {
  const { data } = await supabase
    .from('marketplace_connections')
    .select('encrypted_credentials')
    .eq('marketplace', 'mercadolivre')
    .limit(1)
    .single();

  if (!data) {
    console.log("No credentials found.");
    return;
  }

  const credentials = JSON.parse(decrypt(data.encrypted_credentials));
  console.log("Tag Salva no Banco de Dados:", credentials.tag_afiliado);
}

run().catch(console.error);
