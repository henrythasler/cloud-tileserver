import { Handler, Context, Callback } from 'aws-lambda';
import { Client } from "pg";

interface TileRequest {
    layer: string
    x: number,
    y: number,
    z: number
}

export const handler:Handler = async (event: TileRequest, context: Context): Promise<any> => {
    let client:Client = new Client();
    try {
        await client.connect();    
        let res = await client.query(`SELECT pg_size_pretty(pg_database_size('${process.env.PGDATABASE}')) as size;`)
        console.log(`Database size=${res.rows[0].size}`);
        } catch (error) {
        console.log(`There was an error connecting.`)
    }
    
    console.log(`getRemainingTimeInMillis=${context.getRemainingTimeInMillis()}`);
    let response = JSON.stringify(event, null, 2);
    return Promise.resolve(response)
}