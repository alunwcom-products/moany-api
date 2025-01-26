import mysql from 'mysql2';
// import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

// MySQL connection configuration using environment variables
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Connect to MySQL
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
});

module.exports = connection;

// Function to insert transaction records into the database
// function insertTransactionsFromCSV(csvFilePath) {
//     const transactions = [];

//     // Read and parse the CSV file
//     fs.createReadStream(csvFilePath)
//         .pipe(csv())
//         .on('data', (row) => {
//             transactions.push(row);
//         })
//         .on('end', () => {
//             const query = 'INSERT INTO transactions (date, description, amount, balance) VALUES ?';
//             const values = transactions.map(transaction => [
//                 new Date(transaction.Date),
//                 transaction.Description,
//                 parseFloat(transaction.Amount),
//                 parseFloat(transaction.Balance)
//             ]);

//             connection.query(query, [values], (err, result) => {
//                 if (err) {
//                     console.error('Error inserting transactions:', err);
//                     return;
//                 }
//                 console.log('Transactions inserted:', result.affectedRows);
//             });
//         });
// }

// Call the function with the path to your CSV file
// insertTransactionsFromCSV('transactions.csv');