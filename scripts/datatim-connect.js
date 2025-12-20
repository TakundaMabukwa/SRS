const mysql = require('mysql2/promise');

const config = {
  host: '192.168.1.3',
  port: 3357,
  user: 'solflouser',
  password: 'pass0912solfo)(!@',
  database: 'epssched'
};

async function getDriverData() {
  let connection;
  try {
    connection = await mysql.createConnection(config);
    console.log('Connected to Datatim MySQL Server');
    
    // Query driver master
    const [driverRows] = await connection.execute('SELECT * FROM vsl_drmaster LIMIT 5');
    console.log('\n=== DRIVER MASTER DATA ===');
    console.log(`Found ${driverRows.length} drivers (showing first 5)`);
    console.log(driverRows);
    
    // Query table driver master
    const [tableRows] = await connection.execute('SELECT * FROM vsl_tbldrivermaster LIMIT 5');
    console.log('\n=== TABLE DRIVER MASTER DATA ===');
    console.log(`Found ${tableRows.length} records (showing first 5)`);
    console.log(tableRows);
    
  } catch (err) {
    console.error('Database connection error:', err.message);
  } finally {
    if (connection) await connection.end();
  }
}

getDriverData();
