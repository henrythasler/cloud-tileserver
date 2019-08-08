source = [{
  name = "local"
  prefix = "import"
  host   = "localhost"
  port   = 5432
  layer = [{
    name="buildings" 
    srid      = 3857
    table     = "buildings"
    geom      = "geometry"
    keys      = ["id"]
    extend    = 4096
    buffer    = 256
    clip_geom = true
  }]
},

{
  name = "world"
  database = "world"
  layer "water" {
    extend    = 4096
    buffer    = 256
    clip_geom = true
    sql       = <<EOF
select gid, ST_AsBinary(geometry) as geom from public.water_polygons_z2 WHERE 1 >= !ZOOM! AND (geometry && !BBOX!) 
union all
select gid, ST_AsBinary(geometry) as geom from public.water_polygons_z3 WHERE 1 < !ZOOM! AND 2 >= !ZOOM! AND (geometry && !BBOX!) 
union all
select gid, ST_AsBinary(geometry) as geom from public.water_polygons_z4 WHERE 2 < !ZOOM! AND 3 >= !ZOOM! AND (geometry && !BBOX!) 
union all
select gid, ST_AsBinary(geometry) as geom from public.water_polygons_z5 WHERE 3 < !ZOOM! AND 4 >= !ZOOM! AND (geometry && !BBOX!) 
union all
select gid, ST_AsBinary(geometry) as geom from public.water_polygons_z6 WHERE 4 < !ZOOM! AND 5 >= !ZOOM! AND (geometry && !BBOX!) 
union all
select gid, ST_AsBinary(geometry) as geom from public.water_polygons_z7 WHERE 5 < !ZOOM! AND 6 >= !ZOOM! AND (geometry && !BBOX!) 
union all
select gid, ST_AsBinary(geometry) as geom from public.water_polygons_z8 WHERE 6 < !ZOOM! AND 7 >= !ZOOM! AND (geometry && !BBOX!) 
union all
select gid, ST_AsBinary(geometry) as geom from public.simplified_water_polygons WHERE 7 < !ZOOM! AND 8 >= !ZOOM! AND (geometry && !BBOX!) 
union all
select gid, ST_AsBinary(geometry) as geom from public.water_polygons WHERE 8 < !ZOOM! AND (geometry && !BBOX!) 
EOF
  }
}]
