"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
exports.handler = async (event, context) => {
    let client = new pg_1.Client({
        statement_timeout: 3000
    });
    try {
        await client.connect();
        let res = await client.query(`SELECT ST_AsMVT(q, 'roads', 4096, 'geom') as data FROM
        (SELECT id, 
                ST_AsMvtGeom(
                  geometry,
                  ST_Transform(ST_MakeEnvelope(10.8984375, 49.92293567, 10.94238248, 49.95121991, 4326), 3857),
                  4096,
                  256,
                  true
                ) AS geom
              FROM import.buildings
              WHERE geometry && ST_Transform(ST_MakeEnvelope(10.8984375, 49.92293567, 10.94238248, 49.95121991, 4326), 3857)
         ) as q`);
        let response = {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/vnd.mapbox-vector-tile'
            },
            body: res.rows[0].data.toString('base64'),
            isBase64Encoded: true
        };
        return Promise.resolve(response);
    }
    catch (error) {
        console.log(error);
        return Promise.resolve({});
    }
    // let response = JSON.stringify(event, null, 2);
    // return Promise.resolve(response)
};
