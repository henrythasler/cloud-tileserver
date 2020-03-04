variable "region" {
  default = "eu-central-1"
}

variable "postgres_password" {}
variable "postgres_user" {
  default = "postgres"
}

variable "postgres_host" {
  default = "db.cyclemap.link"
}

variable "domain" {
  default = "cyclemap.link"
}

variable "tileserver_prefix" {
  default = "tileserver."
}

variable "tilecache_prefix" {
  default = "tiles."
}

variable "vpc" {
  default = "default"
}

variable "log_level" {
  default = "3"
}
