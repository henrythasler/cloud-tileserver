terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
      version = "~> 3.56"
    }
  }
  required_version = ">= 0.13"
}
