"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Projection {
    constructor() {
        this.originShift = 2 * Math.PI * 6378137 / 2.0;
    }
    /** Converts XY point from Pseudo-Mercator (https://epsg.io/3857) to WGS84 (https://epsg.io/4326) */
    getWGS84FromMercator(pos) {
        let lon = (pos.x / this.originShift) * 180.0;
        let lat = (pos.y / this.originShift) * 180.0;
        lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180.0)) - Math.PI / 2.0);
        return { lng: lon, lat: lat };
    }
    /** Converts pixel coordinates (Origin is top-left) in given zoom level of pyramid to EPSG:900913 */
    getMercatorFromPixels(pos, zoom, tileSize = 256) {
        // zoom = Math.max(0, zoom + 1 - tileSize / 256)
        let res = 2 * Math.PI * 6378137 / tileSize / Math.pow(2, zoom);
        return { x: pos.x * res - this.originShift, y: this.originShift - pos.y * res };
    }
    /** Returns bounds of the given tile in Pseudo-Mercator (https://epsg.io/3857) coordinates */
    getMercatorTileBounds(tile, tileSize = 256) {
        let leftbottom = this.getMercatorFromPixels({ x: tile.x * tileSize, y: (tile.y + 1) * tileSize }, tile.z, tileSize);
        let righttop = this.getMercatorFromPixels({ x: (tile.x + 1) * tileSize, y: tile.y * tileSize }, tile.z, tileSize);
        return { leftbottom: leftbottom, righttop: righttop };
    }
    /** Returns bounds of the given tile in WGS84 (https://epsg.io/4326) coordinates */
    getWGS84TileBounds(tile, tileSize = 256) {
        let bounds = this.getMercatorTileBounds(tile, tileSize);
        return {
            leftbottom: this.getWGS84FromMercator(bounds.leftbottom),
            righttop: this.getWGS84FromMercator(bounds.righttop)
        };
    }
    /** Returns center of the given tile in WGS84 (https://epsg.io/4326) coordinates */
    getWGS84TileCenter(tile, tileSize = 256) {
        let bounds = this.getWGS84TileBounds(tile, tileSize);
        return {
            lng: (bounds.righttop.lng + bounds.leftbottom.lng) / 2,
            lat: (bounds.righttop.lat + bounds.leftbottom.lat) / 2,
        };
    }
    /** Return a list of zxy-Tilecoordinates `depth`-levels below the given tile
     * @param tile Top-level tile to start the pyramid; will also be part of the return value
     * @param depth How many levels the resulting pyramid will have.
     * @return An array of tiles
    */
    getTilePyramid(tile, depth = 1) {
        let list = [];
        depth = Math.max(0, depth); // do not allow negative values
        for (let zoom = 0; zoom <= depth; zoom++) {
            for (let y = tile.y * 2 ** zoom; y < (tile.y + 1) * 2 ** zoom; y++) {
                for (let x = tile.x * 2 ** zoom; x < (tile.x + 1) * 2 ** zoom; x++) {
                    list.push({
                        x: x,
                        y: y,
                        z: tile.z + zoom
                    });
                }
            }
        }
        return list;
    }
}
exports.Projection = Projection;
