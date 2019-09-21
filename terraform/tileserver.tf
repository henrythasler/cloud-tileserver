provider "aws" {
  version = "~> 2.16"
  profile = "default"
  region  = "${var.region}"
}

resource "aws_s3_bucket" "terraform_state" {
  bucket = "terraform-state-0000"  
  versioning {
    enabled = true
  }  
  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
}

resource "aws_dynamodb_table" "terraform_locks" {
  name         = "terraform-state-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"  
  attribute {
    name = "LockID"
    type = "S"
  }
}

terraform {
  backend "s3" {
    bucket = "terraform-state-0000"
    key    = "cyclemap.link/terraform.tfstate"
    region = "eu-central-1"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true    
  }
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