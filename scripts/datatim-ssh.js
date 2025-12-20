const mysql = require('mysql2/promise');

// Connect through SSH tunnel (run: ssh -L 3357:localhost:3357 solflouser@192.168.1.3)
const config = {
  host: 'localhost',  // Changed to localhost for SSH tunnel
  port: 3357,
  user: 'solflouser',
  password: 'pass0912solfo)(!@',
  database: 'epssched'
};

async function getDriverData() {
  let connection;
  try {
    connection = await mysql.createConnection(config);
    console.log('Connected through SSH tunnel');
    
    const [driverRows] = await connection.execute('SELECT * FROM vsl_drmaster LIMIT 5');
    console.log('\n=== DRIVER MASTER DATA ===');
    console.log(driverRows);
    
    const [tableRows] = await connection.execute('SELECT * FROM vsl_tbldrivermaster LIMIT 5');
    console.log('\n=== TABLE DRIVER MASTER DATA ===');
    console.log(tableRows);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    if (connection) await connection.end();
  }
}

getDriverData();
