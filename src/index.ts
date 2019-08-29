import { promisify } from "util";
import { Handler, Context } from "aws-lambda";
import { Client, QueryResult, ClientConfig } from "pg";
import { Projection, WGS84BoundingBox, Tile } from "./projection";
import { S3 } from "aws-sdk";
import { gzip } from "zlib";
import configJSON from "./sources.json";

const asyncgzip = promisify(gzip);

const LOG_SILENT = 0;
const LOG_ERROR = 1;
const LOG_INFO = 2;
const LOG_TRACE = 3;
const LOG_DEBUG = 4;
const LOG_LEVEL = LOG_TRACE;

/**
 * Wrapper for Debug-Outputs to console
 * @param msg object to log
 * @param level log-level
 */
export function log(msg: any, level: number) {
    if (level <= LOG_LEVEL) console.log(msg);
}

interface Event {
    path: string
}

export interface Common {
    extend?: number,
    buffer?: number,
    clip_geom?: boolean,
    geom?: string,
    srid?: number,
    keys?: string[],
    where?: string[],
    minzoom?: number,
    maxzoom?: number,
    prefix?: string,
    postfix?: string,
    sql?: string
}

export interface Variants extends Common {
    minzoom: number,
    table?: string
}

export interface Layer extends Common {
    name: string,
    table?: string,
    variants?: Variants[]
}

export interface SourceBasics extends Common {
    name: string
    host?: string,
    database?: string,
    port?: number,
    user?: string,
    password?: string
}

export interface Source extends SourceBasics {
    layers: Layer[],
}

export interface Config {
    sources: Source[]
}

// global constants
const config: Config = configJSON;
const cacheBucketName = "tiles.cyclemap.link"
const proj = new Projection();

/**
 * Extract zxy-tile information from a given path. Also checks for a valid file-extension.
 * @param path a full path including arbitrary prefix-path, layer, tile and extension
 * @return a tile for subsequent use or null if no valid Tile could be extracted. 
 */
export function extractTile(path: string): Tile | null {
    let tile: Tile = { x: 0, y: 0, z: 0 };
    let re = new RegExp(/\d+\/\d+\/\d+(?=.mvt)/g);
    let tilepath = path.match(re);
    if (tilepath) {
        let numbers = tilepath[0].split("/");
        tile.y = parseInt(numbers[numbers.length - 1]);
        tile.x = parseInt(numbers[numbers.length - 2]);
        tile.z = parseInt(numbers[numbers.length - 3]);
        return tile;
    }
    return null;
}


/**
 * Extracts the layer-name from a given path.
 * @param path a full path including arbitrary prefix-path, layer, tile and extension
 * @return the name of the source if found
 */
export function extractSource(path: string): string | null {
    // match the last word between slashes before the actual tile (3-numbers + extension)
    let sourceCandidates: RegExpMatchArray | null = path.match(/(?!\/)\w+(?=\/\d+\/\d+\/\d+\.mvt)/g)
    if (sourceCandidates != null && sourceCandidates.length > 0) {
        return sourceCandidates[sourceCandidates.length - 1];
    }
    return null;
}

/**
 * Check a given layer and variants against the zoom-level. Merge the **last** matching item in the variant-array into the layer and return it.
 * Matching the **last** variant item makes the variant-objects shorter as we don't need to give a maxzoom but use a sequence of minzooms for each variant.
 * @param layer This is the input layer including variants
 * @param zoom The zoom-level to check the layer incl. variants against
 * @return The resulting layer where the **last** matching variant is merged into the layer or null if zoom is out of bounds
 */
export function resolveLayerProperties(layer: Layer, zoom: number): Layer | null {
    let resolved: Layer = { ...layer };

    /** check layer zoom if present */
    if (
        ((layer.minzoom != undefined) && (zoom < layer.minzoom)) ||
        ((layer.maxzoom != undefined) && (zoom >= layer.maxzoom))
    ) {
        return null;
    }

    if (layer.variants && layer.variants.length) {
        for (let variant of layer.variants) {
            /** the default zoom-values should cover all use-cases on earth */
            let variantMinzoom = (variant.minzoom != undefined) ? variant.minzoom : /* istanbul ignore next: This can't happen due to interface definition */0
            let variantMaxzoom = (variant.maxzoom != undefined) ? variant.maxzoom : 32
            if (zoom >= variantMinzoom && zoom < variantMaxzoom) {
                /** We have a match: merge the variant with the original layer. */
                resolved = { ...layer, ...variant }
            }
        }
    }
    /** do not allow recursive definitions */
    delete resolved.variants;
    return resolved;
}

/**
 * This will create the SQL-Query for a given layer. Source-specific properties (if given) will be used 
 * if not defined for the layer.
 * @param source This is the source object. It can also be a simplified Source-Object w/o 
 * the layer information as it's not needed here (used for simplified unit-tests)).
 * @param layer The layer that we need the SQL-Query for. Can include variants.
 * @param wgs84BoundingBox The boundingbox for the tile
 * @param zoom Zoom level 
 */
export function buildLayerQuery(source: Source | SourceBasics, layer: Layer, wgs84BoundingBox: WGS84BoundingBox, zoom: number): string | null {
    let resolved: Layer | null = resolveLayerProperties(layer, zoom);

    // Layer is empty due to zoom constrains. No further processing needed.
    if (resolved === null) return null;
    // FIXME: minzoom and maxzoom must be propagated from source into layer

    let layerExtend: number = (resolved.extend != undefined) ? resolved.extend : ((source.extend != undefined) ? source.extend : 4096);
    let sql: string = (resolved.sql != undefined) ? resolved.sql : ((source.sql != undefined) ? source.sql : "");
    let geom: string = (resolved.geom != undefined) ? resolved.geom : ((source.geom != undefined) ? source.geom : "geometry");
    let srid: number = (resolved.srid != undefined) ? resolved.srid : ((source.srid != undefined) ? source.srid : 3857);
    let bbox: string = `ST_Transform(ST_MakeEnvelope(${wgs84BoundingBox.leftbottom.lng}, ${wgs84BoundingBox.leftbottom.lat}, ${wgs84BoundingBox.righttop.lng}, ${wgs84BoundingBox.righttop.lat}, 4326), ${srid})`;
    let buffer: number = (resolved.buffer != undefined) ? resolved.buffer : ((source.buffer != undefined) ? source.buffer : 256);
    let clip_geom: boolean = (resolved.clip_geom != undefined) ? resolved.clip_geom : ((source.clip_geom != undefined) ? source.clip_geom : true);
    let prefix: string = (resolved.prefix != undefined) ? resolved.prefix : ((source.prefix != undefined) ? source.prefix : "");
    let postfix: string = (resolved.postfix != undefined) ? resolved.postfix : ((source.postfix != undefined) ? source.postfix : "");

    let keys: string = "";
    if (source.keys && source.keys.length) {
        keys += ", " + source.keys.join(", ")
    }
    if (resolved.keys && resolved.keys.length) {
        keys += ", " + resolved.keys.join(", ")
    }

    let where: string = "";
    if (source.where && source.where.length) {
        where += " AND (" + source.where.join(") AND (") + ")"
    }
    if (resolved.where && resolved.where.length) {
        where += " AND (" + resolved.where.join(") AND (") + ")"
    }

    if (sql) {
        return `(SELECT ST_AsMVT(q, '${resolved.name}', ${layerExtend}, 'geom') as data FROM
        (${sql}) as q)`.replace(/!ZOOM!/g, `${zoom}`).replace(/!BBOX!/g, `${bbox}`).replace(/\s+/g, ' ');
    }
    else {
        return `(SELECT ST_AsMVT(q, '${resolved.name}', ${layerExtend}, 'geom') as data FROM
        (SELECT ${prefix}ST_AsMvtGeom(
            ${geom},
            ${bbox},
            ${layerExtend},
            ${buffer},
            ${clip_geom}
            ) AS geom${keys}
        FROM ${resolved.table} WHERE (${geom} && ${bbox})${where}${postfix}) as q)`.replace(/!ZOOM!/g, `${zoom}`).replace(/\s+/g, ' ');
    }
}


export function buildQuery(source: string, config: Config, wgs84BoundingBox: WGS84BoundingBox, zoom: number): string | null {
    let query: string | null = null;
    let layerQueries: string[] = [];
    let layerNames: string[] = [];

    for (let sourceItem of config.sources) {
        if (sourceItem.name === source) {
            for (let layer of sourceItem.layers) {
                /** Accoring to https://github.com/mapbox/vector-tile-spec/tree/master/2.1#41-layers: 
                 *    Prior to appending a layer to an existing Vector Tile, an encoder MUST check the existing name fields in order to prevent duplication.
                 *  implementation solution: ignore subsequent duplicates and log an error*/
                if (!layerNames.includes(layer.name)) {
                    layerNames.push(layer.name);
                    let layerQuery: string | null = buildLayerQuery(sourceItem, layer, wgs84BoundingBox, zoom);
                    if (layerQuery) layerQueries.push(layerQuery);
                }
                else {
                    log(`ERROR - Duplicate layer name: ${layer.name}`, LOG_ERROR);
                }
            }
        }
    }
    if (layerQueries.length) {
        let layers = layerQueries.join(" || ");
        query = `SELECT ( ${layers} ) as data`;
    }
    else {
        // FIXME: Do we really have to create an empty tile?
        query = `SELECT ( (SELECT ST_AsMVT(q, 'empty', 4096, 'geom') as data FROM
        (SELECT ST_AsMvtGeom(
            ST_GeomFromText('POLYGON EMPTY'),
            ST_MakeEnvelope(0, 1, 1, 0, 4326),
            4096,
            256,
            true
            ) AS geom ) as q) ) as data;`;
    }
    return query.replace(/\s+/g, ' ');
}

export async function fetchTileFromDatabase(query: string, clientConfig: ClientConfig): Promise<Buffer> {
    let client: Client = new Client(clientConfig);
    await client.connect();
    let res: QueryResult = await client.query(query);
    await client.end();
    return res.rows[0].data;
}

export function getClientConfig(source: string, config: Config): ClientConfig {
    let clientConfig: ClientConfig = {};

    for (let sourceItem of config.sources) {
        if (sourceItem.name === source) {
            // pick only the connection info from the sourceItem
            if ("host" in sourceItem) clientConfig.host = sourceItem.host;
            if ("port" in sourceItem) clientConfig.port = sourceItem.port;
            if ("user" in sourceItem) clientConfig.user = sourceItem.user;
            if ("password" in sourceItem) clientConfig.password = sourceItem.password;
            if ("database" in sourceItem) clientConfig.database = sourceItem.database;
        }
    }
    return clientConfig;
}

export const handler: Handler = async (event: Event, context: Context): Promise<any> => {

    /** This MUST be placed within this function for the module-tests (mock) to work correctly */
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

    let tile: Tile | null = extractTile(event.path);
    let source: string | null = extractSource(event.path);

    if (tile && source) {
        let vectortile: Buffer | null = null;

        let wgs84BoundingBox = proj.getWGS84TileBounds(tile)
        let query = buildQuery(source, config, wgs84BoundingBox, tile.z)
        log(query, LOG_TRACE);
        /* istanbul ignore else: This can't happen due to implementation of buildQuery() */
        if (query) {
            try {
                let pgConfig = getClientConfig(source, config);
                vectortile = await fetchTileFromDatabase(query, pgConfig);
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
                log(s3obj, LOG_DEBUG);
            } catch (error) {
                vectortile = null;
                response.body = JSON.stringify(error);
                log(error, LOG_ERROR);
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
        log(`${event.path} ${response.statusCode}: ${source}/${tile.z}/${tile.x}/${tile.y}  ${stats.uncompressedBytes} -> ${stats.compressedBytes}`, LOG_INFO);
    }
    return Promise.resolve(response)
}