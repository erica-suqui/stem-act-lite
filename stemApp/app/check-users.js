const pool = require('./lib/db');

pool.query('SELECT user_id, email, role, org_id FROM users')
    .then(result => {
        console.table(result.rows);
        process.exit();
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });