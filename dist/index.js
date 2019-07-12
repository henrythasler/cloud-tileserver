"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
exports.handler = async (event, context) => {
    let client = new pg_1.Client();
    try {
        await client.connect();
        let res = await client.query(`SELECT pg_size_pretty(pg_database_size('${process.env.PGDATABASE}')) as size;`);
        console.log(`Database size=${res.rows[0].size}`);
    }
    catch (error) {
        console.log(`There was an error connecting.`);
    }
    console.log(`getRemainingTimeInMillis=${context.getRemainingTimeInMillis()}`);
    let response = JSON.stringify(event, null, 2);
    return Promise.resolve(response);
};
