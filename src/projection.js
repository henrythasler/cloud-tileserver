"use strict";
exports.__esModule = true;
var Projection = /** @class */ (function () {
    function Projection() {
        this.originShift = 2 * Math.PI * 6378137 / 2.0;
    }
    /** Converts XY point from Pseudo-Mercator (https://epsg.io/3857) to WGS84 (https://epsg.io/4326) */
    Projection.prototype.getWGS84FromMercator = function (pos) {
        var lon = (pos.x / this.originShift) * 180.0;
        var lat = (pos.y / this.originShift) * 180.0;
        lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180.0)) - Math.PI / 2.0);
        return { lng: lon % 360, lat: lat % 180 };
    };
    /** Converts pixel coordinates (Origin is top-left) in given zoom level of pyramid to EPSG:900913 */
    Projection.prototype.getMercatorFromPixels = function (pos, zoom, tileSize) {
        if (tileSize === void 0) { tileSize = 256; }
        // zoom = Math.max(0, zoom + 1 - tileSize / 256)
        var res = 2 * Math.PI * 6378137 / tileSize / Math.pow(2, zoom);
        return { x: pos.x * res - this.originShift, y: this.originShift - pos.y * res };
    };
    /** Returns bounds of the given tile in Pseudo-Mercator (https://epsg.io/3857) coordinates */
    Projection.prototype.getMercatorTileBounds = function (tile, tileSize) {
        if (tileSize === void 0) { tileSize = 256; }
        var leftbottom = this.getMercatorFromPixels({ x: tile.x * tileSize, y: (tile.y + 1) * tileSize }, tile.z, tileSize);
        var righttop = this.getMercatorFromPixels({ x: (tile.x + 1) * tileSize, y: tile.y * tileSize }, tile.z, tileSize);
        return { leftbottom: leftbottom, righttop: righttop };
    };
    /** Returns bounds of the given tile in WGS84 (https://epsg.io/4326) coordinates */
    Projection.prototype.getWGS84TileBounds = function (tile, tileSize) {
        if (tileSize === void 0) { tileSize = 256; }
        var bounds = this.getMercatorTileBounds(tile, tileSize);
        return {
            leftbottom: this.getWGS84FromMercator(bounds.leftbottom),
            righttop: this.getWGS84FromMercator(bounds.righttop)
        };
    };
    /** Returns center of the given tile in WGS84 (https://epsg.io/4326) coordinates */
    Projection.prototype.getWGS84TileCenter = function (tile, tileSize) {
        if (tileSize === void 0) { tileSize = 256; }
        var bounds = this.getWGS84TileBounds(tile, tileSize);
        return {
            lng: (bounds.righttop.lng + bounds.leftbottom.lng) / 2,
            lat: (bounds.righttop.lat + bounds.leftbottom.lat) / 2
        };
    };
    /** Return a list of zxy-Tilecoordinates `depth`-levels below the given tile
     * @param tile Top-level tile to start the pyramid; will also be part of the return value
     * @param depth How many levels the resulting pyramid will have.
     * @return An array of tiles
    */
    Projection.prototype.getTilePyramid = function (tile, depth) {
        if (depth === void 0) { depth = 1; }
        var list = [];
        depth = Math.max(0, depth); // do not allow negative values
        for (var zoom = 0; zoom <= depth; zoom++) {
            for (var y = tile.y * Math.pow(2, zoom); y < (tile.y + 1) * Math.pow(2, zoom); y++) {
                for (var x = tile.x * Math.pow(2, zoom); x < (tile.x + 1) * Math.pow(2, zoom); x++) {
                    list.push({
                        x: x,
                        y: y,
                        z: tile.z + zoom
                    });
                }
            }
        }
        return list;
    };
    return Projection;
}());
exports.Projection = Projection;
