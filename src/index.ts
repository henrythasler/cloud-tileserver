import { Handler, Context } from "aws-lambda";
import { Tileserver, Vectortile } from "./tileserver";
import configJSON from "./sources.json";


const cacheBucketName = process.env.CACHE_BUCKET || "";
const gzip = process.env.GZIP?process.env.GZIP!=="false":true;
const logLevel = (process.env.LOG_LEVEL)?parseInt(process.env.LOG_LEVEL):undefined;
const tileserver: Tileserver = new Tileserver(configJSON, cacheBucketName, logLevel, gzip);

interface Event {
    path?: string   // used by API-Gateway
    rawPath?: string    // used by Lambda function URLs
}

export const handler: Handler = async (event: Event, context: Context): Promise<any> => {
    let response;
    const vectortile: Vectortile = await tileserver.getVectortile(event.path ?? event.rawPath ?? "");
    if ((vectortile.res >= 0) && (vectortile.data)) {
        response = {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/vnd.mapbox-vector-tile',
                'Content-Encoding': (gzip) ? "gzip" : "identity",
                'access-control-allow-origin': '*'
            },
            body: vectortile.data.toString('base64'),
            isBase64Encoded: true
        }
    }
    else {
        response = {
            statusCode: 500,
            headers: {
                'Content-Type': 'text/html',
                'access-control-allow-origin': '*',
                'Content-Encoding': 'identity'
            },
            body: JSON.stringify(vectortile),
            isBase64Encoded: false
        }
    }
    return Promise.resolve(response)
}
