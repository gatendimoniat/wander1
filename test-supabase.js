import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('🔍 Testing Supabase connection...\n');

  // 1. Health check
  console.log('1️⃣  Connection test...');
  const { data: health, error: healthError } = await supabase.from('routes').select('count', { count: 'exact', head: true });
  if (healthError) {
    console.log(`   ⚠️  Health check: ${healthError.message}`);
    if (healthError.message.includes('does not exist')) {
      console.log('   ❌ Tables do not exist. Run supabase-schema.sql first!');
    } else if (healthError.message.includes('JWT') || healthError.message.includes('invalid')) {
      console.log('   ❌ Invalid credentials. Check your .env file.');
    }
  } else {
    console.log('   ✅ Connected to Supabase');
  }

  // 2. Auth test
  console.log('\n2️⃣  Auth test...');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.log(`   ℹ️  No active session (normal if not logged in): ${authError.message}`);
  } else {
    console.log(`   ✅ Authenticated as: ${user?.email}`);
  }

  // 3. Table structure check
  console.log('\n3️⃣  Table structure...');
  const { data: routes, error: routesErr } = await supabase.from('routes').select('*').limit(1);
  const { data: tracks, error: tracksErr } = await supabase.from('tracks').select('*').limit(1);
  
  if (routesErr?.message.includes('does not exist')) {
    console.log('   ❌ Table "routes" does not exist');
  } else if (routesErr) {
    console.log(`   ⚠️  routes: ${routesErr.message}`);
  } else {
    console.log('   ✅ Table "routes" exists');
  }

  if (tracksErr?.message.includes('does not exist')) {
    console.log('   ❌ Table "tracks" does not exist');
  } else if (tracksErr) {
    console.log(`   ⚠️  tracks: ${tracksErr.message}`);
  } else {
    console.log('   ✅ Table "tracks" exists');
  }

  console.log('\n📊 Summary:');
  const tablesOk = !routesErr?.message.includes('does not exist') && !tracksErr?.message.includes('does not exist');
  if (tablesOk) {
    console.log('   ✅ Supabase is fully configured and ready!');
  } else {
    console.log('   ⚠️  Run supabase-schema.sql in the Supabase SQL Editor');
  }
}

test();
