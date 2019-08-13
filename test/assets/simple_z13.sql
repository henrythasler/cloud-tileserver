SELECT ( (SELECT ST_AsMVT(q, 'landuse', 4096, 'geom') as data FROM
    (SELECT ST_AsMvtGeom(
        geometry,
        ST_Transform(ST_MakeEnvelope(!BBOX!, 4326), 3857),
        4096,
        256,
        true
        ) AS geom
    FROM import.landuse_gen8 WHERE (geometry && ST_Transform(ST_MakeEnvelope(!BBOX!, 4326), 3857))) as q) ) as data