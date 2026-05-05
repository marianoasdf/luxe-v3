import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });



if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '') {
  console.log('🔗 Conexión: Usando Neon (DATABASE_URL)');
  console.log('→', process.env.DATABASE_URL);
} else {
  console.log('🔗 Conexión: Usando base local');
  console.log('→ host:', process.env.PGHOST, 'port:', process.env.PGPORT, 'db:', process.env.PGDATABASE);
}


const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 2, // Recomendado para serverless
      idleTimeoutMillis: 0, // Cierra conexiones inactivas inmediatamente
      connectionTimeoutMillis: 5000, // Espera máxima para conectar
    })
  : new Pool({
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE,
    });

export default pool;
