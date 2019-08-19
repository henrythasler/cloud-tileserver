"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
const pg_1 = require("pg");
const projection_1 = require("./projection");
const s3_1 = __importDefault(require("aws-sdk/clients/s3"));
const zlib_1 = require("zlib");
const layer_json_1 = __importDefault(require("./layer.json"));
const asyncgzip = util_1.promisify(zlib_1.gzip);
const config = layer_json_1.default;
// const config: Config = {sources: [{minzoom: 2, name:"434", layers:[{name:"eqw", table:"fdf", maxzoom: 2, variants:[{minzoom: 2}]}]}]};
const cacheBucketName = "tiles.cyclemap.link";
const proj = new projection_1.Projection();
const s3 = new s3_1.default({ apiVersion: '2006-03-01' });
/**
 * Extract zxy-tile information from a given path. Also checks for a valid file-extension.
 * @param path a full path including arbitrary prefix-path, layer, tile and extension
 * @return a tile for subsequent use or null if no valid Tile could be extracted.
 */
function extractTile(path) {
    let tile = { x: 0, y: 0, z: 0 };
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
exports.extractTile = extractTile;
/**
 * Extracts the layer-name from a given path.
 * @param path a full path including arbitrary prefix-path, layer, tile and extension
 * @return the name of the source if found
 */
function extractSource(path) {
    // match the last word between slashes before the actual tile (3-numbers + extension)
    let sourceCandidates = path.match(/(?!\/)\w+(?=\/\d+\/\d+\/\d+\.mvt)/g);
    if (sourceCandidates != null && sourceCandidates.length > 0) {
        return sourceCandidates[sourceCandidates.length - 1];
    }
    return null;
}
exports.extractSource = extractSource;
/**
 * Check a given layer and variants against the zoom-level. Merge the **last** matching item in the variant-array into the layer and return it.
 * Matching the **last** variant item makes the variant-objects shorter as we don't need to give a maxzoom but use a sequence of minzooms for each variant.
 * @param layer This is the input layer including variants
 * @param zoom The zoom-level to check the layer incl. variants against
 * @return The resulting layer where the **last** matching variant is merged into the layer or null if zoom is out of bounds
 */
function resolveLayerProperties(layer, zoom) {
    let resolved = layer;
    /** check layer zoom if present */
    if (((layer.minzoom != undefined) && (zoom < layer.minzoom)) ||
        ((layer.maxzoom != undefined) && (zoom >= layer.maxzoom))) {
        return null;
    }
    if (layer.variants && layer.variants.length) {
        for (let variant of layer.variants) {
            /** the default zoom-values should cover all use-cases on earth */
            let variantMinzoom = (variant.minzoom != undefined) ? variant.minzoom : /* istanbul ignore next: This can't happen due to interface definition */ 0;
            let variantMaxzoom = (variant.maxzoom != undefined) ? variant.maxzoom : 32;
            if (zoom >= variantMinzoom && zoom < variantMaxzoom) {
                /** We have a match: merge the variant with the original layer. */
                resolved = { ...layer, ...variant };
            }
        }
    }
    /** do not allow recursive definitions */
    delete resolved.variants;
    return resolved;
}
exports.resolveLayerProperties = resolveLayerProperties;
/**
 * This will create the SQL-Query for a given layer. Source-specific properties (if given) will be used
 * if not defined for the layer.
 * @param source This is the source object. It can also be a simplified Source-Object w/o
 * the layer information as it's not needed here (used for simplified unit-tests)).
 * @param layer The layer that we need the SQL-Query for. Can include variants.
 * @param wgs84BoundingBox The boundingbox for the tile
 * @param zoom Zoom level
 */
function buildLayerQuery(source, layer, wgs84BoundingBox, zoom) {
    let resolved = resolveLayerProperties(layer, zoom);
    // Layer is empty due to zoom constrains. No further processing needed.
    if (resolved === null)
        return null;
    // FIXME: minzoom and maxzoom must be propagated from source into layer
    // overwrite layer-properties with variant if applicable.
    layer = { ...layer, ...resolved };
    let layerExtend = (layer.extend != undefined) ? layer.extend : ((source.extend != undefined) ? source.extend : 4096);
    let sql = (layer.sql != undefined) ? layer.sql : ((source.sql != undefined) ? source.sql : "");
    let geom = (layer.geom != undefined) ? layer.geom : ((source.geom != undefined) ? source.geom : "geometry");
    let srid = (layer.srid != undefined) ? layer.srid : ((source.srid != undefined) ? source.srid : 3857);
    let bbox = `ST_Transform(ST_MakeEnvelope(${wgs84BoundingBox.leftbottom.lng}, ${wgs84BoundingBox.leftbottom.lat}, ${wgs84BoundingBox.righttop.lng}, ${wgs84BoundingBox.righttop.lat}, 4326), ${srid})`;
    let buffer = (layer.buffer != undefined) ? layer.buffer : ((source.buffer != undefined) ? source.buffer : 256);
    let clip_geom = (layer.clip_geom != undefined) ? layer.clip_geom : ((source.clip_geom != undefined) ? source.clip_geom : true);
    let prefix = (layer.prefix != undefined) ? layer.prefix : ((source.prefix != undefined) ? source.prefix : "");
    let postfix = (layer.postfix != undefined) ? layer.postfix : ((source.postfix != undefined) ? source.postfix : "");
    let keys = "";
    if (source.keys && source.keys.length) {
        keys += ", " + source.keys.join(", ");
    }
    if (layer.keys && layer.keys.length) {
        keys += ", " + layer.keys.join(", ");
    }
    let where = "";
    if (source.where && source.where.length) {
        where += " AND (" + source.where.join(") AND (") + ")";
    }
    if (layer.where && layer.where.length) {
        where += " AND (" + layer.where.join(") AND (") + ")";
    }
    if (sql) {
        return `(SELECT ST_AsMVT(q, '${layer.name}', ${layerExtend}, 'geom') as data FROM
        (${sql}) as q)`.replace(/!ZOOM!/g, `${zoom}`).replace(/!BBOX!/g, `${bbox}`).replace(/\s+/g, ' ');
    }
    else {
        return `(SELECT ST_AsMVT(q, '${layer.name}', ${layerExtend}, 'geom') as data FROM
        (SELECT ${prefix}ST_AsMvtGeom(
            ${geom},
            ${bbox},
            ${layerExtend},
            ${buffer},
            ${clip_geom}
            ) AS geom${keys}
        FROM ${layer.table} WHERE (${geom} && ${bbox})${where}${postfix}) as q)`.replace(/!ZOOM!/g, `${zoom}`).replace(/\s+/g, ' ');
    }
}
exports.buildLayerQuery = buildLayerQuery;
function buildQuery(source, config, wgs84BoundingBox, zoom) {
    let query = null;
    let layerQueries = [];
    for (let sourceItem of config.sources) {
        if (sourceItem.name === source) {
            for (let layer of sourceItem.layers) {
                let layerQuery = buildLayerQuery(sourceItem, layer, wgs84BoundingBox, zoom);
                if (layerQuery)
                    layerQueries.push(layerQuery);
            }
        }
    }
    if (layerQueries.length) {
        let layers = layerQueries.join(" || ");
        query = `SELECT ( ${layers} ) as data`;
    }
    else {
        // FIXME: Do we really have to create an empty tile?
        query = `
        SELECT ( (SELECT ST_AsMVT(q, 'empty', 4096, 'geom') as data FROM
        (SELECT ST_AsMvtGeom(
            ST_GeomFromText('POLYGON EMPTY'),
            ST_MakeEnvelope(0, 1, 1, 0, 4326),
            4096,
            256,
            true
            ) AS geom ) as q) ) as data;        
        `;
    }
    return query.replace(/\s+/g, ' ');
}
exports.buildQuery = buildQuery;
async function fetchTileFromDatabase(query, clientConfig) {
    let client = new pg_1.Client(clientConfig);
    await client.connect();
    let res = await client.query(query);
    await client.end();
    return res.rows[0].data;
}
function getClientConfig(source, config) {
    let clientConfig = {};
    for (let sourceItem of config.sources) {
        if (sourceItem.name === source) {
            // pick only the connection info from the sourceItem
            if ("host" in sourceItem)
                clientConfig.host = sourceItem.host;
            if ("port" in sourceItem)
                clientConfig.port = sourceItem.port;
            if ("user" in sourceItem)
                clientConfig.user = sourceItem.user;
            if ("password" in sourceItem)
                clientConfig.password = sourceItem.password;
            if ("database" in sourceItem)
                clientConfig.database = sourceItem.database;
            // clientConfig = (({ host, port, user, password}) => ({ host, port, user, password }))(sourceItem); 
        }
    }
    return clientConfig;
}
exports.getClientConfig = getClientConfig;
exports.handler = async (event, context) => {
    let stats = {
        uncompressedBytes: 0,
        compressedBytes: 0
    };
    let response = {
        statusCode: 500,
        headers: {
            'Content-Type': 'text/html',
            'access-control-allow-origin': '*',
            'Content-Encoding': 'identity',
        },
        body: "Error",
        isBase64Encoded: false
    };
    let tile = extractTile(event.path);
    let source = extractSource(event.path);
    if (tile && source) {
        let vectortile = null;
        let wgs84BoundingBox = proj.getWGS84TileBounds(tile);
        let query = buildQuery(source, config, wgs84BoundingBox, tile.z);
        console.log(query);
        if (query) {
            try {
                let pgConfig = getClientConfig(source, config);
                vectortile = await fetchTileFromDatabase(query, pgConfig);
                stats.uncompressedBytes = vectortile.byteLength;
                vectortile = await asyncgzip(vectortile);
                stats.compressedBytes = vectortile.byteLength;
                let s3obj = await s3.putObject({
                    Body: vectortile,
                    Bucket: cacheBucketName,
                    Key: `${source}/${tile.z}/${tile.x}/${tile.y}.mvt`,
                    ContentType: "application/vnd.mapbox-vector-tile",
                    ContentEncoding: "gzip"
                }).promise();
                // console.log(s3obj);
            }
            catch (error) {
                vectortile = null;
                response.body = JSON.stringify(error);
                console.log(error);
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
            };
        }
        console.log(`${event.path} ${response.statusCode}: ${source}/${tile.z}/${tile.x}/${tile.y}  ${stats.uncompressedBytes} -> ${stats.compressedBytes}`);
    }
    return Promise.resolve(response);
};
