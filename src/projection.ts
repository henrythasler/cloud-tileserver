export interface Wgs84 {
    /** in degrees */
    lng: number,
    /** in degrees */
    lat: number
}

export interface Mercator {
    /** in meters */
    x: number,
    /** in meters */
    y: number
}

export interface Vector {
    x: number,
    y: number
}

export interface Tile {
    z: number,
    x: number,
    y: number
}

export interface TileList extends Array<Tile> { }

export interface WGS84BoundingBox {
    leftbottom: Wgs84,
    righttop: Wgs84
}

export interface MercatorBoundingBox {
    leftbottom: Mercator,
    righttop: Mercator
}

export class Projection {
    protected originShift = 2 * Math.PI * 6378137 / 2.0;

    /** Converts XY point from Pseudo-Mercator (https://epsg.io/3857) to WGS84 (https://epsg.io/4326) */
    getWGS84FromMercator(pos: Mercator): Wgs84 {
        let lon = (pos.x / this.originShift) * 180.0;
        let lat = (pos.y / this.originShift) * 180.0;
        lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180.0)) - Math.PI / 2.0)
        return ({ lng: lon, lat: lat } as Wgs84)
    }

    /** Converts pixel coordinates (Origin is top-left) in given zoom level of pyramid to EPSG:900913 */
    getMercatorFromPixels(pos: Vector, zoom: number, tileSize: number = 256): Mercator {
        // zoom = Math.max(0, zoom + 1 - tileSize / 256)
        let res = 2 * Math.PI * 6378137 / tileSize / Math.pow(2, zoom);
        return ({ x: pos.x * res - this.originShift, y: this.originShift - pos.y * res } as Mercator)
    }

    /** Returns bounds of the given tile in Pseudo-Mercator (https://epsg.io/3857) coordinates */
    getMercatorTileBounds(tile: Vector, zoom: number, tileSize: number = 256): MercatorBoundingBox {
        let leftbottom = this.getMercatorFromPixels(<Vector>{ x: tile.x * tileSize, y: (tile.y + 1) * tileSize }, zoom, tileSize);
        let righttop = this.getMercatorFromPixels(<Vector>{ x: (tile.x + 1) * tileSize, y: tile.y * tileSize }, zoom, tileSize);
        return ({ leftbottom: leftbottom, righttop: righttop } as MercatorBoundingBox)
    }

    /** Returns bounds of the given tile in WGS84 (https://epsg.io/4326) coordinates */
    getWGS84TileBounds(tile: Vector, zoom: number, tileSize: number = 256): WGS84BoundingBox {
        let bounds: MercatorBoundingBox = this.getMercatorTileBounds(tile, zoom, tileSize);
        return ({
            leftbottom: this.getWGS84FromMercator(bounds.leftbottom),
            righttop: this.getWGS84FromMercator(bounds.righttop)
        } as WGS84BoundingBox)
    }

    /** Returns center of the given tile in WGS84 (https://epsg.io/4326) coordinates */
    getWGS84TileCenter(tile: Vector, zoom: number, tileSize: number = 256): Wgs84 {
        let bounds: WGS84BoundingBox = this.getWGS84TileBounds(tile, zoom, tileSize);
        return ({
            lng: (bounds.righttop.lng + bounds.leftbottom.lng) / 2,
            lat: (bounds.righttop.lat + bounds.leftbottom.lat) / 2,
        } as Wgs84)
    }

    /** Return a list of zxy-Tilecoordinates `depth`-levels below the given tile
     * @param tile Top-level tile to start the pyramid; will also be part of the return value
     * @param depth How many levels the resulting pyramid will have.
     * @return An array of tiles
    */
    getTilePyramid(tile: Tile, depth: number = 1): TileList {
        let list: TileList = [];
        depth = Math.max(0, depth); // do not allow negative values
        for (let zoom = 0; zoom <= depth; zoom++) {
            for (let y = tile.y * 2 ** zoom; y < (tile.y + 1) * 2 ** zoom; y++) {
                for (let x = tile.x * 2 ** zoom; x < (tile.x + 1) * 2 ** zoom; x++) {
                    list.push(<Tile>{
                        x: x,
                        y: y,
                        z: tile.z + zoom
                    })
                }
            }
        }
        return list
    }
}