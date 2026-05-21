import { executeQuery } from '../lib/database';

async function checkTable() {
    try {
        const query = process.argv[2] || 'SHOW TABLES';
        const result = await executeQuery(query);
        //console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error checking table:', error);
        process.exit(1);
    }
}

checkTable();
