provider "aws" {
  version = "~> 2.16"
  profile = "default"
  region  = "${var.region}"
}

data "aws_vpc" "gis" {
  id = "${var.vpc_id}"
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id       = "${data.aws_vpc.gis.id}"
  service_name = "com.amazonaws.${var.region}.s3"
}

resource "aws_vpc_endpoint_route_table_association" "private_s3" {
  vpc_endpoint_id = "${aws_vpc_endpoint.s3.id}"
  route_table_id  = "${var.route_id}"
}