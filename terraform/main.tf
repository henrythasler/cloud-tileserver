provider "aws" {
  profile = "default"
  region  = "${var.region}"
}

provider "aws" {
  profile = "default"
  region  = "us-east-1"
  alias   = "us-east-1"
}

terraform {
  required_version = ">= 1.5"
  backend "s3" {
    bucket         = "terraform-state-0000"
    key            = "cyclemap.link/terraform.tfstate"
    region         = "eu-central-1"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }

  required_providers {
    aws = {
      source = "hashicorp/aws"
      version = "~> 5.13"
    }
  }
}
