"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var tileserver_1 = require("../src/tileserver");
var http = require("http");
var fs_1 = require("fs");
var toml_1 = require("@iarna/toml");
var fixturesPath = "local/";
var config = toml_1.parse(fs_1.readFileSync(fixturesPath + "cyclemap.toml", "utf8"));
var gzip = false;
var tileserver = new tileserver_1.Tileserver(config, "", 3, gzip);
// docker run --rm -ti -p 5432:5432 -v /media/mapdata/pgdata_mvt:/pgdata -v $(pwd)/postgis.conf:/etc/postgresql/postgresql.conf -e PGDATA=/pgdata img-postgis:0.9 -c 'config_file=/etc/postgresql/postgresql.conf'
process.env.PGPASSWORD = "";
process.env.PGUSER = "postgres";
function listener(req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var path, vectortile;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    path = req.url ? req.url : "/";
                    return [4 /*yield*/, tileserver.getVectortile(path)];
                case 1:
                    vectortile = _a.sent();
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
                    return [2 /*return*/];
            }
        });
    });
}
var webserver = http.createServer();
webserver.on('request', listener);
webserver.listen(8000);
console.log("awaiting connections...");
