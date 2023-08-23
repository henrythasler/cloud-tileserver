terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
      version = "~> 5.13"
    }
  }
  required_version = ">= 1.5"
}
