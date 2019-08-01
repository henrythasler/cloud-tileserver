import { Handler, Context } from 'aws-lambda';
import { Client, QueryResult } from "pg";
import { Projection, WGS84BoundingBox, Tile } from "./projection";
import S3 from 'aws-sdk/clients/s3';

interface Event {
    path: string
}

const cacheBucketName = "cache.cyclemap.link"
const proj = new Projection();
const s3 = new S3({ apiVersion: '2006-03-01' });

function extractTile(path: string): Tile | null {
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

function extractLayer(path: string): string | null {
    let layerCandidates = path.match(/(?!\/)\w+(?=\/\d)/)
    if (layerCandidates) {
        return layerCandidates[layerCandidates.length - 1];
    }
    return null;
}

async function fetchTileFromDatabase(bbox: WGS84BoundingBox): Promise<Buffer> {
    let client: Client = new Client();
    await client.connect();
    // console.log(bbox)
    let res: QueryResult = await client.query(`SELECT ST_AsMVT(q, 'buildings', 4096, 'geom') as data FROM
(SELECT ST_AsMvtGeom(
          geometry,
          ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857),
          4096,
          256,
          true
        ) AS geom, id
      FROM import.buildings
      WHERE geometry && ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857)
) as q`)
    let vectortile: Buffer = res.rows[0].data;

    res = await client.query(`SELECT ST_AsMVT(q, 'landcover', 4096, 'geom') as data FROM
(SELECT ST_AsMvtGeom(
          geometry,
          ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857),
          4096,
          256,
          true
        ) AS geom, osm_id as id, class, subclass, area, surface, name
      FROM import.landcover
      WHERE geometry && ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857)
) as q`)
    vectortile = Buffer.concat([vectortile, res.rows[0].data]);

    res = await client.query(`SELECT ST_AsMVT(q, 'roads', 4096, 'geom') as data FROM
(SELECT ST_AsMvtGeom(
          geometry,
          ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857),
          4096,
          256,
          true
        ) AS geom, osm_id as id, class, subclass, oneway, tracktype, bridge, tunnel, service, CASE WHEN layer IS NULL THEN 0 ELSE layer END as layer, rank, bicycle, scale, substring(ref from '\\w+') as ref_prefix, substring(ref from '\\d+') as ref_num, NULL as name
      FROM import.roads
      WHERE geometry && ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857)
) as q`)
    vectortile = Buffer.concat([vectortile, res.rows[0].data]);
    await client.end();
    return vectortile;
}

export const handler: Handler = async (event: Event, context: Context): Promise<any> => {

    let response = {
        statusCode: 500,
        headers: {
            'Content-Type': 'text/html',
            'access-control-allow-origin': '*'
        },
        body: "Error",
        isBase64Encoded: false
    }

    let tile: Tile | null = extractTile(event.path);
    let layer: string | null = extractLayer(event.path);

    if (tile && layer) {
        let cacheObjects = await s3.listObjects({
            Bucket: cacheBucketName,
            Prefix: `${layer}/${tile.z}/${tile.x}/${tile.y}`
        }).promise();

        let vectortile: Buffer | null = null;

        if (cacheObjects.Contents && cacheObjects.Contents.length > 0) {
            console.log(`${layer}/${tile.z}/${tile.x}/${tile.y} - cache hit`);
            let cacheobj = await s3.getObject({
                Bucket: cacheBucketName,
                Key: `${layer}/${tile.z}/${tile.x}/${tile.y}.mvt`
            }).promise();
            vectortile = <Buffer>cacheobj.Body;
        }
        else {
            console.log(`${layer}/${tile.z}/${tile.x}/${tile.y} - cache miss`);
            let bbox = proj.getWGS84TileBounds(tile)
            try {
                vectortile = await fetchTileFromDatabase(bbox);
                let s3obj = await s3.putObject({
                    Body: vectortile,
                    Bucket: cacheBucketName,
                    Key: `${layer}/${tile.z}/${tile.x}/${tile.y}.mvt`,
                    ContentEncoding: "application/vnd.mapbox-vector-tile"
                }).promise();
                // console.log(s3obj);
            } catch (error) {
                vectortile = null;
                console.log(error);
            }
        }
        if (vectortile) {
            response = {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/vnd.mapbox-vector-tile',
                    'access-control-allow-origin': '*'
                },
                body: vectortile.toString('base64'),
                isBase64Encoded: true
            }
        }
    }
    return Promise.resolve(response)
}