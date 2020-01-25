import { Tileserver, Config } from "../src/tileserver";
import * as http from "http"
import { readFileSync } from "fs";
import { parse } from "@iarna/toml";

const fixturesPath = "local/";

const config = parse(readFileSync(`${fixturesPath}cyclemap.toml`, "utf8")) as unknown as Config;

const gzip = false;
const tileserver = new Tileserver(config, "", 3, gzip);

// docker run --rm -ti -p 5432:5432 -v /media/mapdata/pgdata_mvt:/pgdata -v $(pwd)/postgis.conf:/etc/postgresql/postgresql.conf -e PGDATA=/pgdata img-postgis:0.9 -c 'config_file=/etc/postgresql/postgresql.conf'
process.env.PGPASSWORD = "";
process.env.PGUSER = "postgres";

async function listener(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    let path = req.url?req.url:"/";
    let vectortile = await tileserver.getVectortile(path);
    if ((vectortile.res >= 0) && (vectortile.data)) {
        res.writeHead(200, {
            'Content-Type': 'application/vnd.mapbox-vector-tile',
            'access-control-allow-origin': '*'
        });
        res.end(vectortile.data);
    }
    else {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(JSON.stringify(vectortile));
    }
}

const webserver = http.createServer();
webserver.on('request', listener);
webserver.listen(8000);
console.log("awaiting connections...")