variable "region" {
  default = "eu-central-1"
}


variable "postgres_password" {}
variable "postgres_user" {
  default = "postgres"
}

variable "postgres_host" {
  default = "localhost"
}

variable "database_local" {
  default = "local"
}

variable "sitename" {
  default = "cyclemap.link"
}
