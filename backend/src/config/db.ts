import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });



if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '') {
  console.log('🔗 Conexión: Usando Neon (DATABASE_URL)');
} else {
  console.log('🔗 Conexión: Usando base local');
  console.log('→ host:', process.env.PGHOST, 'port:', process.env.PGPORT, 'db:', process.env.PGDATABASE);
}


const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 2, // Recomendado para serverless
      // Cerramos conexiones ociosas nosotros (30s) ANTES de que Neon las cierre
      // del lado servidor. Con 0 el timeout queda desactivado y las conexiones
      // quedan ociosas hasta que Neon las mata, generando un error de socket.
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000, // Espera máxima para conectar
      keepAlive: true, // Mantiene viva la conexión TCP y detecta cortes antes
    })
  : new Pool({
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE,
    });

// CRÍTICO: sin este handler, un error en una conexión ociosa del pool (por ej.
// cuando Neon cierra la conexión por inactividad) se convierte en una excepción
// no capturada y MATA el proceso. Railway lo reinicia → "deploy crash" periódico.
// Con el handler, el error se loguea y el pool descarta esa conexión sin caerse.
pool.on('error', (err) => {
  console.error('[db] Error en cliente ocioso del pool (recuperado, no crash):', err.message);
});

export default pool;
