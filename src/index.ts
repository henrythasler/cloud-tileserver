import { Handler, Context, Callback } from 'aws-lambda';
import { Client } from "pg";

interface TileRequest {
    layer: string
    x: number,
    y: number,
    z: number
}

export const handler:Handler = async (event: TileRequest, context: Context): Promise<any> => {
    let client:Client = new Client({
        statement_timeout: 3000
    });
    try {
        await client.connect();    
        let res = await client.query(`SELECT encode(ST_AsMVT(q, 'roads', 4096, 'geom'), 'base64') as data FROM
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
         ) as q`)
        return Promise.resolve(res.rows[0].data)
    } catch (error) {
        console.log(error)
        return Promise.resolve({})
    }
    // let response = JSON.stringify(event, null, 2);
    // return Promise.resolve(response)
}