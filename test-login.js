import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000';

async function testMasterLogin() {
  try {
    console.log('🔐 Testando login do master...\n');

    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'master@korus.com',
        password: 'Master123456'
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Login bem-sucedido!');
      console.log('\n📋 Dados retornados pelo servidor:');
      console.log(JSON.stringify(data, null, 2));

      // Verify master details
      if (data.user) {
        console.log('\n🔍 Verificação:');
        console.log(`- Role: ${data.user.role} (esperado: 'master')`);
        console.log(`- Agency_ID: ${data.user.agency_id} (esperado: null)`);
        console.log(`- Email: ${data.user.email}`);
        console.log(`- ID: ${data.user.id}`);

        if (data.user.role === 'master' && data.user.agency_id === null) {
          console.log('\n✅ Dados do master estão CORRETOS!');
        } else {
          console.log('\n❌ PROBLEMA DETECTADO:');
          if (data.user.role !== 'master') {
            console.log(`   - Role é '${data.user.role}' ao invés de 'master'`);
          }
          if (data.user.agency_id !== null) {
            console.log(`   - Agency_ID é '${data.user.agency_id}' ao invés de null`);
          }
        }
      }
    } else {
      const error = await response.json();
      console.error('❌ Erro no login:', error);
    }
  } catch (err) {
    console.error('❌ Erro de conexão:', err.message);
  }
}

testMasterLogin();
