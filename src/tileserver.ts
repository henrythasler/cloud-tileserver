import { promisify } from "util";
import { gzip } from "zlib";
import { S3 } from "aws-sdk";

import { Client, QueryResult, ClientConfig } from "pg";
import { Projection, WGS84BoundingBox, Tile } from "./projection";

const asyncgzip = promisify(gzip);

export enum LogLevels { SILENT = 1, ERROR, INFO, DEBUG, TRACE }

/**
 * Wrapper for Debug-Outputs to console
 * @param msg object to log
 * @param level log-level
 */
export class Log {
    loglevel: LogLevels = LogLevels.ERROR;

    constructor(level?: LogLevels) {
        this.loglevel = (level) ? level : LogLevels.DEBUG;
    }

    show(msg: any, level: number) {
        if (level <= this.loglevel) console.log(msg);
    }
}

export interface Vectortile {
    res: number,
    data?: Buffer,
    status?: string
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


export class Tileserver {
    protected config: Config;
    protected cacheBucketName: string | null = null
    protected proj = new Projection();
    protected log: Log;
    protected gzip: boolean;

    /**
     * @constructor
     * @param config 
     * @param cacheBucketName 
     */
    constructor(config: Config, cacheBucketName?: string, logLevel: number = LogLevels.ERROR, gzip = true) {
        if (cacheBucketName) this.cacheBucketName = cacheBucketName;
        this.config = config;
        this.gzip = gzip;
        this.log = new Log(logLevel);
    }

    /**
     * Extract zxy-tile information from a given path. Also checks for a valid file-extension.
     * @param path a full path including arbitrary prefix-path, layer, tile and extension
     * @return a tile for subsequent use or null if no valid Tile could be extracted. 
     */
    extractTile(path: string): Tile | null {
        const tile: Tile = { x: 0, y: 0, z: 0 };
        const tilepath: RegExpMatchArray | null = path.match(/\d+\/\d+\/\d+(?=\.mvt\b)/g);
        if (tilepath) {
            const numbers = tilepath[0].split("/");
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
    extractSource(path: string): string | null {
        // match the last word between slashes before the actual tile (3-numbers + extension)
        const sourceCandidates: RegExpMatchArray | null = path.match(/(?!\/)\w+(?=\/\d+\/\d+\/\d+\.mvt\b)/g)
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
    resolveLayerProperties(layer: Layer, zoom: number): Layer | null {
        let resolved: Layer = { ...layer };

        /** check layer zoom if present */
        if (
            ((layer.minzoom !== undefined) && (zoom < layer.minzoom)) ||
            ((layer.maxzoom !== undefined) && (zoom >= layer.maxzoom))
        ) {
            return null;
        }

        if (layer.variants && layer.variants.length) {
            for (const variant of layer.variants) {
                /** the default zoom-values should cover all use-cases on earth */
                const variantMinzoom = (variant.minzoom !== undefined) ? variant.minzoom : /* istanbul ignore next: This can't happen due to interface definition */0
                const variantMaxzoom = (variant.maxzoom !== undefined) ? variant.maxzoom : 32
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
     * @return the resulting query for this layer if applicable
     */
    buildLayerQuery(source: Source | SourceBasics, layer: Layer, wgs84BoundingBox: WGS84BoundingBox, zoom: number): string | null {
        const resolved: Layer | null = this.resolveLayerProperties(layer, zoom);

        // Layer is empty due to zoom constrains. No further processing needed.
        if (resolved === null) return null;
        // FIXME: minzoom and maxzoom must be propagated from source into layer

        const layerExtend: number = (resolved.extend !== undefined) ? resolved.extend : ((source.extend !== undefined) ? source.extend : 4096);
        const sql: string = (resolved.sql !== undefined) ? resolved.sql : ((source.sql !== undefined) ? source.sql : "");
        const geom: string = (resolved.geom !== undefined) ? resolved.geom : ((source.geom !== undefined) ? source.geom : "geometry");
        const srid: number = (resolved.srid !== undefined) ? resolved.srid : ((source.srid !== undefined) ? source.srid : 3857);
        const bbox: string = `ST_Transform(ST_MakeEnvelope(${wgs84BoundingBox.leftbottom.lng}, ${wgs84BoundingBox.leftbottom.lat}, 
            ${wgs84BoundingBox.righttop.lng}, ${wgs84BoundingBox.righttop.lat}, 4326), ${srid})`;
        const buffer: number = (resolved.buffer !== undefined) ? resolved.buffer : ((source.buffer !== undefined) ? source.buffer : 256);
        const clip_geom: boolean = (resolved.clip_geom !== undefined) ? resolved.clip_geom : ((source.clip_geom !== undefined) ? source.clip_geom : true);
        const prefix: string = (resolved.prefix !== undefined) ? resolved.prefix : ((source.prefix !== undefined) ? source.prefix : "");
        const postfix: string = (resolved.postfix !== undefined) ? resolved.postfix : ((source.postfix !== undefined) ? source.postfix : "");

        let keys: string = "";
        if (source.keys && source.keys.length) {
            keys += ", " + source.keys.join(", ")
        }
        if (resolved.keys && resolved.keys.length) {
            keys += ", " + resolved.keys.join(", ")
        }

        let where: string = "";
        if (source.where && source.where.length) {
            where += ` AND (${source.where.join(") AND (")})`;
        }
        if (resolved.where && resolved.where.length) {
            where += ` AND (${resolved.where.join(") AND (")})`;
        }

        if (sql) {
            return `(SELECT ST_AsMVT(q, '${resolved.name}', ${layerExtend}, 'geom') AS l FROM
        (${sql}) AS q)`.replace(/!ZOOM!/g, `${zoom}`).replace(/!BBOX!/g, `${bbox}`).replace(/\s+/g, ' ');
        }
        else {
            return `(SELECT ST_AsMVT(q, '${resolved.name}', ${layerExtend}, 'geom') AS l FROM
        (SELECT ${prefix}ST_AsMvtGeom(
            ${geom},
            ${bbox},
            ${layerExtend},
            ${buffer},
            ${clip_geom}
            ) AS geom${keys}
        FROM ${resolved.table} WHERE (${geom} && ${bbox})${where}${postfix}) AS q)`.replace(/!ZOOM!/g, `${zoom}`).replace(/\s+/g, ' ');
        }
    }


    /**
     * Resolves, assembles and merges all layers-queries.
     * @param source This is the source object as per ClientConfig
     * @param wgs84BoundingBox The boundingbox for the tile
     * @param zoom Zoom level
     * @return the resulting query for the source if applicable
     */
    buildQuery(source: string, wgs84BoundingBox: WGS84BoundingBox, zoom: number): string {
        let query: string = "";
        const layerQueries: string[] = [];
        const layerNames: string[] = [];

        for (const sourceItem of this.config.sources) {
            if (sourceItem.name === source) {
                for (const layer of sourceItem.layers) {
                    /** Accoring to https://github.com/mapbox/vector-tile-spec/tree/master/2.1#41-layers: 
                     *    Prior to appending a layer to an existing Vector Tile, an encoder MUST check the existing name fields in order to prevent duplication.
                     *  implementation solution: ignore subsequent duplicates and log an error*/
                    if (!layerNames.includes(layer.name)) {
                        layerNames.push(layer.name);
                        const layerQuery: string | null = this.buildLayerQuery(sourceItem, layer, wgs84BoundingBox, zoom);
                        if (layerQuery) layerQueries.push(layerQuery);
                    }
                    else {
                        this.log.show(`ERROR - Duplicate layer name: ${layer.name}`, LogLevels.ERROR);
                    }
                }
            }
        }

        /** merge all layer-queries with the postgres string concatenation operator (https://www.postgresql.org/docs/9.1/functions-string.html)*/
        if (layerQueries.length) {
            const layers = layerQueries.join(" || ");
            query = `SELECT ( ${layers} ) AS mvt`;
        }

        // remove whitespaces and newlines from resulting query
        return query.replace(/\s+/g, ' ');
    }

    /**
     * All database interaction is encapsulated in this function. The design-goal is to keep the time where a database-
     * connection is open to a minimum. This reduces the risk for the database-instance to run out of connections.
     * @param query the actual query to be sent to the database engine
     * @param clientConfig a pg-config-Object. see https://node-postgres.com/api/client#constructor
     * @return the vectortile-data as Buffer wrapped in a promise.
     */
    async fetchTileFromDatabase(query: string, clientConfig: ClientConfig): Promise<Buffer> {
        const client: Client = new Client(clientConfig);
        await client.connect();
        const res: QueryResult = await client.query(query);
        this.log.show(res.rows[0], LogLevels.TRACE);
        await client.end();
        if (res.rows[0].mvt) {
            return res.rows[0].mvt;   // the .mvt property is taken from the outer AS-alias of the query (see buildQuery())
        }
        else {
            throw new Error("Property 'mvt' does not exist in res.rows[0]")
        }
    }

    /**
     * Checks the source-config in `./sources.json` and builds a pg-config-object from properties defined for each source-item
     * @param source the source to create a config for
     * @return a pg-config-Object. see https://node-postgres.com/api/client#constructor
     */
    getClientConfig(source: string): ClientConfig {
        const clientConfig: ClientConfig = {};

        for (const sourceItem of this.config.sources) {
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

    /**
     * The main function that returns a vectortile in mvt-format.
     * @param path a full path including arbitrary prefix, source, tile and extension `/{SOURCE}/{Z}/{X}/{Y}.mvt`
     * @return contains the vectortile-data and some meta-information
     */
    async getVectortile(path: string): Promise<Vectortile> {
        const mvt: Vectortile = { res: 0 };
        const s3 = new S3({ apiVersion: '2006-03-01' });

        // check for valid tile
        const tile = this.extractTile(path);
        if (!tile) {
            const msg = `[ERROR] - Tile not correctly specified in '${path}'`;
            this.log.show(msg, LogLevels.ERROR);
            mvt.res = -2;
            mvt.status = msg;
            return mvt;
        }

        // check for valid source layer
        const source = this.extractSource(path);
        if (!source) {
            const msg = `[ERROR] - Source not correctly specified in '${path}'`;
            this.log.show(msg, LogLevels.ERROR);
            mvt.res = -3;
            mvt.status = msg;
            return mvt;
        }

        const wgs84BoundingBox = this.proj.getWGS84TileBounds(tile);
        console.time('buildQuery');
        const query = this.buildQuery(source, wgs84BoundingBox, tile.z)
        console.timeEnd('buildQuery');
        this.log.show(query, LogLevels.DEBUG);
        let data: Buffer | null = null;

        if (query) {
            const pgConfig = this.getClientConfig(source);
            this.log.show(pgConfig, LogLevels.TRACE);
            try {
                console.time('fetchTileFromDatabase');
                data = await this.fetchTileFromDatabase(query, pgConfig);
                console.timeEnd('fetchTileFromDatabase');
            } catch (error) {
                mvt.res = -4;
                mvt.status = `[ERROR] - Database error: ${error.message}`;
                this.log.show(error, LogLevels.ERROR);
                return mvt;
            }
        }
        else {
            // Empty query => empty tile
            const msg = `[INFO] - Empty query for '${path}'`;
            this.log.show(msg, LogLevels.INFO);
            mvt.res = 1;
            mvt.status = msg;
            data = Buffer.from("");
        }

        this.log.show(data, LogLevels.TRACE);

        const uncompressedBytes = data.byteLength;
        console.time('asyncgzip');
        if (this.gzip) mvt.data = await asyncgzip(data) as Buffer;
        else mvt.data = data;
        console.timeEnd('asyncgzip');
        const compressedBytes = mvt.data.byteLength;

        // log some stats about the generated tile
        this.log.show(`${path} ${source}/${tile.z}/${tile.x}/${tile.y}  ${uncompressedBytes} -> ${compressedBytes}`, LogLevels.INFO);

        if (this.cacheBucketName) {
            try {
                console.time('putObject');
                await s3.putObject({
                    Body: mvt.data,
                    Bucket: this.cacheBucketName,
                    Key: `${source}/${tile.z}/${tile.x}/${tile.y}.mvt`,
                    ContentType: "application/vnd.mapbox-vector-tile",
                    ContentEncoding: (this.gzip) ? "gzip" : "identity",
                    CacheControl: "604800", // 7 days
                    // Metadata: {
                    //     "rawBytes": `${stats.uncompressedBytes}`,
                    //     "gzippedBytes": `${stats.compressedBytes}`
                    // }
                }).promise();
                console.timeEnd('putObject');
            } catch (error) {
                const msg = `[ERROR] - Could not putObject() to S3: ${error.message}`;
                mvt.res = 2;
                mvt.status = msg;
                this.log.show(msg, LogLevels.ERROR);
            }
        }
        else {
            this.log.show("[INFO] - env.CACHE_BUCKET not defined. Caching to S3 disabled.", LogLevels.INFO);
        }
        return mvt;
    }
}
