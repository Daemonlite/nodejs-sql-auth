const { createPool } = require("mysql");
require('dotenv').config();

const pool = createPool({
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.MYSQL_DB,
    connectionLimit: 10 
});

pool.getConnection((error, connection) => {
    if (error) throw error;
    console.log('Database connected successfully');
    connection.release(); // Release the connection
});

module.exports = pool;