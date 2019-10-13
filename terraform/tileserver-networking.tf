data "aws_vpc" "gis" {
  filter {
    name   = "tag:Name"
    values = ["${var.vpc}"]
  }
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id       = "${data.aws_vpc.gis.id}"
  service_name = "com.amazonaws.${var.region}.s3"
  tags = {
    Name = "S3 Endpoint"
  }
}

resource "aws_internet_gateway" "tileserver_gateway" {
  vpc_id = "${data.aws_vpc.gis.id}"
  tags = {
    Name = "Tileserver Gateway"
  }
}

resource "aws_route_table" "s3" {
  vpc_id = "${data.aws_vpc.gis.id}" 
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = "${aws_internet_gateway.tileserver_gateway.id}"
  }
  tags = {
    Name = "S3-Routing"
  }
}

resource "aws_vpc_endpoint_route_table_association" "private_s3" {
  vpc_endpoint_id = "${aws_vpc_endpoint.s3.id}"
  route_table_id  = "${aws_route_table.s3.id}"
}
