import { promisify } from "util";
import { Handler, Context } from "aws-lambda";
import { S3 } from "aws-sdk";
import { Tile, Projection } from "./projection";
import { Tileserver, Log, Vectortile } from "./tileserver";
import { gzip } from "zlib";
import configJSON from "./sources.json";

const asyncgzip = promisify(gzip);

const cacheBucketName = process.env.CACHE_BUCKET || ""
const tileserver: Tileserver = new Tileserver(configJSON, cacheBucketName);
const proj: Projection = new Projection();
const log: Log = new Log();

interface Event {
    path: string
}

export const handler: Handler = async (event: Event, context: Context): Promise<any> => {
    let response;
    let vectortile: Vectortile = await tileserver.getVectortile(event.path);
    if ((vectortile.res === 0) && (vectortile.data)) {
        response = {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/vnd.mapbox-vector-tile',
                'Content-Encoding': 'gzip',
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

    /*
        // This MUST be placed within this function for the module-tests (mock) to work correctly
        const s3 = new S3({ apiVersion: '2006-03-01' });
    
        let stats = {
            uncompressedBytes: 0,
            compressedBytes: 0
        }
    
        let response = {
            statusCode: 500,
            headers: {
                'Content-Type': 'text/html',
                'access-control-allow-origin': '*',
                'Content-Encoding': 'identity'
            },
            body: "Error",
            isBase64Encoded: false
        }
    
        let tile: Tile | null = tileserver.extractTile(event.path);
        let source: string | null = tileserver.extractSource(event.path);
    
        if (tile && source) {
            let vectortile: Buffer | null = null;
    
            let wgs84BoundingBox = proj.getWGS84TileBounds(tile)
            let query = tileserver.buildQuery(source, wgs84BoundingBox, tile.z)
            log.show(query, LogLevels.TRACE);
            // istanbul ignore else: This can't happen due to implementation of buildQuery()
            if (query) {
                try {
                    let pgConfig = tileserver.getClientConfig(source);
                    vectortile = await tileserver.fetchTileFromDatabase(query, pgConfig);
                    stats.uncompressedBytes = vectortile.byteLength;
                    vectortile = await <Buffer><unknown>asyncgzip(vectortile);
                    stats.compressedBytes = vectortile.byteLength;
                    let s3obj = await s3.putObject({
                        Body: vectortile,
                        Bucket: cacheBucketName,
                        Key: `${source}/${tile.z}/${tile.x}/${tile.y}.mvt`,
                        ContentType: "application/vnd.mapbox-vector-tile",
                        ContentEncoding: "gzip",
                        CacheControl: "86400",
                        // Metadata: {
                        //     "rawBytes": `${stats.uncompressedBytes}`,
                        //     "gzippedBytes": `${stats.compressedBytes}`
                        // }
                    }).promise();
                    log.show(s3obj, LogLevels.DEBUG);
                } catch (error) {
                    vectortile = null;
                    response.body = JSON.stringify(error);
                    log.show(error, LogLevels.ERROR);
                }
            }
            if (vectortile) {
                response = {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'application/vnd.mapbox-vector-tile',
                        'Content-Encoding': 'gzip',
                        'access-control-allow-origin': '*'
                    },
                    body: vectortile.toString('base64'),
                    isBase64Encoded: true
                }
            }
            log.show(`${event.path} ${response.statusCode}: ${source}/${tile.z}/${tile.x}/${tile.y}  ${stats.uncompressedBytes} -> ${stats.compressedBytes}`, LogLevels.INFO);
        }
    */
}